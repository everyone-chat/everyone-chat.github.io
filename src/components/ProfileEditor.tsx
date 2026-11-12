import { useState } from 'react'
import { CharacterSvg } from './Avatar'
import { COLORS } from '../types'
import { EYE_COLORS, HAIR_COLORS, OUTFIT_COLORS, PARTS, SKINS, encodeLook, parseLook, type Gender, type Look } from '../look'

type Props = {
  nickname: string
  look: string
  color: string
  onChange: (v: { nickname?: string; look?: string; color?: string }) => void
}

type TabId = 'hair' | 'eyes' | 'outfit' | 'expr' | 'color'
const TABS: { id: TabId; label: string }[] = [
  { id: 'hair', label: '헤어' },
  { id: 'eyes', label: '눈' },
  { id: 'outfit', label: '코디' },
  { id: 'expr', label: '표정' },
  { id: 'color', label: '색상' },
]

function Swatches({ label, colors, value, onPick, firstLabel }: { label: string; colors: string[]; value: number; onPick: (i: number) => void; firstLabel?: string }) {
  return (
    <div>
      <span className="mb-1.5 block text-sm text-ink-soft">{label}</span>
      <div className="flex flex-wrap gap-2">
        {colors.map((c, i) => (
          <button
            key={c + i}
            type="button"
            onClick={() => onPick(i)}
            className={`squish grid h-9 w-9 place-items-center rounded-full border-[3px] text-[10px] ${i === value ? 'border-accent' : 'border-white'}`}
            style={{ background: c || 'linear-gradient(135deg,#fff 45%,#e8e3ee 45%)' }}
            aria-label={`${label} ${c ? i : firstLabel}`}
          >
            {!c && firstLabel}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ProfileEditor({ nickname, look, color, onChange }: Props) {
  const [tab, setTab] = useState<TabId>('hair')
  const l = parseLook(look)
  const set = (patch: Partial<Look>) => onChange({ look: encodeLook({ ...l, ...patch }) })
  const names = PARTS[l.g]

  const partKey = tab === 'color' ? null : tab
  return (
    <div className="flex flex-col items-center gap-4">
      {/* 실시간 미리보기 */}
      <div className="bob">
        <CharacterSvg look={l} size={120} />
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

      {/* 성별 */}
      <div className="grid w-full grid-cols-2 gap-2 rounded-2xl bg-white/60 p-1">
        {(['f', 'm'] as Gender[]).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => set({ g })}
            className={`squish rounded-xl py-2 font-cute ${l.g === g ? 'bg-white text-ink shadow-sm' : 'text-ink-soft'}`}
          >
            {g === 'f' ? '여자' : '남자'}
          </button>
        ))}
      </div>

      {/* 파츠 탭 */}
      <div className="no-scrollbar flex w-full gap-1.5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`squish shrink-0 rounded-full px-3.5 py-1.5 text-sm ${tab === t.id ? 'bg-accent text-white' : 'bg-white/70 text-ink-soft'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {partKey && (
        <div className="grid w-full grid-cols-5 gap-1.5">
          {names[partKey].map((name, i) => {
            const preview = { ...l, [partKey]: i }
            const selected = l[partKey] === i
            return (
              <button
                key={name}
                type="button"
                onClick={() => set({ [partKey]: i } as Partial<Look>)}
                className={`squish flex flex-col items-center rounded-2xl px-0.5 pb-1.5 pt-1.5 ${
                  selected ? 'bg-white shadow-[0_0_0_3px_var(--color-accent)]' : 'bg-white/60'
                }`}
              >
                <CharacterSvg look={preview} size={partKey === 'outfit' ? 34 : 48} headOnly={partKey !== 'outfit'} />
                <span className="mt-1 line-clamp-2 text-center text-[10px] leading-tight">{name}</span>
              </button>
            )
          })}
        </div>
      )}

      {tab === 'color' && (
        <div className="flex w-full flex-col gap-3">
          <Swatches label="머리색" colors={HAIR_COLORS} value={l.hairColor} onPick={(i) => set({ hairColor: i })} />
          <Swatches label="눈 색" colors={EYE_COLORS} value={l.eyeColor} onPick={(i) => set({ eyeColor: i })} />
          <Swatches label="옷 색" colors={OUTFIT_COLORS} value={l.outfitColor} onPick={(i) => set({ outfitColor: i })} firstLabel="기본" />
          <Swatches label="피부색" colors={SKINS} value={l.skin} onPick={(i) => set({ skin: i })} />
          <Swatches label="내 말풍선 색" colors={COLORS} value={Math.max(0, COLORS.indexOf(color))} onPick={(i) => onChange({ color: COLORS[i] })} />
        </div>
      )}
    </div>
  )
}
