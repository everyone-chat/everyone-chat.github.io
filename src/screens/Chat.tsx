import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Avatar from '../components/Avatar'
import ChatImage, { GalleryThumb } from '../components/ChatImage'
import { LinkSheet, LinkText } from '../components/LinkText'
import { MAX_VIDEO_MB, imageUrl, isVideoFile, isVideoPath } from '../images'
import type { ChatSkin } from '../settings'
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
  /** 채팅방 모양: 말풍선 / 표(엑셀 느낌) / 메일 */
  skin?: ChatSkin
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
const dayKey = (iso: string) => new Date(iso).toDateString()

const SKINS: Record<ChatSkin, { root: string; header: string; list: string; form: string; attach: string; input: string; send: string }> = {
  bubble: {
    root: 'bg-gradient-to-b from-[var(--bg-cool)] to-[var(--bg-warm)]',
    header: '',
    list: 'no-scrollbar px-4 py-4',
    form: 'border-t border-white/70 bg-white/70 px-3 py-2.5 backdrop-blur',
    attach: 'squish grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-xl',
    input: 'min-w-0 flex-1 rounded-full border-2 border-white bg-white px-4 py-2.5 text-base outline-none focus:border-accent',
    send: 'squish grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-lg text-white shadow-[0_3px_0_var(--color-accent-deep)] disabled:opacity-40',
  },
  sheet: {
    root: 'bg-[#ffffff] text-[#202124]',
    header: 'flex items-center justify-between gap-2 border-b border-[#dadce0] bg-[#ffffff] px-2 py-2',
    list: 'bg-[#ffffff]',
    form: 'border-t border-[#dadce0] bg-[#f8f9fa] px-2 py-1.5 text-[#202124]',
    attach: 'shrink-0 rounded border border-[#dadce0] bg-[#ffffff] px-2 py-1 text-[12px] text-[#3c4043]',
    input: 'min-w-0 flex-1 border border-[#dadce0] bg-[#ffffff] px-2 py-1.5 text-[16px] text-[#202124] outline-none focus:border-[#1a73e8] md:text-[13px]',
    send: 'shrink-0 rounded bg-[#1e8e3e] px-3 py-1.5 text-[12px] text-[#ffffff] disabled:opacity-40',
  },
  mail: {
    root: 'bg-[#f6f8fc] text-[#202124]',
    header: 'flex items-center justify-between gap-2 border-b border-[#e0e0e0] bg-[#ffffff] px-2 py-2.5',
    list: 'bg-[#f6f8fc] pb-2',
    form: 'border-t border-[#e0e0e0] bg-[#ffffff] px-3 py-2 text-[#202124]',
    attach: 'grid h-9 w-9 shrink-0 place-items-center rounded-full text-[16px] text-[#5f6368] hover:bg-black/5',
    input: 'min-w-0 flex-1 rounded-lg border border-[#dadce0] bg-[#ffffff] px-3 py-2 text-[16px] text-[#202124] outline-none focus:border-[#1a73e8] md:text-[14px]',
    send: 'shrink-0 rounded-full bg-[#0b57d0] px-4 py-2 text-[13px] text-[#ffffff] disabled:opacity-40',
  },
}

