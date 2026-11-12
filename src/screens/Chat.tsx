import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Avatar from '../components/Avatar'
import type { Message, Profile } from '../types'

type Props = {
  me: Profile
  profileMap: Map<string, Profile>
  messages: Message[]
  onlineCount: number
  loading: boolean
  draft: string
  onDraftChange: (v: string) => void
  onSend: (text: string) => Promise<boolean>
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
const dayKey = (iso: string) => new Date(iso).toDateString()

export default function Chat({ me, profileMap, messages, onlineCount, loading, draft, onDraftChange, onSend }: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const nearBottom = useRef(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  // 새 메시지가 오면 맨 아래로 (위로 스크롤해서 읽는 중이면 그대로 둠)
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    const last = messages[messages.length - 1]
    if (nearBottom.current || last?.user_id === me.id) el.scrollTop = el.scrollHeight
  }, [messages, me.id])

  useEffect(() => {
    if (draft) inputRef.current?.focus()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setError('')
    const ok = await onSend(text)
    setSending(false)
    if (ok) {
      onDraftChange('')
      inputRef.current?.focus()
    } else setError('전송에 실패했어요. 다시 시도해 주세요.')
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#E6F3FF] to-[#FFF4F8]">
      <header className="flex items-center justify-between border-b border-white/70 bg-white/60 px-5 pb-3 pt-5 backdrop-blur">
        <div>
          <h1 className="font-cute text-2xl leading-tight">모두의 채팅방</h1>
          <p className="text-sm text-ink-soft">
            <span className="text-[#3DBE7A]">● </span>
            {onlineCount}명 접속 중
          </p>
        </div>
        <span className="text-3xl">💬</span>
      </header>

      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
        }}
        className="no-scrollbar flex-1 overflow-y-auto px-4 py-4"
      >
        {loading && <p className="py-10 text-center text-sm text-ink-soft">대화를 불러오는 중…</p>}
        {!loading && messages.length === 0 && (
          <div className="py-16 text-center text-ink-soft">
            <div className="mb-2 text-4xl">🐣</div>
            첫 인사를 남겨 보세요!
          </div>
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1]
          const next = messages[i + 1]
          const author = profileMap.get(m.user_id)
          const mine = m.user_id === me.id
          const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at)
          const grouped = !newDay && prev?.user_id === m.user_id
          const showTime =
            !next || next.user_id !== m.user_id || fmtTime(next.created_at) !== fmtTime(m.created_at) || dayKey(next.created_at) !== dayKey(m.created_at)

          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs text-ink-soft">{fmtDate(m.created_at)}</span>
                </div>
              )}
              <div className={`flex items-end gap-2 ${mine ? 'justify-end' : ''} ${grouped ? 'mt-1' : 'mt-3'}`}>
                {!mine && (
                  <div className="w-9 shrink-0 self-start">
                    {!grouped && <Avatar look={author?.emoji ?? ''} color={author?.color ?? '#eee'} size={36} headOnly />}
                  </div>
                )}
                <div className={`flex max-w-[75%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  {!mine && !grouped && <span className="mb-1 ml-1 text-xs text-ink-soft">{author?.nickname ?? '(나간 친구)'}</span>}
                  <div className={`flex items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
                    <p
                      className={`whitespace-pre-wrap break-words px-3.5 py-2 text-[15px] leading-snug shadow-sm ${
                        mine ? 'rounded-[20px] rounded-br-md text-ink' : 'rounded-[20px] rounded-bl-md bg-white'
                      }`}
                      style={mine ? { background: me.color } : undefined}
                    >
                      {m.content}
                    </p>
                    {showTime && <span className="shrink-0 text-[11px] text-ink-soft">{fmtTime(m.created_at)}</span>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <form onSubmit={submit} className="border-t border-white/70 bg-white/70 px-3 py-2.5 backdrop-blur">
        {error && <p className="mb-1.5 px-2 text-xs text-accent-deep">{error}</p>}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            maxLength={500}
            placeholder="메시지 보내기"
            enterKeyHint="send"
            className="min-w-0 flex-1 rounded-full border-2 border-white bg-white px-4 py-2.5 text-base outline-none focus:border-accent"
          />
          <button
            disabled={!draft.trim() || sending}
            className="squish grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-lg text-white shadow-[0_3px_0_var(--color-accent-deep)] disabled:opacity-40"
            aria-label="보내기"
          >
            ➤
          </button>
        </div>
      </form>
    </div>
  )
}
