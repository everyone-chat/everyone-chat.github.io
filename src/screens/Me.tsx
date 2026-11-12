import { useState } from 'react'
import ProfileEditor from '../components/ProfileEditor'
import FriendsPanel from '../components/FriendsPanel'
import AccountPanel from '../components/AccountPanel'
import { STATUSES, type Profile } from '../types'

type Props = {
  me: Profile
  onSaveProfile: (v: { nickname: string; emoji: string; color: string }) => Promise<boolean>
  onChangeStatus: (status: string) => void
  onClaimAdmin: (code: string) => Promise<boolean>
  onLeave: () => Promise<void>
  friends: Profile[]
  allMembers: Profile[]
  onSetCode: (code: string) => Promise<string | null>
  onAddFriend: (code: string) => Promise<string | null>
  onRemoveFriend: (p: Profile) => Promise<boolean>
  onKick: (p: Profile) => Promise<boolean>
  banned: Profile[]
  onUnban: (p: Profile) => Promise<boolean>
  onPurge: (p: Profile) => Promise<boolean>
  onSetInvite: (code: string) => Promise<string | null>
  settingsPanel?: React.ReactNode
}

export default function Me({ me, onSaveProfile, onChangeStatus, onClaimAdmin, onLeave, friends, allMembers, onSetCode, onAddFriend, onRemoveFriend, onKick, banned, onUnban, onPurge, onSetInvite, settingsPanel }: Props) {
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminCode, setAdminCode] = useState('')
  const [adminNotice, setAdminNotice] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [nickname, setNickname] = useState(me.nickname)
  const [emoji, setEmoji] = useState(me.emoji)
  const [color, setColor] = useState(me.color)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const dirty = nickname.trim() !== me.nickname || emoji !== me.emoji || color !== me.color

  async function save() {
    if (!nickname.trim()) {
      setNotice('닉네임을 입력해 주세요.')
      return
    }
    setSaving(true)
    const ok = await onSaveProfile({ nickname: nickname.trim(), emoji, color })
    setSaving(false)
    setNotice(ok ? '저장했어요!' : '저장에 실패했어요. 다시 시도해 주세요.')
  }

  return (
    <div className="no-scrollbar h-full overflow-y-auto bg-gradient-to-b from-[#FFF0F5] to-[#EAF5FF]">
      <div className="mx-auto max-w-md px-5 pb-12 pt-7">
        <h1 className="mb-6 font-cute text-2xl">나</h1>

        <section className="rounded-[28px] border-2 border-white bg-white/70 px-5 py-6 shadow-[0_8px_24px_rgba(120,110,170,0.1)]">
          <ProfileEditor
            nickname={nickname}
            look={emoji}
            color={color}
            onChange={(v) => {
              setNotice('')
              if (v.nickname !== undefined) setNickname(v.nickname)
              if (v.look) setEmoji(v.look)
              if (v.color) setColor(v.color)
            }}
          />
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="squish mt-5 w-full rounded-2xl bg-accent py-3 font-cute text-lg text-white shadow-[0_4px_0_var(--color-accent-deep)] disabled:opacity-40"
          >
            {saving ? '저장 중…' : '저장하기'}
          </button>
          {notice && <p className="mt-2 text-center text-sm text-ink-soft">{notice}</p>}
        </section>

        <FriendsPanel
          me={me}
          friends={friends}
          allMembers={allMembers}
          onSetCode={onSetCode}
          onAdd={onAddFriend}
          onRemove={onRemoveFriend}
          onKick={onKick}
          banned={banned}
          onUnban={onUnban}
          onPurge={onPurge}
          onSetInvite={onSetInvite}
        />

        <section className="mt-7 rounded-[28px] border-2 border-white bg-white/70 px-5 py-6">
          <h2 className="mb-4 font-cute text-lg">지금 나는…</h2>
          <div className="grid grid-cols-4 gap-2">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                onClick={() => onChangeStatus(s.id)}
                className={`squish flex flex-col items-center gap-1 rounded-2xl py-3 ${
                  s.id === me.status ? 'bg-white shadow-[0_0_0_3px_var(--color-accent)]' : 'bg-white/60'
                }`}
              >
                <span className="text-2xl">{s.icon}</span>
                <span className="text-sm">{s.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-7 rounded-[28px] border-2 border-white bg-white/70 px-5 py-6">
          {me.is_admin ? (
            <p className="text-center font-cute text-lg">👑 마스터 권한이 있어요</p>
          ) : !adminOpen ? (
            <button onClick={() => setAdminOpen(true)} className="w-full text-center text-sm text-ink-soft underline">
              마스터 코드 입력
            </button>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!adminCode.trim()) return
                const ok = await onClaimAdmin(adminCode)
                setAdminNotice(ok ? '' : '마스터 코드가 맞지 않아요.')
                if (ok) setAdminCode('')
              }}
              className="flex gap-2"
            >
              <input
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                placeholder="마스터 코드"
                autoCapitalize="off"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-2xl border-2 border-white bg-white px-4 py-2.5 outline-none focus:border-accent"
              />
              <button className="squish rounded-2xl bg-ink px-4 font-cute text-white">확인</button>
            </form>
          )}
          {me.is_admin && (
            <p className="mt-2 text-center text-xs leading-relaxed text-ink-soft">
              위 멤버 관리에서 누구든 내보낼 수 있고, 내 대화방에서는 상대 메시지도 지우거나 대화를 전부 비울 수 있어요.
            </p>
          )}
          {adminNotice && <p className="mt-2 text-center text-sm text-accent-deep">{adminNotice}</p>}
        </section>

        <AccountPanel />

        {settingsPanel}

        <button
          onClick={async () => {
            if (!confirmLeave) return setConfirmLeave(true)
            setLeaving(true)
            await onLeave()
          }}
          disabled={leaving}
          className={`squish mt-7 w-full rounded-2xl py-3 font-cute text-base ${
            confirmLeave ? 'bg-[#E25A6A] text-white' : 'bg-white/70 text-[#E25A6A]'
          }`}
        >
          {leaving ? '나가는 중…' : confirmLeave ? '정말 나갈까요? 한 번 더 누르기' : '채팅방 나가기'}
        </button>
        {confirmLeave && !leaving && (
          <p className="mt-2 text-center text-xs text-ink-soft">
            보낸 메시지는 남아요. 나중에 입장 코드로 다시 들어올 수 있어요.
          </p>
        )}

        <p className="mt-7 px-2 text-xs leading-relaxed text-ink-soft">
          계정은 이 브라우저에 저장돼 있어요. 브라우저 기록·사이트 데이터를 지우거나 다른 기기·다른 브라우저로 들어오면 새 친구로 다시
          입장하게 돼요.
        </p>
      </div>
    </div>
  )
}
