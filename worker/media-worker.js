// =========================================================
// 모두의채팅 사진·동영상 저장소 (Cloudflare Worker + R2, 무료 10GB)
//   주소: https://media.everyone-chat-app.workers.dev  /  R2 바인딩: MEDIA → everyone-chat-media
//
// - 누가 어떤 파일을 볼 수 있나: 사용자의 로그인 토큰으로 Supabase에 물어봐서 결정 (그 대화의 두 사람만)
// - 큰 동영상: 10MB 조각으로 나눠 올림 (Worker 요청 1개 100MB 한도를 넘어도 됨, 최대 300MB)
// - 동영상 재생: 10분짜리 서명 주소를 받아 <video>가 바로 스트리밍(앞부분부터 재생, 건너뛰기 가능)
//   서명용 비밀값은 처음 실행할 때 Worker가 직접 만들어 R2에 보관 (사람이 다룰 키 없음)
// =========================================================

const SUPABASE_URL = 'https://uzzyadqvshwtrqsaexbr.supabase.co'
const SUPABASE_KEY = 'sb_publishable_eBXn4fB7b4fVbDQU9G6HGQ_erdnV2jq' // 공개용 키
const ORIGINS = ['https://everyone-chat.github.io', 'http://localhost:5173']
const MAX_BYTES = 95 * 1024 * 1024 // 요청 1개 크기 (무료 플랜 100MB 안쪽)
const MAX_TOTAL = 300 * 1024 * 1024 // 동영상 1개 최대
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp']
const PATH_RE = /^([0-9a-f-]{36})\/r2\/[0-9a-f-]{36}\.(jpg|png|webp|gif|mp4|mov|webm|3gp)$/
const SECRET_KEY = '_system/sign-secret'

function cors(req) {
  const o = req.headers.get('Origin') || ''
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Total-Size',
    'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}
const json = (d, h, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...h, 'Content-Type': 'application/json' } })

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
  return r.text().then((t) => { try { return JSON.parse(t) } catch { return null } })
}

async function canView(token, uid, path) {
  if (path.startsWith(uid + '/')) return true
  const r = await sb('/rest/v1/messages?select=id&limit=1&image_path=eq.' + encodeURIComponent(path), token)
  if (!r.ok) return false
  return (await r.json()).length > 0
}

// ---------- 서명 주소 (동영상 스트리밍용) ----------
let secretCache = null
async function secret(env) {
  if (secretCache) return secretCache
  let obj = await env.MEDIA.get(SECRET_KEY)
  let raw
  if (obj) raw = new Uint8Array(await obj.arrayBuffer())
  else {
    raw = crypto.getRandomValues(new Uint8Array(32))
    await env.MEDIA.put(SECRET_KEY, raw)
  }
  secretCache = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
  return secretCache
}
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
async function sign(env, path, exp) {
  const key = await secret(env)
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(path + '|' + exp)))
}

export default {
  async fetch(req, env) {
    const h = cors(req)
    if (req.method === 'OPTIONS') return new Response(null, { headers: h })
    const url = new URL(req.url)
    const path = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    const m = path.match(PATH_RE)
    if (!m) return new Response('bad path', { status: 400, headers: h })
    const q = url.searchParams

    // 서명 주소로 재생 (로그인 토큰 대신 10분짜리 서명)
    if (req.method === 'GET' && q.has('sig')) {
      const exp = Number(q.get('exp'))
      if (!exp || exp < Date.now() / 1000) return new Response('expired', { status: 403, headers: h })
      if ((await sign(env, path, exp)) !== q.get('sig')) return new Response('forbidden', { status: 403, headers: h })
      const range = req.headers.get('Range')
      const obj = await env.MEDIA.get(path, range ? { range: req.headers } : undefined)
      if (!obj) return new Response('not found', { status: 404, headers: h })
      const headers = new Headers(h)
      obj.writeHttpMetadata(headers)
      headers.set('Accept-Ranges', 'bytes')
      headers.set('Cache-Control', 'private, max-age=600')
      if (range && obj.range) {
        const start = obj.range.offset ?? 0
        const len = obj.range.length ?? obj.size - start
        headers.set('Content-Range', `bytes ${start}-${start + len - 1}/${obj.size}`)
        headers.set('Content-Length', String(len))
        return new Response(obj.body, { status: 206, headers })
      }
      headers.set('Content-Length', String(obj.size))
      return new Response(obj.body, { headers })
    }

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return new Response('login required', { status: 401, headers: h })
    const uid = await userId(token)
    if (!uid) return new Response('login required', { status: 401, headers: h })
    const mine = m[1] === uid

    // 서명 주소 받기
    if (req.method === 'POST' && q.has('sign')) {
      if (!(await canView(token, uid, path))) return new Response('not found', { status: 404, headers: h })
      const exp = Math.floor(Date.now() / 1000) + 600
      return json({ url: `${url.origin}/${path}?exp=${exp}&sig=${await sign(env, path, exp)}`, exp }, h)
    }

    // 큰 파일 나눠 올리기
    if (q.has('mpu')) {
      if (!mine) return new Response('forbidden', { status: 403, headers: h })
      const step = q.get('mpu')
      if (req.method === 'POST' && step === 'create') {
        if (!(await rpc('is_member', token))) return new Response('forbidden', { status: 403, headers: h })
        const type = (req.headers.get('Content-Type') || '').split(';')[0]
        if (!TYPES.includes(type)) return new Response('type', { status: 415, headers: h })
        const total = Number(req.headers.get('X-Total-Size') || 0)
        if (!total || total > MAX_TOTAL) return new Response('too big', { status: 413, headers: h })
        const up = await env.MEDIA.createMultipartUpload(path, { httpMetadata: { contentType: type } })
        return json({ uploadId: up.uploadId }, h)
      }
      const uploadId = q.get('uploadId')
      if (!uploadId) return new Response('bad', { status: 400, headers: h })
      const up = env.MEDIA.resumeMultipartUpload(path, uploadId)
      if (req.method === 'PUT' && step === 'part') {
        const n = Number(q.get('part'))
        if (!n || n > 1000) return new Response('bad', { status: 400, headers: h })
        const part = await up.uploadPart(n, req.body)
        return json({ partNumber: part.partNumber, etag: part.etag }, h)
      }
      if (req.method === 'POST' && step === 'complete') {
        const { parts } = await req.json()
        const obj = await up.complete(parts)
        if (obj.size > MAX_TOTAL) {
          await env.MEDIA.delete(path)
          return new Response('too big', { status: 413, headers: h })
        }
        return json({ ok: true, size: obj.size }, h)
      }
      if (req.method === 'DELETE' && step === 'abort') {
        await up.abort().catch(() => {})
        return json({ ok: true }, h)
      }
      return new Response('method', { status: 405, headers: h })
    }

    if (req.method === 'PUT') {
      if (!mine) return new Response('forbidden', { status: 403, headers: h })
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
      const pending = mine ? true : await rpc('can_delete_pending', token, { p_path: path })
      if (!pending && !(await rpc('is_admin', token))) return new Response('forbidden', { status: 403, headers: h })
      await env.MEDIA.delete(path)
      await rpc('ack_media_delete', token, { p_path: path })
      return new Response('ok', { headers: h })
    }

    return new Response('method', { status: 405, headers: h })
  },
}
