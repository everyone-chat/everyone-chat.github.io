import { useId, useState } from 'react'
import { WallPattern } from './RoomScene'
import { Sprite, furnSrc } from './Furniture'
import {
  CATALOG,
  FLOOR_COLORS,
  FLOOR_PRESET,
  FLOOR_TYPES,
  FURN_COLORS,
  HUE_SWATCHES,
  MAX_ITEMS,
  WALL_COLORS,
  WALL_PATTERN,
  WALL_PRESET,
  WALL_TYPES,
  catalogOf,
  isPng,
  type Kind,
  type RoomData,
  type RoomItem,
} from './catalog'

type Panel = 'furniture' | 'wall' | 'floor'

function Swatches({ colors, value, onPick }: { colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          className={`squish h-9 w-9 rounded-full border-[3px] ${c.toLowerCase() === value.toLowerCase() ? 'border-accent' : 'border-white'}`}
          style={{ background: c }}
          aria-label={`색 ${c}`}
        />
      ))}
    </div>
  )
}

const SVG_BOX: Partial<Record<Kind, string>> = { plant: '-40 -120 80 125', lamp: '-40 -165 80 170' }

function Thumb({ kind, design, color }: { kind: Kind; design: number; color: string }) {
  if (isPng(kind)) return <img src={furnSrc(kind)} alt="" className="h-12 w-full object-contain" draggable={false} />
  return (
    <svg viewBox={SVG_BOX[kind]} className="h-12 w-full">
      <Sprite kind={kind as Exclude<Kind, 'rug'>} design={design} color={color} />
    </svg>
  )
}

type Props = {
  data: RoomData
  update: (fn: (d: RoomData) => RoomData) => void
  selected: string | null
  setSelected: (id: string | null) => void
  onDone: () => void
}

