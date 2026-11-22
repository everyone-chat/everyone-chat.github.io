// 휴대폰 알림 보내기 (Supabase Edge Function, "Verify JWT" 끔)
// - GET            → 알림 구독용 공개 키
// - POST {id}      → DB 트리거가 호출: 그 메시지를 받는 사람의 기기들로 알림 (같은 메시지는 한 번만)
// - POST {test}    → 로그인한 본인 기기로 시험 알림
// 서명 키는 처음 실행할 때 함수가 직접 만들어 서버 전용 테이블에 보관 (사람이 키를 다룰 일 없음)
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

let cached: { public_key: string; private_key: string } | null = null
async function keys() {
  if (cached) return cached
  let { data } = await sb.from('push_server').select('public_key, private_key').eq('id', 1).maybeSingle()
  if (!data) {
    const k = webpush.generateVAPIDKeys()
    await sb.from('push_server').upsert({ id: 1, public_key: k.publicKey, private_key: k.privateKey }, { onConflict: 'id', ignoreDuplicates: true })
    ;({ data } = await sb.from('push_server').select('public_key, private_key').eq('id', 1).single())
  }
  cached = data!
  webpush.setVapidDetails('mailto:noreply@everyone-chat.app', cached.public_key, cached.private_key)
  return cached
}

async function sendTo(userId: string, n: number, test = false) {
  const { data: pref } = await sb.from('push_prefs').select('enabled, title, body').eq('user_id', userId).maybeSingle()
  if (!test && pref && !pref.enabled) return 0
  const title = pref?.title || '알림'
  const body = (pref?.body || '새 소식이 {n}건 있어요').replaceAll('{n}', String(n))
  const { data: subs } = await sb.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', userId)
  let sent = 0
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title, body, tag: 'msg' }),
        { TTL: 60 * 60 * 6, urgency: 'high' },
      )
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await sb.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      else console.error('push fail', code)
    }
  }
  return sent
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  const k = await keys()
  if (req.method === 'GET') return json({ publicKey: k.public_key })

  const body = await req.json().catch(() => ({}))

  if (body.test) {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data } = await sb.auth.getUser(token)
    if (!data.user) return json({ error: 'login' }, 401)
    return json({ sent: await sendTo(data.user.id, 1, true) })
  }

  const id = Number(body.id)
  if (!id) return json({ error: 'bad' }, 400)
  // 같은 메시지로는 한 번만
  const { error: dup } = await sb.from('push_sent').insert({ message_id: id })
  if (dup) return json({ skipped: 'dup' })
  const { data: m } = await sb.from('messages').select('id, user_id, room_a, room_b').eq('id', id).maybeSingle()
  if (!m || !m.room_a || !m.room_b) return json({ skipped: 'none' })
  const to = m.room_a === m.user_id ? m.room_b : m.room_a

  // 지금 앱을 보고 있는 사람에게는 안 보냄 (마지막 활동 70초 이내)
  const { data: p } = await sb.from('profiles').select('last_seen').eq('id', to).maybeSingle()
  if (p?.last_seen && Date.now() - new Date(p.last_seen).getTime() < 70_000) return json({ skipped: 'active' })

  // 그 대화에서 안 읽은 개수
  const { data: r } = await sb.from('chat_reads').select('last_read_id').eq('user_id', to).eq('peer_id', m.user_id).maybeSingle()
  const { count } = await sb
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', m.user_id)
    .or(`room_a.eq.${to},room_b.eq.${to}`)
    .gt('id', r?.last_read_id ?? 0)

  // 오래된 보낸 기록 정리
  if (Math.random() < 0.05) await sb.from('push_sent').delete().lt('at', new Date(Date.now() - 86400_000).toISOString())

  return json({ sent: await sendTo(to, count ?? 1) })
})
