import { useState } from 'react'
import { CharacterSvg } from './Avatar'
import { COLORS } from '../types'
import {
  ACC_NAMES,
  BOTTOM_NAMES,
  EXPR_NAMES,
  EYE_NAMES,
  HAIR_COLORS,
  HAIR_NAMES,
  HAT_NAMES,
  ONE_NAMES,
  SHOE_NAMES,
  SKINS,
  TOP_NAMES,
  encodeLook,
  parseLook,
  type Gender,
  type Look,
} from '../look'

type Props = {
  nickname: string
  look: string
  color: string
  onChange: (v: { nickname?: string; look?: string; color?: string }) => void
}

type TabId = 'hair' | 'eyes' | 'expr' | 'top' | 'bottom' | 'one' | 'shoes' | 'hat' | 'acc' | 'color'
const TABS: { id: TabId; label: string; head?: boolean; none?: boolean }[] = [
  { id: 'hair', label: '헤어', head: true },
  { id: 'eyes', label: '눈', head: true },
  { id: 'expr', label: '표정', head: true },
  { id: 'top', label: '상의' },
  { id: 'bottom', label: '하의' },
  { id: 'one', label: '원피스·세트', none: true },
  { id: 'shoes', label: '신발' },
  { id: 'hat', label: '모자', head: true, none: true },
  { id: 'acc', label: '안경·소품', head: true, none: true },
  { id: 'color', label: '색상' },
]

function Swatches({ label, colors, value, onPick, originalLabel }: { label: string; colors: string[]; value: number; onPick: (i: number) => void; originalLabel?: string }) {
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
            aria-label={`${label} ${c ? i : originalLabel}`}
          >
            {!c && originalLabel}
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
  const cur = TABS.find((t) => t.id === tab)!

  const names: Record<Exclude<TabId, 'color'>, readonly string[]> = {
    hair: HAIR_NAMES[l.g],
    eyes: EYE_NAMES,
    expr: EXPR_NAMES,
    top: TOP_NAMES,
    bottom: BOTTOM_NAMES,
    one: ONE_NAMES,
    shoes: SHOE_NAMES,
    hat: HAT_NAMES,
    acc: ACC_NAMES,
  }

  // 상의·하의를 고르면 원피스는 벗고, 원피스를 고르면 상·하의 대신 입음
  const pick = (key: Exclude<TabId, 'color'>, i: number): Partial<Look> =>
    key === 'top' || key === 'bottom' ? { [key]: i, one: -1 } : ({ [key]: i } as Partial<Look>)
  const isOn = (key: Exclude<TabId, 'color'>, i: number) =>
    key === 'top' || key === 'bottom' ? l.one < 0 && l[key] === i : l[key] === i

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 실시간 미리보기 */}
      <div className="bob">
        <CharacterSvg look={l} size={130} />
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
      <div className="no-scrollbar -mx-1 flex w-full gap-1.5 overflow-x-auto px-1">
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

      {tab !== 'color' && (
        <div className="grid w-full grid-cols-3 gap-1.5">
          {cur.none && (
            <button
              type="button"
              onClick={() => set({ [tab]: -1 } as Partial<Look>)}
              className={`squish flex flex-col items-center justify-center rounded-2xl py-3 text-xs ${
                l[tab as 'one' | 'hat' | 'acc'] < 0 ? 'bg-white shadow-[0_0_0_3px_var(--color-accent)]' : 'bg-white/60'
              }`}
            >
              <span className="mb-1 text-2xl">🚫</span>
              {tab === 'one' ? '상·하의 입기' : '없음'}
            </button>
          )}
          {names[tab].map((name, i) => {
            const preview = { ...l, ...pick(tab, i) }
            return (
              <button
                key={name}
                type="button"
                onClick={() => set(pick(tab, i))}
                className={`squish flex flex-col items-center rounded-2xl px-0.5 pb-1.5 pt-1.5 ${
                  isOn(tab, i) ? 'bg-white shadow-[0_0_0_3px_var(--color-accent)]' : 'bg-white/60'
                }`}
              >
                <CharacterSvg look={preview} size={cur.head ? 64 : 46} headOnly={cur.head} />
                <span className="mt-1 line-clamp-2 text-center text-[11px] leading-tight">{name}</span>
              </button>
            )
          })}
        </div>
      )}

      {tab === 'color' && (
        <div className="flex w-full flex-col gap-3">
          <Swatches label="머리색" colors={HAIR_COLORS} value={l.hairColor} onPick={(i) => set({ hairColor: i })} originalLabel="원래" />
          <Swatches label="피부색" colors={SKINS} value={l.skin} onPick={(i) => set({ skin: i })} originalLabel="원래" />
          <Swatches label="내 말풍선 색" colors={COLORS} value={Math.max(0, COLORS.indexOf(color))} onPick={(i) => onChange({ color: COLORS[i] })} />
          <p className="text-xs text-ink-soft">옷·신발·모자는 그림 원래 색으로만 나와요.</p>
        </div>
      )}
    </div>
  )
}
