import { useState } from 'react'
import Avatar from './Avatar'
import type { Profile } from '../types'

type Props = {
  me: Profile
  friends: Profile[]
  allMembers: Profile[]
  onSetCode: (code: string) => Promise<string | null>
  onAdd: (code: string) => Promise<string | null>
  onRemove: (p: Profile) => Promise<boolean>
  onKick: (p: Profile) => Promise<boolean>
  banned: Profile[]
  onUnban: (p: Profile) => Promise<boolean>
  onSetInvite: (code: string) => Promise<string | null>
}

const box = 'mt-5 rounded-[28px] border-2 border-white bg-white/70 p-5'
const field = 'min-w-0 flex-1 rounded-2xl border-2 border-white bg-white px-4 py-2.5 outline-none focus:border-accent'

export default function FriendsPanel({ me, friends, allMembers, onSetCode, onAdd, onRemove, onKick, banned, onUnban, onSetInvite }: Props) {
  const [invite, setInvite] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')
  const [editing, setEditing] = useState(false)
  const [myCode, setMyCode] = useState(me.friend_code)
  const [codeMsg, setCodeMsg] = useState('')
  const [addCode, setAddCode] = useState('')
  const [addMsg, setAddMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const ask = (id: string) => {
    if (confirmId === id) return true
    setConfirmId(id)
    setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 4000)
    return false
  }

  return (
    <>
      <section className={box}>
        <h2 className="mb-1 font-cute text-lg">내 친구 코드</h2>
        <p className="mb-3 text-xs text-ink-soft">이 코드를 아는 사람만 나를 친구로 추가할 수 있어요.</p>
        {!editing ? (
          <div className="flex items-center gap-2">
            <span className="flex-1 truncate rounded-2xl bg-white px-4 py-2.5 font-cute text-xl tracking-wide">{me.friend_code}</span>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(me.friend_code).then(() => setCodeMsg('복사했어요!'), () => {})
              }}
              className="squish rounded-2xl bg-white px-3 py-2.5 text-sm"
            >
              복사
            </button>
            <button
              onClick={() => {
                setMyCode(me.friend_code)
                setCodeMsg('')
                setEditing(true)
              }}
              className="squish rounded-2xl bg-ink px-3 py-2.5 text-sm text-white"
            >
              바꾸기
            </button>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              const err = await onSetCode(myCode)
              setBusy(false)
              if (err) setCodeMsg(err)
              else {
                setCodeMsg('바꿨어요! 이전 코드로는 더 이상 추가할 수 없어요.')
                setEditing(false)
              }
            }}
            className="flex gap-2"
          >
            <input value={myCode} onChange={(e) => setMyCode(e.target.value)} maxLength={16} autoCapitalize="off" autoComplete="off" className={field} />
            <button disabled={busy} className="squish rounded-2xl bg-accent px-4 font-cute text-white disabled:opacity-50">
              저장
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-2xl px-2 text-sm text-ink-soft">
              취소
            </button>
          </form>
        )}
        {editing && <p className="mt-2 text-xs text-ink-soft">한글·영문·숫자·-·_ 2~16자, 다른 사람과 겹치면 안 돼요.</p>}
        {codeMsg && <p className="mt-2 text-sm text-ink-soft">{codeMsg}</p>}
      </section>

      <section className={box}>
        <h2 className="mb-3 font-cute text-lg">친구 추가</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!addCode.trim()) return
            setBusy(true)
            const err = await onAdd(addCode)
            setBusy(false)
            if (err) setAddMsg(err)
            else {
              setAddMsg('친구가 됐어요! 마이룸과 채팅에서 볼 수 있어요.')
              setAddCode('')
            }
          }}
          className="flex gap-2"
        >
          <input
            value={addCode}
            onChange={(e) => setAddCode(e.target.value)}
            placeholder="친구의 코드"
            autoCapitalize="off"
            autoComplete="off"
            className={field}
          />
          <button disabled={busy} className="squish rounded-2xl bg-accent px-4 font-cute text-white disabled:opacity-50">
            추가
          </button>
        </form>
        {addMsg && <p className="mt-2 text-sm text-ink-soft">{addMsg}</p>}

        <h3 className="mb-2 mt-5 text-sm text-ink-soft">내 친구 {friends.length}명</h3>
        {friends.length === 0 && <p className="text-sm text-ink-soft">아직 친구가 없어요.</p>}
        <ul className="flex flex-col gap-2">
          {friends.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-2">
              <Avatar look={f.emoji} color={f.color} size={36} headOnly />
              <span className="min-w-0 flex-1 truncate">{f.nickname}</span>
              <button
                onClick={async () => {
                  if (!ask(f.id)) return
                  await onRemove(f)
                  setConfirmId(null)
                }}
                className={`rounded-full px-3 py-1 text-xs ${confirmId === f.id ? 'bg-[#E25A6A] text-white' : 'bg-white text-ink-soft'}`}
              >
                {confirmId === f.id ? '대화도 삭제돼요. 끊기' : '친구 끊기'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {me.is_admin && (
        <section className={box}>
          <h2 className="mb-1 font-cute text-lg">👑 멤버 관리</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!invite.trim()) return
              setBusy(true)
              const err = await onSetInvite(invite)
              setBusy(false)
              setInviteMsg(err ?? `입장 코드를 "${invite.trim()}"(으)로 바꿨어요. 이미 들어온 멤버는 그대로예요.`)
              if (!err) setInvite('')
            }}
            className="mb-1 flex gap-2"
          >
            <input
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              placeholder="새 입장 코드"
              maxLength={30}
              autoCapitalize="off"
              autoComplete="off"
              className={field}
            />
            <button disabled={busy} className="squish rounded-2xl bg-ink px-4 text-sm text-white disabled:opacity-50">
              바꾸기
            </button>
          </form>
          <p className="mb-4 text-xs text-ink-soft">{inviteMsg || '새로 들어올 사람이 쓸 코드예요 (4~30자). 지금 코드는 보안상 표시하지 않아요.'}</p>
          <p className="mb-3 text-xs text-ink-soft">입장한 모든 멤버예요. 친구가 아니면 대화 내용은 볼 수 없어요.</p>
          <ul className="flex flex-col gap-2">
            {allMembers
              .filter((m) => m.id !== me.id)
              .map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-2">
                  <Avatar look={m.emoji} color={m.color} size={36} headOnly />
                  <span className="min-w-0 flex-1 truncate">
                    {m.is_admin && '👑 '}
                    {m.nickname}
                  </span>
                  {!m.is_admin && (
                    <button
                      onClick={async () => {
                        if (!ask('k' + m.id)) return
                        await onKick(m)
                        setConfirmId(null)
                      }}
                      className={`rounded-full px-3 py-1 text-xs ${confirmId === 'k' + m.id ? 'bg-[#E25A6A] text-white' : 'bg-white text-[#E25A6A]'}`}
                    >
                      {confirmId === 'k' + m.id ? '정말 내보내기' : '내보내기'}
                    </button>
                  )}
                </li>
              ))}
          </ul>

        </section>
      )}
    </>
  )
}
