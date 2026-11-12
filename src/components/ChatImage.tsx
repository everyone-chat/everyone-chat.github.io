import { useEffect, useState } from 'react'
import { imageUrl } from '../images'

export default function ChatImage({ path, onOpen }: { path: string; onOpen: (url: string) => void }) {
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

  if (failed) return <div className="grid h-32 w-48 place-items-center rounded-2xl bg-white/70 text-xs text-ink-soft">사진을 불러올 수 없어요</div>
  if (!url) return <div className="h-40 w-48 animate-pulse rounded-2xl bg-white/70" />

  return (
    <img
      src={url}
      alt="보낸 사진"
      loading="lazy"
      onClick={(e) => {
        e.stopPropagation()
        onOpen(url)
      }}
      className="max-h-64 max-w-full cursor-zoom-in rounded-2xl border-2 border-white object-cover shadow-sm"
    />
  )
}
