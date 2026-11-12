import { useMemo, useState } from 'react'
import Avatar from '../components/Avatar'
import Sky from '../components/Sky'
import Sheet from '../components/Sheet'
import { STATUSES, isOnline, statusOf, type Profile } from '../types'

type Props = {
  me: Profile
  profiles: Profile[]
  now: number
  onChangeStatus: (status: string) => void
  onGreet: (p: Profile) => void
}

const GOLDEN = 2.39996

function timeAgo(iso: string, now: number) {
  const m = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

export default function Plaza({ me, profiles, now, onChangeStatus, onGreet }: Props) {
  const [selected, setSelected] = useState<Profile | null>(null)
  const [statusOpen, setStatusOpen] = useState(false)

  // 나를 가운데, 접속 중인 친구를 안쪽부터 배치
  const placed = useMemo(() => {
    const others = profiles
      .filter((p) => p.id !== me.id)
      .sort((a, b) => Number(isOnline(b, now)) - Number(isOnline(a, now)) || a.created_at.localeCompare(b.created_at))
    const list = [me, ...others]
    const n = list.length
    return list
      .map((p, i) => {
        const r = n === 1 ? 0 : Math.sqrt((i + 0.35) / n)
        const t = i * GOLDEN
        return { p, x: 50 + r * Math.cos(t) * 36, y: 50 + r * Math.sin(t) * 30, delay: (i * 0.37) % 2.8 }
      })
      .sort((a, b) => a.y - b.y)
  }, [profiles, me, now])

  const n = placed.length
  const size = n <= 5 ? 66 : n <= 10 ? 54 : n <= 16 ? 44 : 36
  const compact = n > 8
  const onlineCount = profiles.filter((p) => isOnline(p, now)).length
  const myStatus = statusOf(me.status)
  const sel = selected ? profiles.find((p) => p.id === selected.id) ?? selected : null

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <Sky />

      <header className="relative z-10 flex items-center justify-between px-5 pt-5">
        <div>
          <h1 className="font-cute text-2xl leading-tight">우리 광장</h1>
          <p className="text-sm text-ink-soft">
            {profiles.length}명 · <span className="text-[#3DBE7A]">● </span>
            {onlineCount}명 접속 중
          </p>
        </div>
        <button
          onClick={() => setStatusOpen(true)}
          className="squish flex items-center gap-1.5 rounded-full border-2 border-white bg-white/80 px-3.5 py-2 text-sm shadow-sm"
        >
          <span className="text-base">{myStatus.icon}</span>
          {myStatus.label}
          <span className="text-ink-soft">▾</span>
        </button>
      </header>

      {/* 광장 섬 */}
      <div className="relative flex-1">
        <div className="absolute inset-x-[-10%] bottom-[2%] top-[22%] rounded-[50%] bg-gradient-to-b from-[#C9EFC9] to-[#A9DFAE] shadow-[0_18px_0_#93CF9A,0_30px_40px_rgba(90,140,100,0.25)]" />
        <div className="absolute inset-x-[4%] bottom-[10%] top-[30%] rounded-[50%] border-[3px] border-dashed border-white/50" />
        <span className="absolute left-[8%] top-[34%] text-2xl">🌷</span>
        <span className="absolute right-[9%] top-[40%] text-2xl">🌳</span>
        <span className="absolute bottom-[12%] left-[14%] text-xl">🍄</span>
        <span className="absolute bottom-[8%] right-[18%] text-xl">🌼</span>

        <div className="absolute inset-x-0 bottom-[6%] top-[20%]">
          {placed.map(({ p, x, y, delay }) => {
            const online = isOnline(p, now)
            const st = statusOf(p.status)
            const isMe = p.id === me.id
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="pop absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={{ left: `${x}%`, top: `${y}%`, zIndex: Math.round(y) }}
                aria-label={`${p.nickname} 프로필`}
              >
                <span className="mb-1 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-xs shadow-sm">
                  {st.icon}
                  {!compact && <span className="ml-1">{st.label}</span>}
                </span>
                <span className="bob" style={{ animationDelay: `-${delay}s`, opacity: online || isMe ? 1 : 0.6 }}>
                  <Avatar emoji={p.emoji} color={p.color} size={size} sleeping={p.status === 'sleep'} />
                </span>
                <span
                  className={`mt-0.5 flex max-w-[90px] items-center gap-1 truncate rounded-full px-2 py-0.5 text-xs ${
                    isMe ? 'bg-accent text-white' : 'bg-white/90'
                  }`}
                >
                  <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${online ? 'bg-[#3DBE7A]' : 'bg-[#C9C3D6]'}`} />
                  <span className="truncate">{isMe ? '나' : p.nickname}</span>
                </span>
              </button>
            )
          })}
        </div>

        {n === 1 && (
          <p className="absolute inset-x-0 top-[6%] text-center text-sm text-ink-soft">
            아직 아무도 없어요. 친구에게 링크와 입장 코드를 보내 주세요!
          </p>
        )}
      </div>

      {sel && (
        <Sheet onClose={() => setSelected(null)}>
          <div className="flex flex-col items-center gap-3 pb-4">
            <Avatar emoji={sel.emoji} color={sel.color} size={84} />
            <div className="text-center">
              <h2 className="font-cute text-2xl">{sel.id === me.id ? `${sel.nickname} (나)` : sel.nickname}</h2>
              <p className="mt-1 text-ink-soft">
                {statusOf(sel.status).icon} {statusOf(sel.status).label}
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                {isOnline(sel, now) ? '🟢 지금 접속 중' : `마지막 접속 ${timeAgo(sel.last_seen, now)}`}
              </p>
            </div>
            {sel.id !== me.id && (
              <button
                onClick={() => {
                  onGreet(sel)
                  setSelected(null)
                }}
                className="squish mt-2 w-full rounded-2xl bg-accent py-3.5 font-cute text-lg text-white shadow-[0_4px_0_var(--color-accent-deep)]"
              >
                채팅방에서 인사하기 👋
              </button>
            )}
          </div>
        </Sheet>
      )}

      {statusOpen && (
        <Sheet onClose={() => setStatusOpen(false)}>
          <h2 className="mb-3 text-center font-cute text-xl">지금 나는…</h2>
          <div className="grid grid-cols-3 gap-2 pb-4">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  onChangeStatus(s.id)
                  setStatusOpen(false)
                }}
                className={`squish flex flex-col items-center gap-1 rounded-2xl py-3 ${
                  s.id === me.status ? 'bg-white shadow-[0_0_0_3px_var(--color-accent)]' : 'bg-white/70'
                }`}
              >
                <span className="text-2xl">{s.icon}</span>
                <span className="text-sm">{s.label}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  )
}
