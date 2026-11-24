import { supabase } from './supabase'
import { MEDIA_URL } from './config'

export const BUCKET = 'chat-images'

// 올리기 전에 긴 변 1600px, JPEG로 줄여서 무료 용량 절약 (보통 장당 200~400KB)
export async function compressImage(file: File): Promise<Blob> {
  if (file.type === 'image/gif') {
    if (file.size > 5 * 1024 * 1024) throw new Error('too_big')
    return file
  }
  const bmp = await createImageBitmap(file)
  const max = 1600
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82))
  if (!blob) throw new Error('compress_failed')
  return blob
}

export const MAX_VIDEO_MB = MEDIA_URL ? 300 : 50
const VIDEO_EXT: Record<string, string> = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/3gpp': '3gp' }
// 휴대폰에서 형식 정보가 비어 오거나 다른 이름으로 올 때 파일 확장자로 판단
const EXT_TYPE: Record<string, string> = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', qt: 'video/quicktime', webm: 'video/webm', '3gp': 'video/3gpp' }
export function videoType(f: File): string | null {
  const t = (f.type || '').toLowerCase()
  if (VIDEO_EXT[t]) return t
  if (t === 'video/x-m4v') return 'video/mp4'
  const ext = (f.name.split('.').pop() || '').toLowerCase()
  if ((t === '' || t.startsWith('video/') || t === 'application/octet-stream') && EXT_TYPE[ext]) return EXT_TYPE[ext]
  return null
}
export const isVideoPath = (path: string) => /\.(mp4|mov|webm|3gp)$/i.test(path)
export const isVideoFile = (f: File) => f.type.startsWith('video/') || (!f.type.startsWith('image/') && !!videoType(f))
const isR2 = (path: string) => path.includes('/r2/')
export type Progress = (ratio: number) => void

/** 올리기 실패 이유를 사람 말로 */
export function uploadErrorText(err: unknown, video: boolean): string {
  const m = String((err as Error)?.message || err)
  const what = video ? '동영상' : '사진'
  if (/too_big|_413/.test(m)) return `${what}이 너무 커요. (동영상은 ${MAX_VIDEO_MB}MB까지)`
  if (/video_type|_415/.test(m)) return 'mp4·mov·webm 동영상만 보낼 수 있어요.'
  if (/_401/.test(m)) return '로그인이 만료됐어요. 새로고침 후 다시 보내 주세요.'
  if (/network|timeout|Failed to fetch/i.test(m)) return `인터넷 연결이 끊겨서 ${what}을 못 올렸어요. 와이파이에서 다시 시도해 보세요.`
  return `${what} 전송에 실패했어요. 다시 시도해 주세요.`
}

async function token() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

/** XHR로 올리기 (진행률 표시용, fetch는 올리는 진행률을 못 알려줌) */
function xhr(method: string, url: string, body: Blob | null, headers: Record<string, string>, onProgress?: (loaded: number) => void) {
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const x = new XMLHttpRequest()
    x.open(method, url)
    for (const [k, v] of Object.entries(headers)) x.setRequestHeader(k, v)
    if (onProgress) x.upload.onprogress = (e) => onProgress(e.loaded)
    x.onload = () => resolve({ status: x.status, text: x.responseText })
    x.onerror = () => reject(new Error('network'))
    x.ontimeout = () => reject(new Error('timeout'))
    x.send(body)
  })
}

const CHUNK = 10 * 1024 * 1024 // 큰 동영상은 10MB 조각으로

