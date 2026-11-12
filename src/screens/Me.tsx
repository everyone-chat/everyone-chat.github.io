import { useState } from 'react'
import ProfileEditor from '../components/ProfileEditor'
import { STATUSES, type Profile } from '../types'

type Props = {
  me: Profile
  onSaveProfile: (v: { nickname: string; emoji: string; color: string }) => Promise<boolean>
  onChangeStatus: (status: string) => void
}

export default function Me({ me, onSaveProfile, onChangeStatus }: Props) {
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
      <div className="mx-auto max-w-md px-5 pb-8 pt-5">
        <h1 className="mb-4 font-cute text-2xl">나</h1>

        <section className="rounded-[28px] border-2 border-white bg-white/70 p-5 shadow-[0_8px_24px_rgba(120,110,170,0.1)]">
          <ProfileEditor
            nickname={nickname}
            emoji={emoji}
            color={color}
            onChange={(v) => {
              setNotice('')
              if (v.nickname !== undefined) setNickname(v.nickname)
              if (v.emoji) setEmoji(v.emoji)
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

        <section className="mt-5 rounded-[28px] border-2 border-white bg-white/70 p-5">
          <h2 className="mb-3 font-cute text-lg">지금 나는…</h2>
          <div className="grid grid-cols-3 gap-2">
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

        <p className="mt-5 px-2 text-xs leading-relaxed text-ink-soft">
          계정은 이 브라우저에 저장돼 있어요. 브라우저 기록·사이트 데이터를 지우거나 다른 기기·다른 브라우저로 들어오면 새 친구로 다시
          입장하게 돼요.
        </p>
      </div>
    </div>
  )
}
