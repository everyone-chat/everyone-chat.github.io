import Avatar from './Avatar'
import { COLORS } from '../types'
import { HAIR_COLORS, HAIR_STYLES, SKINS, encodeLook, parseLook, type Look } from '../look'

type Props = {
  nickname: string
  look: string
  color: string
  onChange: (v: { nickname?: string; look?: string; color?: string }) => void
}

function Swatches({ colors, value, onPick, label }: { colors: string[]; value: number; onPick: (i: number) => void; label: string }) {
  return (
    <div className="w-full">
      <span className="mb-1.5 block text-sm text-ink-soft">{label}</span>
      <div className="flex flex-wrap gap-2">
        {colors.map((c, i) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(i)}
            className={`squish h-10 w-10 rounded-full border-[3px] ${i === value ? 'border-accent' : 'border-white'}`}
            style={{ background: c }}
            aria-label={`${label} ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

export default function ProfileEditor({ nickname, look, color, onChange }: Props) {
  const l = parseLook(look)
  const set = (patch: Partial<Look>) => onChange({ look: encodeLook({ ...l, ...patch }) })

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="bob">
        <Avatar look={look} color={color} size={104} />
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
        <span className="mb-1.5 block text-sm text-ink-soft">헤어스타일</span>
        <div className="grid grid-cols-4 gap-2">
          {HAIR_STYLES.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => set({ hair: h.id })}
              className={`squish flex flex-col items-center rounded-2xl pb-1.5 pt-2 ${
                h.id === l.hair ? 'bg-white shadow-[0_0_0_3px_var(--color-accent)]' : 'bg-white/60'
              }`}
            >
              <Avatar look={encodeLook({ ...l, hair: h.id })} color={color} size={44} headOnly />
              <span className="mt-1 text-xs">{h.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Swatches label="머리색" colors={HAIR_COLORS} value={l.hairColor} onPick={(i) => set({ hairColor: i })} />
      <Swatches label="피부색" colors={SKINS} value={l.skin} onPick={(i) => set({ skin: i })} />
      <Swatches label="옷 색깔" colors={COLORS} value={Math.max(0, COLORS.indexOf(color))} onPick={(i) => onChange({ color: COLORS[i] })} />
    </div>
  )
}
