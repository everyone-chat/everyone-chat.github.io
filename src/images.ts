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

export const MAX_VIDEO_MB = MEDIA_URL ? 95 : 50
const VIDEO_EXT: Record<string, string> = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' }
export const isVideoPath = (path: string) => /\.(mp4|mov|webm)$/i.test(path)
export const isVideoFile = (f: File) => f.type.startsWith('video/')
const isR2 = (path: string) => path.includes('/r2/')

async function token() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

/** Cloudflare R2 (Worker 경유)로 올리기: 경로 <내 id>/r2/<무작위>.<확장자> */
async function putR2(userId: string, body: Blob, ext: string, type: string) {
  const path = `${userId}/r2/${crypto.randomUUID()}.${ext}`
  const r = await fetch(`${MEDIA_URL}/${path}`, { method: 'PUT', body, headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': type } })
  if (!r.ok) throw new Error(`upload_${r.status}`)
  return path
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

export async function uploadImage(userId: string, file: File): Promise<string> {
  // 동영상은 그대로 올림 (무료 플랜 파일 1개 최대 50MB)
  if (isVideoFile(file)) {
    const ext = VIDEO_EXT[file.type]
    if (!ext) throw new Error('video_type')
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) throw new Error('too_big')
    if (MEDIA_URL) return putR2(userId, file, ext, file.type)
    const path = `${userId}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
    if (error) throw error
    return path
  }
  const blob = await compressImage(file)
  const ext = blob.type === 'image/gif' ? 'gif' : 'jpg'
  if (MEDIA_URL) return putR2(userId, blob, ext, blob.type || 'image/jpeg')
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
  if (!isR2(path) && Date.now() - (urlTime.get(path) ?? 0) > 8 * 60_000) urlCache.delete(path)
  let p = urlCache.get(path)
  if (!p) {
    p = isR2(path)
      ? // R2: 로그인 토큰으로 받아서 이 기기 메모리에서만 보여줌 (주소를 복사해도 남은 못 봄)
        (async () => {
          if (!MEDIA_URL) return null
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
