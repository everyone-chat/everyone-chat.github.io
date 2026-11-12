import { useMemo, useState } from 'react'
import Avatar from '../components/Avatar'
import Sheet from '../components/Sheet'
import RoomScene, { defaultSpot, type Person } from '../room/RoomScene'
import RoomEditor from '../room/RoomEditor'
import { useRoom } from '../room/useRoom'
import { parseLook } from '../look'
import { STATUSES, isOnline, statusOf, type Profile } from '../types'

type Props = {
  me: Profile
  profiles: Profile[]
  now: number
  onChangeStatus: (status: string) => void
  onGreet: (p: Profile) => void
  onKick: (p: Profile) => Promise<boolean>
}

function timeAgo(iso: string, now: number) {
  const m = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

// 광장 = 내 방. 내 방 안에 나와 친구들이 함께 있고, 여기서 바로 방을 꾸밈
export default function Plaza({ me, profiles, now, onChangeStatus, onGreet, onKick }: Props) {
  const { data, status: saveStatus, update, save } = useRoom(me.id)
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [statusOpen, setStatusOpen] = useState(false)
  const [confirmKick, setConfirmKick] = useState(false)
  const [kickError, setKickError] = useState('')

  const friends = useMemo(
    () =>
      profiles
        .filter((p) => p.id !== me.id)
        .sort((a, b) => Number(isOnline(b, now)) - Number(isOnline(a, now)) || a.created_at.localeCompare(b.created_at)),
    [profiles, me.id, now],
  )

  const people: Person[] = useMemo(() => {
    if (!data) return []
    const list: Person[] = [
      { id: me.id, look: parseLook(me.emoji), status: me.status, name: me.nickname, u: data.char.u, v: data.char.v, me: true, admin: me.is_admin },
    ]
    friends.forEach((f, i) => {
      const pos = data.guests[f.id] ?? defaultSpot(i)
      list.push({ id: f.id, look: parseLook(f.emoji), status: f.status, name: f.nickname, u: pos.u, v: pos.v, online: isOnline(f, now), admin: f.is_admin })
    })
    return list
  }, [data, me, friends, now])

  const onlineCount = friends.filter((p) => isOnline(p, now)).length + 1
  const myStatus = statusOf(me.status)
  const sel = profileId ? profiles.find((p) => p.id === profileId) ?? null : null

  const saveText =
    saveStatus === 'saving' ? '저장 중…' : saveStatus === 'saved' ? '저장됨 ✓' : saveStatus === 'error' ? '저장 실패 · 다시 시도' : '자동 저장'

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#FFF0F5] to-[#EAF5FF]">
      <header className="flex items-center justify-between gap-2 px-5 pb-2 pt-5">
        <div className="min-w-0">
          <h1 className="font-cute text-2xl leading-tight">우리 광장</h1>
          <p className="truncate text-sm text-ink-soft">
            {me.nickname}의 방 · 친구 {friends.length}명 · <span className="text-[#3DBE7A]">●</span> {onlineCount}명
          </p>
        </div>
        <button
          onClick={() => setStatusOpen(true)}
          className="squish flex shrink-0 items-center gap-1 rounded-full border-2 border-white bg-white/80 px-3 py-1.5 text-sm shadow-sm"
        >
          <span>{myStatus.icon}</span>
          {myStatus.label}
        </button>
      </header>

      <div className="px-3">
        <div className="overflow-hidden rounded-3xl border-2 border-white shadow-[0_8px_24px_rgba(120,110,170,0.15)]">
          {data ? (
            <RoomScene
              data={data}
              people={people}
              editable={editing}
              selected={selected}
              onSelect={setSelected}
              onMoveItem={(id, u, v) => update((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, u, v } : i)) }))}
              onMovePerson={(id, u, v) =>
                update((d) => (id === me.id ? { ...d, char: { u, v } } : { ...d, guests: { ...d.guests, [id]: { u, v } } }))
              }
              onTapPerson={(id) => {
                if (editing) return
                setProfileId(id)
                setConfirmKick(false)
                setKickError('')
              }}
              className="h-auto w-full"
            />
          ) : (
            <div className="grid aspect-[16/9] place-items-center bg-white/60 font-cute text-ink-soft">방을 불러오는 중…</div>
          )}
        </div>
      </div>

      <div className="no-scrollbar mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {data && editing ? (
          <RoomEditor
            data={data}
            update={update}
            selected={selected}
            setSelected={setSelected}
            onDone={() => {
              setEditing(false)
              setSelected(null)
            }}
          />
        ) : (
          <section className="rounded-[24px] border-2 border-white bg-white/75 p-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditing(true)
                  setSelected(null)
                }}
                disabled={!data}
                className="squish flex-1 rounded-2xl bg-accent py-3 font-cute text-white shadow-[0_4px_0_var(--color-accent-deep)] disabled:opacity-50"
              >
                🛋️ 방 꾸미기
              </button>
              <button
                onClick={() => saveStatus === 'error' && save()}
                className={`rounded-2xl px-3 py-3 text-xs ${saveStatus === 'error' ? 'bg-[#E25A6A] text-white' : 'bg-white text-ink-soft'}`}
              >
                {saveText}
              </button>
            </div>
            <p className="mt-3 text-center text-xs leading-relaxed text-ink-soft">
              {friends.length === 0
                ? '아직 친구가 없어요. 나 탭에서 친구 코드로 친구를 추가하면 내 방에 놀러 와요!'
                : '캐릭터를 끌어서 자리를 옮기고, 친구를 누르면 프로필과 1:1 채팅을 열 수 있어요.'}
            </p>
          </section>
        )}
      </div>

      {sel && (
        <Sheet onClose={() => setProfileId(null)}>
          <div className="flex flex-col items-center gap-3 pb-4">
            <Avatar look={sel.emoji} size={92} status={sel.status} />
            <div className="text-center">
              <h2 className="font-cute text-2xl">
                {sel.is_admin && '👑 '}
                {sel.id === me.id ? `${sel.nickname} (나)` : sel.nickname}
              </h2>
              <p className="mt-1 text-ink-soft">
                {statusOf(sel.status).icon} {statusOf(sel.status).label}
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                {sel.id === me.id || isOnline(sel, now) ? '🟢 지금 접속 중' : `마지막 접속 ${timeAgo(sel.last_seen, now)}`}
              </p>
            </div>
            {sel.id !== me.id && (
              <button
                onClick={() => {
                  onGreet(sel)
                  setProfileId(null)
                }}
                className="squish mt-2 w-full rounded-2xl bg-accent py-3.5 font-cute text-lg text-white shadow-[0_4px_0_var(--color-accent-deep)]"
              >
                1:1 채팅하기 💬
              </button>
            )}
            {me.is_admin && sel.id !== me.id && !sel.is_admin && (
              <button
                onClick={async () => {
                  if (!confirmKick) return setConfirmKick(true)
                  const ok = await onKick(sel)
                  if (ok) setProfileId(null)
                  else setKickError('내보내기에 실패했어요.')
                }}
                className={`squish w-full rounded-2xl py-3 font-cute text-base ${confirmKick ? 'bg-[#E25A6A] text-white' : 'bg-white text-[#E25A6A]'}`}
              >
                {confirmKick ? `정말 ${sel.nickname} 님을 내보낼까요? 한 번 더 누르기` : '채팅방에서 내보내기'}
              </button>
            )}
            {kickError && <p className="text-sm text-accent-deep">{kickError}</p>}
          </div>
        </Sheet>
      )}

      {statusOpen && (
        <Sheet onClose={() => setStatusOpen(false)}>
          <h2 className="mb-3 text-center font-cute text-xl">지금 나는…</h2>
          <div className="grid grid-cols-4 gap-2 pb-4">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  onChangeStatus(s.id)
                  setStatusOpen(false)
                }}
                className={`squish flex flex-col items-center gap-1 rounded-2xl py-3 ${s.id === me.status ? 'bg-white shadow-[0_0_0_3px_var(--color-accent)]' : 'bg-white/70'}`}
              >
                <span className="text-2xl">{s.icon}</span>
                <span className="text-xs">{s.label}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  )
}
