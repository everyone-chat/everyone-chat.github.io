import Avatar from '../components/Avatar'
import { isOnline, type Message, type Profile } from '../types'

type Props = {
  friends: Profile[]
  lastByPeer: Map<string, Message>
  unread: Record<string, number>
  now: number
  onOpen: (peerId: string) => void
  onAddFriend: () => void
}

function when(iso: string, now: number) {
  const d = new Date(iso)
  const today = new Date(now).toDateString() === d.toDateString()
  return today
    ? d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
}

export default function ChatList({ friends, lastByPeer, unread, now, onOpen, onAddFriend }: Props) {
  const sorted = [...friends].sort((a, b) => {
    const la = lastByPeer.get(a.id)?.id ?? 0
    const lb = lastByPeer.get(b.id)?.id ?? 0
    return lb - la || a.nickname.localeCompare(b.nickname)
  })

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#E6F3FF] to-[#FFF4F8]">
      <header className="border-b border-white/70 bg-white/60 px-5 pb-3 pt-5 backdrop-blur">
        <h1 className="font-cute text-2xl leading-tight">채팅</h1>
        <p className="text-sm text-ink-soft">친구와 1:1로 대화해요</p>
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto px-3 py-3">
        {sorted.length === 0 && (
          <div className="py-16 text-center text-ink-soft">
            <div className="mb-2 text-4xl">🤝</div>
            아직 친구가 없어요.
            <br />
            <button onClick={onAddFriend} className="squish mt-4 rounded-2xl bg-accent px-5 py-2.5 font-cute text-white">
              친구 코드로 추가하기
            </button>
          </div>
        )}
        {sorted.map((f) => {
          const last = lastByPeer.get(f.id)
          const n = unread[f.id] ?? 0
          return (
            <button
              key={f.id}
              onClick={() => onOpen(f.id)}
              className="squish mb-2 flex w-full items-center gap-3 rounded-3xl bg-white/80 px-3 py-2.5 text-left shadow-sm"
            >
              <div className="relative">
                <Avatar look={f.emoji} color={f.color} size={46} headOnly />
                <span
                  className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                    isOnline(f, now) ? 'bg-[#3DBE7A]' : 'bg-[#C9C3D6]'
                  }`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-cute text-base">{f.nickname}</span>
                  {last && <span className="shrink-0 text-[11px] text-ink-soft">{when(last.created_at, now)}</span>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-ink-soft">
                    {last ? (last.content || '📷 사진') : '아직 대화가 없어요'}
                  </span>
                  {n > 0 && (
                    <span className="shrink-0 rounded-full bg-accent-deep px-1.5 text-[11px] leading-5 text-white">{n > 99 ? '99+' : n}</span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
