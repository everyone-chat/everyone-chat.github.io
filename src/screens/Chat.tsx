import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Avatar from '../components/Avatar'
import ChatImage from '../components/ChatImage'
import { isOnline, type Message, type Profile } from '../types'

type Props = {
  me: Profile
  profileMap: Map<string, Profile>
  messages: Message[]
  peer: Profile
  now: number
  onBack: () => void
  loading: boolean
  draft: string
  onDraftChange: (v: string) => void
  onSend: (text: string, file: File | null) => Promise<boolean>
  onDelete: (id: number) => Promise<boolean>
  onClearAll: () => Promise<boolean>
  /** 상대가 읽은 마지막 메시지 번호 (이보다 큰 내 메시지는 '1' 표시) */
  peerReadId: number
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
const dayKey = (iso: string) => new Date(iso).toDateString()

export default function Chat({ me, profileMap, messages, peer, now, onBack, loading, draft, onDraftChange, onSend, onDelete, onClearAll, peerReadId }: Props) {
  // 상대가 어디까지 읽었나: 읽음 기록 + 상대가 답장을 보냈으면 그 앞 메시지는 당연히 읽은 것
  let readUpTo = peerReadId
  for (const m of messages) if (m.user_id === peer.id && m.id > readUpTo) readUpTo = m.id
  // 내 메시지 중 상대가 읽은 마지막 것 → 그 아래에만 "읽음" 표시
  let lastReadMine = 0
  for (const m of messages) if (m.user_id === me.id && m.id <= readUpTo) lastReadMine = m.id
  const [menuId, setMenuId] = useState<number | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [viewer, setViewer] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // 꾹 누르기(0.5초) → 삭제 메뉴. 꾹 누른 직후의 클릭(사진 크게 보기 등)은 무시
  const pressTimer = useRef<number | null>(null)
  const pressStart = useRef<{ x: number; y: number } | null>(null)
  const longPressed = useRef(false)
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current)
    pressTimer.current = null
    pressStart.current = null
  }
  const pressProps = (id: number, can: boolean) =>
    can
      ? {
          onPointerDown: (e: React.PointerEvent) => {
            longPressed.current = false
            if (e.pointerType === 'mouse') return
            pressStart.current = { x: e.clientX, y: e.clientY }
            pressTimer.current = window.setTimeout(() => {
              longPressed.current = true
              navigator.vibrate?.(15)
              setMenuId(id)
            }, 500)
          },
          onPointerMove: (e: React.PointerEvent) => {
            const p = pressStart.current
            if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) cancelPress()
          },
          onPointerUp: cancelPress,
          onPointerCancel: cancelPress,
          onPointerLeave: cancelPress,
          onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
          onClickCapture: (e: React.MouseEvent) => {
            if (longPressed.current) {
              e.stopPropagation()
              e.preventDefault()
              longPressed.current = false
            }
          },
        }
      : {}

  useEffect(() => {
    if (!file) return setPreview(null)
    const u = URL.createObjectURL(file)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
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

  // 자판이 열리거나 닫혀서 대화 칸 높이가 바뀌면, 아래를 보고 있던 경우 계속 맨 아래로
  useEffect(() => {
    const el = listRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (nearBottom.current) el.scrollTop = el.scrollHeight
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (draft) inputRef.current?.focus()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if ((!text && !file) || sending) return
    setSending(true)
    setError('')
    const ok = await onSend(text, file)
    setSending(false)
    if (ok) {
      onDraftChange('')
      setFile(null)
      inputRef.current?.focus()
    } else setError(file ? '사진 전송에 실패했어요. 다시 시도해 주세요.' : '전송에 실패했어요. 다시 시도해 주세요.')
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#E6F3FF] to-[#FFF4F8]">
      <header className="flex items-center justify-between border-b border-white/70 bg-white/60 px-5 pb-3 pt-5 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={onBack} className="squish -ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-2xl" aria-label="뒤로">
            ‹
          </button>
          <Avatar look={peer.emoji} color={peer.color} size={40} headOnly />
          <div className="min-w-0">
            <h1 className="truncate font-cute text-xl leading-tight">{peer.nickname}</h1>
            <p className="text-xs text-ink-soft">{isOnline(peer, now) ? <><span className="text-[#3DBE7A]">● </span>접속 중</> : '오프라인'}</p>
          </div>
        </div>
        {me.is_admin ? (
          <button
            onClick={async () => {
              if (!confirmClear) {
                setConfirmClear(true)
                setTimeout(() => setConfirmClear(false), 4000)
                return
              }
              setConfirmClear(false)
              const ok = await onClearAll()
              if (!ok) setError('전체 삭제에 실패했어요.')
            }}
            className={`squish rounded-full px-3 py-2 text-xs ${confirmClear ? 'bg-[#E25A6A] text-white' : 'bg-white text-[#E25A6A]'}`}
          >
            {confirmClear ? '정말 전부 지울까요? 한 번 더' : '🗑 대화 비우기'}
          </button>
        ) : null}
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
                  {!mine && !grouped && <span className="mb-1 ml-1 text-xs text-ink-soft">{author?.nickname ?? '(알 수 없음)'}</span>}
                  <div className={`flex items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
                    <div
                      {...pressProps(m.id, mine || me.is_admin)}
                      onClick={(e) => {
                        // PC: 클릭으로 메뉴, 휴대폰: 꾹 누르기로 메뉴
                        if ((mine || me.is_admin) && (e.nativeEvent as PointerEvent).pointerType !== 'touch') setMenuId(menuId === m.id ? null : m.id)
                      }}
                      className={`no-callout flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}
                    >
                    {m.image_path && <ChatImage path={m.image_path} onOpen={setViewer} />}
                    {m.content && (
                    <p
                      className={`whitespace-pre-wrap break-words px-3.5 py-2 text-[15px] leading-snug shadow-sm ${
                        mine || me.is_admin ? 'cursor-pointer' : ''
                      } ${
                        mine ? 'rounded-[20px] rounded-br-md text-ink' : 'rounded-[20px] rounded-bl-md bg-white'
                      }`}
                      style={mine ? { background: me.color } : undefined}
                    >
                      {m.content}
                    </p>
                    )}
                    </div>
                    <span className={`flex shrink-0 flex-col text-[11px] leading-tight ${mine ? 'items-end' : 'items-start'}`}>
                      {mine && m.id > readUpTo && <span className="font-bold text-accent-deep">안읽음</span>}
                      {mine && m.id === lastReadMine && <span className="text-ink-soft">읽음</span>}
                      {showTime && <span className="text-ink-soft">{fmtTime(m.created_at)}</span>}
                    </span>
                  </div>
                  {menuId === m.id && (
                    <div className="flex gap-1.5">
                    <button
                      onClick={async () => {
                        const ok = await onDelete(m.id)
                        setMenuId(null)
                        if (!ok) setError('삭제에 실패했어요.')
                      }}
                      className="pop mt-1 rounded-full bg-white px-3 py-1 text-xs text-[#E25A6A] shadow-sm"
                    >
                      🗑 {m.image_path && !m.content ? '사진' : '메시지'} 삭제{!mine && ' (마스터)'}
                    </button>
                    <button onClick={() => setMenuId(null)} className="pop mt-1 rounded-full bg-white px-3 py-1 text-xs text-ink-soft shadow-sm">
                      취소
                    </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <form onSubmit={submit} className="border-t border-white/70 bg-white/70 px-3 py-2.5 backdrop-blur">
        {error && <p className="mb-1.5 px-2 text-xs text-accent-deep">{error}</p>}
        {preview && (
          <div className="mb-2 flex items-center gap-2 px-1">
            <img src={preview} alt="보낼 사진" className="h-16 w-16 rounded-xl border-2 border-white object-cover" />
            <button type="button" onClick={() => setFile(null)} className="rounded-full bg-white px-3 py-1 text-xs text-ink-soft">
              취소
            </button>
            {sending && <span className="text-xs text-ink-soft">사진 보내는 중…</span>}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              e.target.value = ''
              if (f && !f.type.startsWith('image/')) return setError('사진 파일만 보낼 수 있어요.')
              setError('')
              setFile(f)
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="squish grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-xl"
            aria-label="사진 보내기"
          >
            📷
          </button>
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
            disabled={(!draft.trim() && !file) || sending}
            className="squish grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-lg text-white shadow-[0_3px_0_var(--color-accent-deep)] disabled:opacity-40"
            aria-label="보내기"
          >
            ➤
          </button>
        </div>
      </form>

      {viewer && (
        <button
          onClick={() => setViewer(null)}
          className="fade-in fixed inset-0 z-50 grid place-items-center bg-[#2A2433]/85 p-4"
          aria-label="사진 닫기"
        >
          <img src={viewer} alt="사진 크게 보기" className="max-h-full max-w-full rounded-2xl" />
        </button>
      )}
    </div>
  )
}