export default function RoomEditor({ data, update, selected, setSelected, onDone }: Props) {
  const [panel, setPanel] = useState<Panel>('furniture')
  const uid = useId().replace(/:/g, '')
  const item = selected && !selected.startsWith('p:') ? data.items.find((i) => i.id === selected) ?? null : null
  const setItem = (patch: Partial<RoomItem>) => update((d) => ({ ...d, items: d.items.map((i) => (i.id === selected ? { ...i, ...patch } : i)) }))

  function addItem(kind: Kind) {
    if (data.items.length >= MAX_ITEMS) return
    const id = Math.random().toString(36).slice(2, 10)
    const it: RoomItem = {
      id,
      kind,
      design: 0,
      color: catalogOf(kind).color,
      u: 0.5 + (Math.random() - 0.5) * 0.3,
      v: kind === 'rug' ? 0.4 : 0.15 + Math.random() * 0.15,
    }
    update((d) => ({ ...d, items: [...d.items, it] }))
    setSelected(id)
  }

  if (item) {
    const cat = catalogOf(item.kind)
    return (
      <section className="rounded-[24px] border-2 border-white bg-white/75 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-cute text-lg">{cat.label} 꾸미기</h2>
          <button onClick={() => setSelected(null)} className="rounded-full bg-white px-3 py-1 text-xs text-ink-soft">
            선택 해제
          </button>
        </div>
        {cat.designs.length > 1 && (
          <>
            <span className="mb-1.5 block text-sm text-ink-soft">디자인</span>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {cat.designs.map((name, i) => (
                <button
                  key={name}
                  onClick={() => setItem({ design: i })}
                  className={`squish flex flex-col items-center rounded-2xl px-1 py-2 ${item.design === i ? 'bg-white shadow-[0_0_0_3px_var(--color-accent)]' : 'bg-white/60'}`}
                >
                  <Thumb kind={item.kind} design={i} color={item.color} />
                  <span className="mt-1 text-[11px]">{name}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <span className="mb-1.5 block text-sm text-ink-soft">색상</span>
        <Swatches colors={isPng(item.kind) ? HUE_SWATCHES.map((h) => h.hex) : FURN_COLORS} value={item.color} onPick={(c) => setItem({ color: c })} />
        <div className="mt-4 grid grid-cols-2 gap-2">
          {item.kind !== 'rug' && (
            <button onClick={() => setItem({ flip: !item.flip })} className="squish rounded-2xl bg-white py-2.5 text-sm">
              ↔ 좌우 반전
            </button>
          )}
          <button
            onClick={() => {
              update((d) => ({ ...d, items: d.items.filter((i) => i.id !== item.id) }))
              setSelected(null)
            }}
            className={`squish rounded-2xl bg-white py-2.5 text-sm text-[#E25A6A] ${item.kind === 'rug' ? 'col-span-2' : ''}`}
          >
            🗑 삭제
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-[24px] border-2 border-white bg-white/75 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="grid flex-1 grid-cols-3 gap-1 rounded-2xl bg-white/70 p-1">
          {(
            [
              ['furniture', '가구'],
              ['wall', '벽지'],
              ['floor', '바닥'],
            ] as [Panel, string][]
          ).map(([id, label]) => (
            <button key={id} onClick={() => setPanel(id)} className={`squish rounded-xl py-2 font-cute text-sm ${panel === id ? 'bg-accent text-white' : 'text-ink-soft'}`}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={onDone} className="squish rounded-2xl bg-ink px-3 py-2.5 font-cute text-sm text-white">
          완료
        </button>
      </div>

      {panel === 'furniture' && (
        <>
          <div className="grid grid-cols-4 gap-2">
            {CATALOG.map((c) => (
              <button
                key={c.kind}
                onClick={() => addItem(c.kind)}
                disabled={data.items.length >= MAX_ITEMS}
                className="squish flex flex-col items-center rounded-2xl bg-white/80 px-1 py-2 disabled:opacity-40"
              >
                <Thumb kind={c.kind} design={0} color={c.color} />
                <span className="mt-1 text-xs">{c.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-ink-soft">
            {data.items.length >= MAX_ITEMS ? `가구는 최대 ${MAX_ITEMS}개까지 놓을 수 있어요.` : '눌러서 추가하고, 방에서 가구를 끌어 옮기거나 눌러서 색·반전·삭제를 바꿔요.'}
          </p>
        </>
      )}

      {panel === 'wall' && (
        <>
          <span className="mb-1.5 block text-sm text-ink-soft">벽지</span>
          <div className="mb-4 grid grid-cols-5 gap-2">
            {WALL_TYPES.map((name, i) => {
              const c = WALL_PRESET[i] || data.wall.color
              return (
                <button
                  key={name}
                  onClick={() => update((d) => ({ ...d, wall: { type: i, color: WALL_PRESET[i] || d.wall.color } }))}
                  className={`squish flex flex-col items-center rounded-2xl px-1 py-1.5 ${data.wall.type === i ? 'bg-white shadow-[0_0_0_3px_var(--color-accent)]' : 'bg-white/60'}`}
                >
                  <svg viewBox="0 0 60 60" className="h-10 w-10 rounded-xl">
                    <defs>
                      <WallPattern id={`tw${uid}${i}`} type={WALL_PATTERN[i]} color={c} />
                    </defs>
                    <rect width="60" height="60" fill={c} />
                    {WALL_PATTERN[i] > 0 && <rect width="60" height="60" fill={`url(#tw${uid}${i})`} />}
                  </svg>
                  <span className="mt-1 text-[11px]">{name}</span>
                </button>
              )
            })}
          </div>
          <span className="mb-1.5 block text-sm text-ink-soft">색상</span>
          <Swatches colors={WALL_COLORS} value={data.wall.color} onPick={(c) => update((d) => ({ ...d, wall: { ...d.wall, color: c } }))} />
        </>
      )}

      {panel === 'floor' && (
        <>
          <span className="mb-1.5 block text-sm text-ink-soft">바닥</span>
          <div className="mb-4 grid grid-cols-5 gap-2">
            {FLOOR_TYPES.map((name, i) => (
              <button
                key={name}
                onClick={() => update((d) => ({ ...d, floor: { type: i, color: FLOOR_PRESET[i] || d.floor.color } }))}
                className={`squish rounded-2xl px-1 py-2.5 text-[11px] leading-tight ${data.floor.type === i ? 'bg-white shadow-[0_0_0_3px_var(--color-accent)]' : 'bg-white/60'}`}
              >
                {name}
              </button>
            ))}
          </div>
          <span className="mb-1.5 block text-sm text-ink-soft">색상</span>
          <Swatches colors={FLOOR_COLORS} value={data.floor.color} onPick={(c) => update((d) => ({ ...d, floor: { ...d.floor, color: c } }))} />
        </>
      )}
    </section>
  )
}