export default function Chat({ me, profileMap, messages, peer, now, onBack, loading, draft, onDraftChange, onSend, onDelete, onClearAll, peerReadId, skin = 'bubble' }: Props) {
  // 상대가 어디까지 읽었나: 읽음 기록 + 상대가 답장을 보냈으면 그 앞 메시지는 당연히 읽은 것
  let readUpTo = peerReadId
  for (const m of messages) if (m.user_id === peer.id && m.id > readUpTo) readUpTo = m.id
  // 내 메시지 중 상대가 읽은 마지막 것 → 그 아래에만 "읽음" 표시
  let lastReadMine = 0
  for (const m of messages) if (m.user_id === me.id && m.id <= readUpTo) lastReadMine = m.id
  const [menuId, setMenuId] = useState<number | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ url: string; msg: Message } | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const canDelete = (m: Message) => m.user_id === me.id || me.is_admin
  const [gallery, setGallery] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [revealAll, setRevealAll] = useState(false)
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
          // PC: 오른쪽 클릭으로도 삭제 메뉴
          onContextMenu: (e: React.MouseEvent) => {
            e.preventDefault()
            if ((e.nativeEvent as PointerEvent).pointerType !== 'touch' && !longPressed.current) setMenuId(id)
          },
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
  const photos = messages.filter((m) => m.image_path)
  // 클립보드에 사진이 있으면 붙여넣기(Ctrl+V / 길게 눌러 붙여넣기)로 보낼 사진에 올림
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const it = items.find((x) => x.kind === 'file' && x.type.startsWith('image/'))
      const f = it?.getAsFile()
      if (!f) return
      e.preventDefault()
      setError('')
      setFile(new File([f], f.name && f.name !== 'image.png' ? f.name : `붙여넣은 사진.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: f.type }))
      inputRef.current?.focus({ preventScroll: true })
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])
  const listRef = useRef<HTMLDivElement>(null)
  const sendRef = useRef<HTMLButtonElement>(null)
  // 휴대폰: 보내기 버튼 터치가 입력창 포커스를 빼앗지 않도록 (passive가 아닌 리스너여야 막을 수 있음)
  useEffect(() => {
    const b = sendRef.current
    if (!b) return
    const onTouch = (e: TouchEvent) => {
      e.preventDefault()
      b.form?.requestSubmit()
    }
    b.addEventListener('touchstart', onTouch, { passive: false })
    return () => b.removeEventListener('touchstart', onTouch)
  }, [])
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
      if (document.activeElement !== inputRef.current) inputRef.current?.focus({ preventScroll: true })
    } else setError(file ? `${isVideoFile(file) ? '동영상' : '사진'} 전송에 실패했어요. 다시 시도해 주세요.` : '전송에 실패했어요. 다시 시도해 주세요.')
  }

  // ---------- 채팅방 모양별 스타일 ----------
  const SK = SKINS[skin]

  /** 표·메일 모양의 한 줄 (꾹 누르기/오른쪽 클릭 삭제, 사진은 눌러야 보임) */
  function altRow(m: Message, i: number, mine: boolean, name: string, newDay: boolean) {
    const can = mine || me.is_admin
    const status = mine ? (m.id > readUpTo ? '안읽음' : '읽음') : ''
    const media = m.image_path ? (isVideoPath(m.image_path) ? '동영상' : '이미지') : null
    const openMedia = async () => {
      if (!m.image_path) return
      const url = await imageUrl(m.image_path)
      if (url) {
        setConfirmDel(false)
        setViewer({ url, msg: m })
      } else setError('파일을 불러올 수 없어요.')
    }
    const menu =
      menuId === m.id ? (
        <span className="ml-2 inline-flex gap-1 align-middle">
          <button
            onClick={async (e) => {
              e.stopPropagation()
              const ok = await onDelete(m.id)
              setMenuId(null)
              if (!ok) setError('삭제에 실패했어요.')
            }}
            className="rounded border border-[#d93025] px-1.5 text-[11px] text-[#d93025]"
          >
            삭제{!mine && '(마스터)'}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setMenuId(null) }} className="rounded border border-[#dadce0] px-1.5 text-[11px] text-[#5f6368]">
            취소
          </button>
        </span>
      ) : null
    const rowProps = {
      ...pressProps(m.id, can),
      onClick: (e: React.MouseEvent) => {
        if (can && (e.nativeEvent as PointerEvent).pointerType !== 'touch') setMenuId(menuId === m.id ? null : m.id)
      },
    }

    if (skin === 'sheet') {
      return (
        <div key={m.id}>
          {newDay && (
            <div className="grid grid-cols-[34px_1fr] border-b border-[#e0e0e0] text-[12px]">
              <span className="border-r border-[#e0e0e0] bg-[#f8f9fa] py-1 text-center text-[#5f6368]" />
              <span className="bg-[#e8f0fe] px-2 py-1 font-bold text-[#202124]">{fmtDate(m.created_at)}</span>
            </div>
          )}
          <div {...rowProps} className="no-callout grid grid-cols-[34px_52px_72px_1fr_52px] border-b border-[#e0e0e0] text-[12px] text-[#202124] hover:bg-[#f1f3f4]">
            <span className="border-r border-[#e0e0e0] bg-[#f8f9fa] py-1 text-center text-[#5f6368]">{i + 1}</span>
            <span className="border-r border-[#e0e0e0] px-1.5 py-1 tabular-nums text-[#5f6368]">{fmtTime(m.created_at).replace(/^오[전후] /, '')}</span>
            <span className={`truncate border-r border-[#e0e0e0] px-1.5 py-1 ${mine ? 'text-[#1a73e8]' : ''}`}>{mine ? '나' : name}</span>
            <span className="min-w-0 whitespace-pre-wrap break-words border-r border-[#e0e0e0] px-1.5 py-1">
              {media && (
                <button onClick={(e) => { e.stopPropagation(); openMedia() }} className="mr-1 text-[#1a73e8] underline">
                  [{media}]
                </button>
              )}
              {m.content && <LinkText text={m.content} onLink={setLink} />}
              {menu}
            </span>
            <span className={`px-1 py-1 text-center ${status === '안읽음' ? 'text-[#d93025]' : 'text-[#5f6368]'}`}>{status}</span>
          </div>
        </div>
      )
    }

    // 메일
    return (
      <div key={m.id}>
        {newDay && <p className="px-4 pb-1 pt-4 text-[11px] font-bold text-[#5f6368]">{fmtDate(m.created_at)}</p>}
        <div {...rowProps} className="no-callout mx-3 mb-2 rounded-lg border border-[#e0e0e0] bg-[#ffffff] px-3.5 py-3 text-[#202124] hover:shadow-sm">
          <div className="mb-1.5 flex items-center gap-2">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] text-white ${mine ? 'bg-[#1a73e8]' : 'bg-[#5f6368]'}`}>
              {(mine ? me.nickname : name).slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold leading-tight">
                {mine ? me.nickname : name}
                <span className="font-normal text-[#5f6368]"> {mine ? '→ ' + peer.nickname : '→ 나'}</span>
              </p>
            </div>
            <span className="shrink-0 text-[11px] text-[#5f6368]">{fmtTime(m.created_at)}</span>
          </div>
          {m.content && (
            <p className="whitespace-pre-wrap break-words pl-9 text-[13.5px] leading-relaxed">
              <LinkText text={m.content} onLink={setLink} />
            </p>
          )}
          {media && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                openMedia()
              }}
              className="ml-9 mt-1.5 inline-flex items-center gap-1 rounded border border-[#dadce0] px-2 py-1 text-[12px] text-[#3c4043]"
            >
              📎 첨부{media} 열기
            </button>
          )}
          <div className="mt-1 flex items-center justify-end">
            {status && <span className={`text-[11px] ${status === '안읽음' ? 'text-[#d93025]' : 'text-[#5f6368]'}`}>{status === '안읽음' ? '읽지 않음' : '읽음'}</span>}
            {menu}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex h-full flex-col ${SK.root}`}>
      {skin === 'bubble' ? (
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
        <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={() => {
            setRevealAll(false)
            setGallery(true)
          }}
          className="squish grid h-9 w-9 place-items-center rounded-full bg-white text-base"
          aria-label="사진 모아보기"
          title="사진 모아보기"
        >
          🖼️
        </button>
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
        </div>
      </header>
      ) : (
        <header className={SK.header}>
          <div className="flex min-w-0 items-center gap-1.5">
            <button onClick={onBack} className="grid h-8 w-8 shrink-0 place-items-center rounded text-lg text-[#5f6368] hover:bg-black/5" aria-label="뒤로">
              ‹
            </button>
            {skin === 'sheet' ? (
              <>
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-sm bg-[#1e8e3e] text-[11px] font-bold text-white">▦</span>
                <div className="min-w-0">
                  <h1 className="truncate text-[14px] leading-tight text-[#202124]">{peer.nickname}_업무정리</h1>
                  <p className="text-[11px] leading-tight text-[#5f6368]">{isOnline(peer, now) ? '공동 편집 중 · 자동 저장됨' : '자동 저장됨'}</p>
                </div>
              </>
            ) : (
              <div className="min-w-0">
                <h1 className="truncate text-[15px] leading-tight text-[#202124]">RE: {peer.nickname}님 업무 협의 건</h1>
                <p className="text-[11px] leading-tight text-[#5f6368]">받은편지함 · {messages.length}개의 메일{isOnline(peer, now) ? ' · 상대 온라인' : ''}</p>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => {
                setRevealAll(false)
                setGallery(true)
              }}
              className="rounded px-2 py-1 text-[12px] text-[#5f6368] hover:bg-black/5"
            >
              {skin === 'sheet' ? '이미지' : '첨부파일'}
            </button>
            {me.is_admin && (
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
                className={`rounded px-2 py-1 text-[12px] ${confirmClear ? 'bg-[#d93025] text-white' : 'text-[#d93025] hover:bg-black/5'}`}
              >
                {confirmClear ? '한 번 더 눌러 전부 삭제' : skin === 'sheet' ? '시트 비우기' : '전체 삭제'}
              </button>
            )}
          </div>
        </header>
      )}

      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
        }}
        className={`flex-1 overflow-y-auto ${SK.list}`}
      >
        {skin === 'sheet' && (
          <div className="sticky top-0 z-10 grid grid-cols-[34px_52px_72px_1fr_52px] border-b border-[#dadce0] bg-[#f8f9fa] text-center text-[11px] text-[#5f6368]">
            <span className="border-r border-[#e0e0e0] py-1" />
            {['A', 'B', 'C', 'D'].map((c) => (
              <span key={c} className="border-r border-[#e0e0e0] py-1">{c}</span>
            ))}
          </div>
        )}
        {loading && <p className="py-10 text-center text-sm text-ink-soft">대화를 불러오는 중…</p>}
        {!loading && messages.length === 0 && skin !== 'bubble' && (
          <p className="py-16 text-center text-[13px] text-[#5f6368]">{skin === 'sheet' ? '빈 시트예요. 아래 입력칸에 적어 보세요.' : '받은 메일이 없어요.'}</p>
        )}
        {!loading && messages.length === 0 && skin === 'bubble' && (
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
          if (skin !== 'bubble') return altRow(m, i, mine, author?.nickname ?? '(알 수 없음)', newDay)

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
                    {m.image_path && <ChatImage path={m.image_path} onOpen={(url) => { setConfirmDel(false); setViewer({ url, msg: m }) }} />}
                    {m.content && (
                    <p
                      className={`whitespace-pre-wrap break-words px-3.5 py-2 text-[15px] leading-snug shadow-sm ${
                        mine || me.is_admin ? 'cursor-pointer' : ''
                      } ${
                        mine ? 'rounded-[20px] rounded-br-md text-[#4A4560]' : 'rounded-[20px] rounded-bl-md bg-white'
                      }`}
                      style={mine ? { background: me.color } : undefined}
                    >
                      <LinkText text={m.content} onLink={setLink} />
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

      <form onSubmit={submit} className={SK.form}>
        {error && <p className="mb-1.5 px-2 text-xs text-accent-deep">{error}</p>}
        {preview && (
          <div className="mb-2 flex items-center gap-2 px-1">
            {file && isVideoFile(file) ? (
              <video src={preview} muted playsInline className="h-16 w-16 rounded-xl border-2 border-white bg-[#4A4560] object-cover" />
            ) : (
              <img src={preview} alt="보낼 사진" className="h-16 w-16 rounded-xl border-2 border-white object-cover" />
            )}
            <button type="button" onClick={() => setFile(null)} className="rounded-full bg-white px-3 py-1 text-xs text-ink-soft">
              취소
            </button>
            {sending && <span className="text-xs text-ink-soft">{file && isVideoFile(file) ? '동영상 올리는 중… (크면 조금 걸려요)' : '사진 보내는 중…'}</span>}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              e.target.value = ''
              if (f && !f.type.startsWith('image/') && !isVideoFile(f)) return setError('사진이나 동영상만 보낼 수 있어요.')
              if (f && isVideoFile(f) && !/^video\/(mp4|quicktime|webm)$/.test(f.type)) return setError('mp4·mov·webm 동영상만 보낼 수 있어요.')
              if (f && isVideoFile(f) && f.size > MAX_VIDEO_MB * 1024 * 1024)
                return setError(`동영상은 ${MAX_VIDEO_MB}MB까지 보낼 수 있어요. (지금 ${Math.round(f.size / 1024 / 1024)}MB)`)
              setError('')
              setFile(f)
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={SK.attach}
            aria-label="사진·동영상 보내기"
          >
            {skin === 'bubble' ? '📷' : skin === 'sheet' ? '첨부' : '📎'}
          </button>
          {skin === 'sheet' && <span className="shrink-0 font-serif text-[13px] italic text-[#5f6368]">fx</span>}
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            maxLength={500}
            placeholder={file ? '사진과 함께 보낼 말 (선택)' : skin === 'sheet' ? '' : skin === 'mail' ? '답장 작성…' : '메시지 보내기'}
            enterKeyHint="send"
            className={SK.input}
          />
          <button
            // 보내기 버튼을 눌러도 입력창 포커스를 뺏지 않음 → 휴대폰 자판이 닫혔다 다시 열리며 화면이 출렁이지 않게
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            ref={sendRef}
            disabled={(!draft.trim() && !file) || sending}
            className={SK.send}
            aria-label="보내기"
          >
            {skin === 'bubble' ? '➤' : skin === 'sheet' ? '입력' : '보내기'}
          </button>
        </div>
      </form>

      {gallery && (
        <div className="fade-in fixed inset-0 z-40 flex flex-col bg-[var(--bg-warm)]">
          <header className="flex items-center justify-between border-b border-white bg-white/80 px-4 py-3">
            <button onClick={() => setGallery(false)} className="squish grid h-10 w-10 place-items-center rounded-full text-2xl" aria-label="닫기">
              ‹
            </button>
            <h2 className="font-cute text-lg">사진·동영상 · {photos.length}개</h2>
            <button onClick={() => setRevealAll((v) => !v)} className="squish rounded-full bg-white px-3 py-1.5 text-xs shadow-sm">
              {revealAll ? '🙈 가리기' : '👀 모두 보기'}
            </button>
          </header>
          <div className="no-scrollbar flex-1 overflow-y-auto p-3">
            {photos.length === 0 ? (
              <p className="py-16 text-center text-sm text-ink-soft">이 대화에서 주고받은 사진·동영상이 없어요.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {[...photos].reverse().map((m) => (
                  <GalleryThumb key={m.id} path={m.image_path!} reveal={revealAll} onOpen={(url) => { setConfirmDel(false); setViewer({ url, msg: m }) }} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {link && <LinkSheet url={link} onClose={() => setLink(null)} />}

      {viewer && (
        <div className="fade-in fixed inset-0 z-50 flex flex-col bg-[#2A2433]/90">
          <div className="flex items-center justify-end gap-2 p-3">
            {canDelete(viewer.msg) && (
              <button
                onClick={async () => {
                  if (!confirmDel) return setConfirmDel(true)
                  const ok = await onDelete(viewer.msg.id)
                  setConfirmDel(false)
                  if (ok) setViewer(null)
                  else setError('삭제에 실패했어요.')
                }}
                className={`squish rounded-full px-4 py-2 text-sm ${confirmDel ? 'bg-[#E25A6A] text-white' : 'bg-white text-[#E25A6A]'}`}
              >
                {confirmDel ? '정말 삭제할까요? 한 번 더' : `🗑 ${isVideoPath(viewer.msg.image_path ?? '') ? '동영상' : '사진'} 삭제${viewer.msg.user_id !== me.id ? ' (마스터)' : ''}`}
              </button>
            )}
            <button onClick={() => setViewer(null)} className="squish rounded-full bg-white px-4 py-2 text-sm text-ink" aria-label="사진 닫기">
              ✕ 닫기
            </button>
          </div>
          <div onClick={() => setViewer(null)} className="grid min-h-0 flex-1 place-items-center p-4 pt-0">
            {isVideoPath(viewer.msg.image_path ?? '') ? (
              <video src={viewer.url} controls autoPlay playsInline onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full rounded-2xl bg-black" />
            ) : (
              <img src={viewer.url} alt="사진 크게 보기" className="max-h-full max-w-full rounded-2xl" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