/** Cloudflare R2 (Worker 경유)로 올리기: 경로 <내 id>/r2/<무작위>.<확장자> */
async function putR2(userId: string, body: Blob, ext: string, type: string, onProgress?: Progress) {
  const path = `${userId}/r2/${crypto.randomUUID()}.${ext}`
  const url = `${MEDIA_URL}/${path}`
  const auth = { Authorization: `Bearer ${await token()}` }
  if (body.size <= CHUNK * 2) {
    const r = await xhr('PUT', url, body, { ...auth, 'Content-Type': type }, (l) => onProgress?.(l / body.size))
    if (r.status !== 200) throw new Error(`upload_${r.status}`)
    return path
  }
  // 나눠 올리기: 만들기 → 조각마다 올리기(실패하면 3번까지 다시) → 합치기
  const c = await fetch(`${url}?mpu=create`, { method: 'POST', headers: { ...auth, 'Content-Type': type, 'X-Total-Size': String(body.size) } })
  if (!c.ok) throw new Error(`upload_${c.status}`)
  const { uploadId } = await c.json()
  const parts: { partNumber: number; etag: string }[] = []
  let done = 0
  try {
    for (let i = 0, n = 1; i < body.size; i += CHUNK, n++) {
      const piece = body.slice(i, i + CHUNK)
      let ok = false
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        try {
          const r = await xhr('PUT', `${url}?mpu=part&uploadId=${encodeURIComponent(uploadId)}&part=${n}`, piece, { Authorization: `Bearer ${await token()}` }, (l) =>
            onProgress?.((done + l) / body.size),
          )
          if (r.status !== 200) throw new Error(`upload_${r.status}`)
          parts.push(JSON.parse(r.text))
          ok = true
        } catch (e) {
          if (attempt === 2) throw e
          await new Promise((res) => setTimeout(res, 1500))
        }
      }
      done += piece.size
    }
    const f = await fetch(`${url}?mpu=complete&uploadId=${encodeURIComponent(uploadId)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts }),
    })
    if (!f.ok) throw new Error(`upload_${f.status}`)
    return path
  } catch (e) {
    fetch(`${url}?mpu=abort&uploadId=${encodeURIComponent(uploadId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${await token()}` } }).catch(() => {})
    throw e
  }
}

/** 파일 지우기 (R2 또는 Supabase 저장소) */
export async function deleteMedia(path: string) {
  urlCache.delete(path)
  if (isR2(path)) {
    if (!MEDIA_URL) return false
    const r = await fetch(`${MEDIA_URL}/${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${await token()}` } })
    return r.ok
  }
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  return !error
}

export async function uploadImage(userId: string, file: File, onProgress?: Progress): Promise<string> {
  // 동영상은 그대로 올림 (R2: 최대 300MB, 큰 파일은 나눠서)
  if (isVideoFile(file)) {
    const type = videoType(file)
    if (!type) throw new Error('video_type')
    const ext = VIDEO_EXT[type]
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) throw new Error('too_big')
    if (MEDIA_URL) return putR2(userId, file, ext, type, onProgress)
    const path = `${userId}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: type, upsert: false })
    if (error) throw error
    return path
  }
  const blob = await compressImage(file)
  const ext = blob.type === 'image/gif' ? 'gif' : 'jpg'
  if (MEDIA_URL) return putR2(userId, blob, ext, blob.type || 'image/jpeg', onProgress)
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false })
  if (error) throw error
  return path
}

// 비공개 사진이라 하루짜리 임시 주소를 받아서 보여줌 (같은 사진은 한 번만 요청)
const urlCache = new Map<string, Promise<string | null>>()
const urlTime = new Map<string, number>()
export function imageUrl(path: string) {
  // Supabase 임시 주소는 10분짜리라 8분 지나면 새로 받음
  if ((!isR2(path) || isVideoPath(path)) && Date.now() - (urlTime.get(path) ?? 0) > 8 * 60_000) urlCache.delete(path)
  let p = urlCache.get(path)
  if (!p) {
    p = isR2(path)
      ? // R2: 로그인 토큰으로 받아서 이 기기 메모리에서만 보여줌 (주소를 복사해도 남은 못 봄)
        (async () => {
          if (!MEDIA_URL) return null
          // 동영상: 10분짜리 서명 주소로 바로 스트리밍 (전체를 내려받지 않음)
          if (isVideoPath(path)) {
            const s = await fetch(`${MEDIA_URL}/${path}?sign`, { method: 'POST', headers: { Authorization: `Bearer ${await token()}` } })
            if (!s.ok) return null
            return (await s.json()).url as string
          }
          const r = await fetch(`${MEDIA_URL}/${path}`, { headers: { Authorization: `Bearer ${await token()}` } })
          if (!r.ok) return null
          return URL.createObjectURL(await r.blob())
        })().catch(() => null)
      : supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 60 * 10)
          .then((r) => r.data?.signedUrl ?? null)
    urlCache.set(path, p)
    urlTime.set(path, Date.now())
  }
  return p
}

// 지워진 메시지의 사진을 서버 목록에서 받아 실제 파일까지 삭제
// (내가 지운 것뿐 아니라 다른 사람이 지운 것, 자동 정리된 것도 포함)
let sweeping: Promise<void> | null = null
export function sweepDeletedImages() {
  if (sweeping) return sweeping
  sweeping = (async () => {
    try {
      const { data, error } = await supabase.rpc('list_pending_image_deletes')
      if (error) throw error
      const list = ((data as string[] | null) ?? []).filter(Boolean)
      if (!list.length) return
      list.forEach((p) => urlCache.delete(p))
      const r2 = list.filter(isR2)
      const local = list.filter((p) => !isR2(p))
      // R2 파일은 Worker가 지운 뒤 정리 목록에서 직접 뺌
      if (MEDIA_URL) await Promise.all(r2.map((p) => deleteMedia(p).catch(() => false)))
      if (local.length) {
        const { error: rmError } = await supabase.storage.from(BUCKET).remove(local)
        if (rmError) throw rmError
        await supabase.rpc('ack_image_deletes')
      }
    } catch (err) {
      console.error('사진 정리 실패', err)
    } finally {
      sweeping = null
    }
  })()
  return sweeping
}
