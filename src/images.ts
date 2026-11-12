import { supabase } from './supabase'

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

export async function uploadImage(userId: string, file: File): Promise<string> {
  const blob = await compressImage(file)
  const ext = blob.type === 'image/gif' ? 'gif' : 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false })
  if (error) throw error
  return path
}

// 비공개 사진이라 하루짜리 임시 주소를 받아서 보여줌 (같은 사진은 한 번만 요청)
const urlCache = new Map<string, Promise<string | null>>()
export function imageUrl(path: string) {
  let p = urlCache.get(path)
  if (!p) {
    p = supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24)
      .then((r) => r.data?.signedUrl ?? null)
    urlCache.set(path, p)
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
      const { error: rmError } = await supabase.storage.from(BUCKET).remove(list)
      if (rmError) throw rmError
      await supabase.rpc('ack_image_deletes')
    } catch (err) {
      console.error('사진 정리 실패', err)
    } finally {
      sweeping = null
    }
  })()
  return sweeping
}
