import { supabase } from './supabase'
import { SUPABASE_URL } from './config'

// 휴대폰 알림 (웹 푸시)
const FN = `${SUPABASE_URL}/functions/v1/push`

export const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export type PushPrefs = { enabled: boolean; title: string; body: string }
export const DEFAULT_PREFS: PushPrefs = { enabled: false, title: '알림', body: '새 소식이 {n}건 있어요' }

export async function loadPrefs(): Promise<PushPrefs> {
  const { data } = await supabase.from('push_prefs').select('enabled, title, body').maybeSingle()
  return data ? (data as PushPrefs) : DEFAULT_PREFS
}

/** 이 기기에서 알림 받는 중인지 */
export async function deviceSubscribed() {
  if (!pushSupported()) return false
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return !!sub && Notification.permission === 'granted'
}

export async function enablePush(prefs: Omit<PushPrefs, 'enabled'>): Promise<string | null> {
  if (!pushSupported()) return isIOS() ? '아이폰은 사파리에서 "홈 화면에 추가"한 뒤, 홈 화면 아이콘으로 열어야 알림을 받을 수 있어요.' : '이 브라우저는 알림을 지원하지 않아요.'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return '알림 권한이 꺼져 있어요. 휴대폰 설정에서 이 사이트(또는 앱)의 알림을 허용해 주세요.'
  try {
    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'))
    await navigator.serviceWorker.ready
    const { publicKey } = await fetch(FN).then((r) => r.json())
    let sub = await reg.pushManager.getSubscription()
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) })
    const j = sub.toJSON()
    const { data: u } = await supabase.auth.getUser()
    const { error: e1 } = await supabase
      .from('push_subscriptions')
      .upsert({ endpoint: j.endpoint!, user_id: u.user!.id, p256dh: j.keys!.p256dh, auth: j.keys!.auth })
    if (e1) throw e1
    const { error: e2 } = await supabase.from('push_prefs').upsert({ user_id: u.user!.id, enabled: true, ...prefs, updated_at: new Date().toISOString() })
    if (e2) throw e2
    return null
  } catch (err) {
    console.error(err)
    return '알림 켜기에 실패했어요. 잠시 후 다시 시도해 주세요.'
  }
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe().catch(() => {})
  }
}

export async function savePrefs(p: PushPrefs) {
  const { data: u } = await supabase.auth.getUser()
  const { error } = await supabase.from('push_prefs').upsert({ user_id: u.user!.id, ...p, updated_at: new Date().toISOString() })
  return !error
}

export async function testPush(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const r = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify({ test: true }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) return '시험 알림을 보내지 못했어요.'
  return d.sent ? '시험 알림을 보냈어요. 화면을 끄거나 다른 앱으로 가서 확인해 보세요.' : '알림 받을 기기가 없어요. 먼저 "알림 켜기"를 눌러 주세요.'
}
