// =========================================================
// 모두의채팅 사진·동영상 저장소 (Cloudflare Worker + R2, 무료 10GB)
//
// Cloudflare 대시보드에서:
//   1) R2 → 버킷 만들기: everyone-chat-media (비공개 그대로)
//   2) Workers → 새 Worker 만들기(이름 media, 계정 하위 도메인 everyone-chat-app) → 이 파일 내용을 붙여넣고 배포
//      주소: https://media.everyone-chat-app.workers.dev
//   3) Worker 설정 → 바인딩 → R2 버킷 추가: 변수 이름 MEDIA, 버킷 everyone-chat-media
//
// 비밀 키가 필요 없음: R2는 바인딩으로 연결하고,
// "누가 어떤 파일을 볼 수 있나"는 사용자의 로그인 토큰으로 Supabase에 물어봐서 결정
// (Supabase의 보안 규칙 그대로: 그 대화의 두 사람만 볼 수 있음)
// =========================================================

const SUPABASE_URL = 'https://uzzyadqvshwtrqsaexbr.supabase.co'
const SUPABASE_KEY = 'sb_publishable_eBXn4fB7b4fVbDQU9G6HGQ_erdnV2jq' // 공개용 키
const ORIGINS = ['https://everyone-chat.github.io', 'http://localhost:5173']
const MAX_BYTES = 95 * 1024 * 1024 // Worker 무료 플랜 요청 크기(100MB) 안쪽
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']
// 경로 모양: <내 사용자 id>/r2/<무작위>.<확장자>
const PATH_RE = /^([0-9a-f-]{36})\/r2\/[0-9a-f-]{36}\.(jpg|png|webp|gif|mp4|mov|webm)$/

function cors(req) {
  const o = req.headers.get('Origin') || ''
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

const sb = (path, token, init = {}) =>
  fetch(SUPABASE_URL + path, {
    ...init,
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })

async function userId(token) {
  const r = await sb('/auth/v1/user', token)
  if (!r.ok) return null
  return (await r.json()).id || null
}

async function rpc(name, token, args) {
  const r = await sb('/rest/v1/rpc/' + name, token, { method: 'POST', body: JSON.stringify(args || {}) })
  if (!r.ok) return null
  return r.json()
}

/** 이 사람이 이 파일을 볼 수 있나: 메시지가 보이면(=그 대화 당사자) 가능, 또는 내가 올린 파일 */
async function canView(token, uid, path) {
  if (path.startsWith(uid + '/')) return true
  const r = await sb('/rest/v1/messages?select=id&limit=1&image_path=eq.' + encodeURIComponent(path), token)
  if (!r.ok) return false
  return (await r.json()).length > 0
}

export default {
  async fetch(req, env) {
    const h = cors(req)
    if (req.method === 'OPTIONS') return new Response(null, { headers: h })
    const url = new URL(req.url)
    const path = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    const m = path.match(PATH_RE)
    if (!m) return new Response('bad path', { status: 400, headers: h })
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return new Response('login required', { status: 401, headers: h })
    const uid = await userId(token)
    if (!uid) return new Response('login required', { status: 401, headers: h })

    if (req.method === 'PUT') {
      if (m[1] !== uid) return new Response('forbidden', { status: 403, headers: h })
      if (!(await rpc('is_member', token))) return new Response('forbidden', { status: 403, headers: h })
      const type = (req.headers.get('Content-Type') || '').split(';')[0]
      if (!TYPES.includes(type)) return new Response('type', { status: 415, headers: h })
      const len = Number(req.headers.get('Content-Length') || 0)
      if (!len || len > MAX_BYTES) return new Response('too big', { status: 413, headers: h })
      await env.MEDIA.put(path, req.body, { httpMetadata: { contentType: type } })
      return new Response('ok', { headers: h })
    }

    if (req.method === 'GET') {
      if (!(await canView(token, uid, path))) return new Response('not found', { status: 404, headers: h })
      const obj = await env.MEDIA.get(path)
      if (!obj) return new Response('not found', { status: 404, headers: h })
      return new Response(obj.body, {
        headers: { ...h, 'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream', 'Cache-Control': 'private, no-store' },
      })
    }

    if (req.method === 'DELETE') {
      // 내가 올린 파일, 또는 지워진 메시지의 파일(정리 목록에 있는 것)만
      const mine = m[1] === uid
      const pending = mine ? true : await rpc('can_delete_pending', token, { p_path: path })
      if (!pending && !(await rpc('is_admin', token))) return new Response('forbidden', { status: 403, headers: h })
      await env.MEDIA.delete(path)
      await rpc('ack_media_delete', token, { p_path: path })
      return new Response('ok', { headers: h })
    }

    return new Response('method', { status: 405, headers: h })
  },
}
