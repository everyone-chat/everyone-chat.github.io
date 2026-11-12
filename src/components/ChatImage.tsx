import { useEffect, useState } from 'react'
import { imageUrl } from '../images'

export function useImageUrl(path: string) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    imageUrl(path).then((u) => {
      if (!alive) return
      if (u) setUrl(u)
      else setFailed(true)
    })
    return () => {
      alive = false
    }
  }, [path])
  return { url, failed }
}

/** 채팅 속 사진: 항상 흐리게 가려 두고, 눌러야 크게 보임 */
export default function ChatImage({ path, onOpen }: { path: string; onOpen: (url: string) => void }) {
  const { url, failed } = useImageUrl(path)

  if (failed) return <div className="grid h-32 w-48 place-items-center rounded-2xl bg-white/70 text-xs text-ink-soft">사진을 불러올 수 없어요</div>
  if (!url) return <div className="h-40 w-48 animate-pulse rounded-2xl bg-white/70" />

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen(url)
      }}
      className="relative block overflow-hidden rounded-2xl border-2 border-white shadow-sm"
      aria-label="사진 보기"
    >
      <img src={url} alt="" loading="lazy" draggable={false} className="block h-40 w-48 scale-110 object-cover blur-xl" />
      <span className="absolute inset-0 grid place-items-center bg-white/25">
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs text-ink shadow-sm">🙈 눌러서 보기</span>
      </span>
    </button>
  )
}

/** 사진 모아보기 칸 (흐리게, 누르면 크게) */
export function GalleryThumb({ path, onOpen, reveal }: { path: string; onOpen: (url: string) => void; reveal: boolean }) {
  const { url, failed } = useImageUrl(path)
  return (
    <button
      type="button"
      disabled={!url}
      onClick={() => url && onOpen(url)}
      className="relative aspect-square overflow-hidden rounded-xl bg-white/70"
      aria-label="사진 크게 보기"
    >
      {failed ? (
        <span className="text-[10px] text-ink-soft">불러올 수 없음</span>
      ) : url ? (
        <img src={url} alt="" loading="lazy" draggable={false} className={`h-full w-full object-cover ${reveal ? '' : 'scale-110 blur-lg'}`} />
      ) : (
        <span className="block h-full w-full animate-pulse" />
      )}
    </button>
  )
}
