import { SUPABASE_URL, SUPABASE_KEY, ID_DOMAIN, DEFAULTS, STYLES, ICONS } from './common.js'

const $ = (id) => document.getElementById(id)
const msg = (t) => ($('msg').textContent = t)
let icon = DEFAULTS.icon

async function load() {
  const { session, settings = {} } = await chrome.storage.local.get(['session', 'settings'])
  const s = { ...DEFAULTS, ...settings }
  $('login').hidden = !!session
  $('main').hidden = !session
  if (!session) return
  $('who').textContent = `${session.login} 로 로그인됨`
  $('enabled').checked = s.enabled
  $('title').value = s.title
  $('text').value = s.text
  $('seconds').value = String(s.seconds)
  $('sites').value = s.sites
  $('style').innerHTML = Object.entries(STYLES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')
  $('style').value = s.style
  icon = s.icon
  $('icons').innerHTML = ''
  for (const ic of ICONS) {
    const b = document.createElement('button')
    b.textContent = ic
    b.className = ic === icon ? 'on' : ''
    b.onclick = () => {
      icon = ic
      ;[...$('icons').children].forEach((x) => (x.className = x.textContent === ic ? 'on' : ''))
    }
    $('icons').appendChild(b)
  }
}

function current() {
  return {
    enabled: $('enabled').checked,
    title: $('title').value.trim() || DEFAULTS.title,
    text: $('text').value.trim() || DEFAULTS.text,
    icon,
    style: $('style').value,
    seconds: Number($('seconds').value),
    sites: $('sites').value.trim(),
  }
}

$('doLogin').onclick = async () => {
  const id = $('id').value.trim().toLowerCase()
  const pw = $('pw').value
  if (!id || !pw) return
  $('doLogin').disabled = true
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `${id}@${ID_DOMAIN}`, password: pw }),
    })
    if (!r.ok) throw new Error('login')
    const d = await r.json()
    await chrome.storage.local.set({
      session: { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at, user_id: d.user.id, login: id },
    })
    $('pw').value = ''
    await chrome.runtime.sendMessage({ type: 'resetBase' })
    await load()
    msg('로그인했어요. 이제 새 메시지가 오면 띠가 떠요.')
  } catch {
    alertBox('아이디 또는 비밀번호가 맞지 않아요.')
  } finally {
    $('doLogin').disabled = false
  }
}
function alertBox(t) {
  let el = document.querySelector('#login .msg')
  if (!el) {
    el = document.createElement('div')
    el.className = 'msg'
    $('login').appendChild(el)
  }
  el.textContent = t
}

$('save').onclick = async () => {
  await chrome.storage.local.set({ settings: current() })
  msg('저장했어요.')
}
$('test').onclick = async () => {
  await chrome.storage.local.set({ settings: current() })
  await chrome.runtime.sendMessage({ type: 'test', n: 1 })
  msg('보고 있던 탭에 미리보기를 띄웠어요. (설정한 사이트가 아니면 안 떠요)')
}
$('logout').onclick = async () => {
  await chrome.storage.local.remove(['session', 'lastId'])
  await load()
}

load()
