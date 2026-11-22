import { SUPABASE_URL, SUPABASE_KEY, DEFAULTS } from './common.js'

// 30초마다 내 대화에 새 메시지가 왔는지 확인 (서버 보안 규칙상 내 대화만 보임)
const ALARM = 'poll'
chrome.runtime.onInstalled.addListener(() => chrome.alarms.create(ALARM, { periodInMinutes: 0.5 }))
chrome.runtime.onStartup.addListener(() => chrome.alarms.create(ALARM, { periodInMinutes: 0.5 }))
chrome.alarms.onAlarm.addListener((a) => a.name === ALARM && poll())

async function getSession() {
  const { session } = await chrome.storage.local.get('session')
  if (!session) return null
  if (Date.now() / 1000 < session.expires_at - 60) return session
  // 만료 → 이 확장 전용 세션을 새로 고침 (웹사이트 로그인과는 별개라 서로 로그아웃되지 않음)
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  })
  if (!r.ok) {
    if (r.status === 400 || r.status === 401) await chrome.storage.local.remove('session')
    return null
  }
  const d = await r.json()
  const next = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at, user_id: d.user.id, login: session.login }
  await chrome.storage.local.set({ session: next })
  return next
}

async function poll() {
  const { settings = DEFAULTS, lastId } = await chrome.storage.local.get(['settings', 'lastId'])
  if (settings.enabled === false) return
  const s = await getSession()
  if (!s) return
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}` }
  // 처음엔 지금까지의 메시지는 건너뛰고 기준점만 잡음
  if (lastId == null) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/messages?select=id&order=id.desc&limit=1`, { headers })
    if (!r.ok) return
    const rows = await r.json()
    await chrome.storage.local.set({ lastId: rows[0]?.id ?? 0 })
    return
  }
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/messages?select=id&user_id=neq.${s.user_id}&id=gt.${lastId}&order=id.asc&limit=100`,
    { headers },
  )
  if (!r.ok) return
  const rows = await r.json()
  if (!rows.length) return
  await chrome.storage.local.set({ lastId: rows[rows.length - 1].id })
  await show(rows.length)
}

async function show(n, test = false) {
  const { settings = DEFAULTS } = await chrome.storage.local.get('settings')
  const payload = { type: 'banner', n, at: Date.now(), settings: { ...DEFAULTS, ...settings }, test }
  // 탭이 백그라운드였다면 그 탭을 볼 때 띄우도록 잠깐 보관
  await chrome.storage.local.set({ pending: payload })
  const tabs = await chrome.tabs.query({})
  for (const t of tabs) chrome.tabs.sendMessage(t.id, payload).catch(() => {})
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === 'test') show(msg.n ?? 1, true).then(() => reply(true))
  if (msg?.type === 'pollNow') poll().then(() => reply(true))
  if (msg?.type === 'resetBase') chrome.storage.local.remove('lastId').then(() => poll()).then(() => reply(true))
  return true
})
