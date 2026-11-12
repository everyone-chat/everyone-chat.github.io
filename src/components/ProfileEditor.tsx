import Avatar from './Avatar'
import { COLORS, EMOJIS } from '../types'

type Props = {
  nickname: string
  emoji: string
  color: string
  onChange: (v: { nickname?: string; emoji?: string; color?: string }) => void
}

export default function ProfileEditor({ nickname, emoji, color, onChange }: Props) {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="bob">
        <Avatar emoji={emoji} color={color} size={96} />
      </div>

      <label className="w-full">
        <span className="mb-1.5 block text-sm text-ink-soft">닉네임</span>
        <input
          value={nickname}
          maxLength={12}
          onChange={(e) => onChange({ nickname: e.target.value })}
          placeholder="친구들이 부를 이름"
          className="w-full rounded-2xl border-2 border-white bg-white/80 px-4 py-3 text-base outline-none focus:border-accent"
        />
      </label>

      <div className="w-full">
        <span className="mb-1.5 block text-sm text-ink-soft">캐릭터</span>
        <div className="grid grid-cols-6 gap-2">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onChange({ emoji: e })}
              className={`squish grid aspect-square place-items-center rounded-2xl text-2xl ${
                e === emoji ? 'bg-white shadow-[0_0_0_3px_var(--color-accent)]' : 'bg-white/60'
              }`}
              aria-label={`캐릭터 ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full">
        <span className="mb-1.5 block text-sm text-ink-soft">옷 색깔</span>
        <div className="flex justify-between gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ color: c })}
              className={`squish h-11 w-11 rounded-full border-[3px] ${c === color ? 'border-accent' : 'border-white'}`}
              style={{ background: c }}
              aria-label={`색 ${c}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
