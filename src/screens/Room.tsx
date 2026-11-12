import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { parseLook } from '../look'
import type { Profile } from '../types'
import RoomScene, { WallPattern } from '../room/RoomScene'
import { Sprite } from '../room/Furniture'
import {
  CATALOG,
  DEFAULT_ROOM,
  FLOOR_COLORS,
  FLOOR_TYPES,
  FURN_COLORS,
  MAX_ITEMS,
  WALL_COLORS,
  WALL_TYPES,
  catalogOf,
  sanitizeRoom,
  type Kind,
  type RoomData,
  type RoomItem,
} from '../room/catalog'

type Status = 'loading' | 'idle' | 'saving' | 'saved' | 'error'
type Panel = 'furniture' | 'wall' | 'floor'

const SAVE_DELAY = 900

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

function Thumb({ kind, design, color }: { kind: Kind; design: number; color: string }) {
  if (kind === 'rug')
    return (
      <svg viewBox="-60 -30 120 60" className="h-12 w-full">
        <ellipse cx="0" cy="0" rx="54" ry="24" fill={color} stroke="#3E2B25" strokeWidth="2" />
        <ellipse cx="0" cy="0" rx="38" ry="16" fill="none" stroke="#fff" strokeWidth="2.4" strokeDasharray="5 4" opacity=".7" />
      </svg>
    )
  return (
    <svg viewBox={catalogOf(kind).box} className="h-12 w-full">
      <Sprite kind={kind} design={design} color={color} />
    </svg>
  )
}

export default function Room({ me }: { me: Profile }) {
  const [data, setData] = useState<RoomData | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [selected, setSelected] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>('furniture')
  const pending = useRef(false)
  const latest = useRef<RoomData | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const uid = useId().replace(/:/g, '')
  const look = useMemo(() => parseLook(me.emoji), [me.emoji])

  // ---------- 불러오기 ----------
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: row, error } = await supabase.from('rooms').select('data').eq('user_id', me.id).maybeSingle()
      if (!alive) return
      if (error) {
        console.error(error)
        setStatus('error')
      } else setStatus('idle')
      const room = row?.data ? sanitizeRoom(row.data) : structuredClone(DEFAULT_ROOM)
      latest.current = room
      setData(room)
    })()
    return () => {
      alive = false
    }
  }, [me.id])

  // ---------- 저장 (바뀌고 잠시 뒤 자동 저장) ----------
  const save = useCallback(async () => {
    if (!latest.current) return
    pending.current = false
    setStatus('saving')
    const { error } = await supabase
      .from('rooms')
      .upsert({ user_id: me.id, data: latest.current, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) {
      console.error(error)
      setStatus('error')
    } else if (!pending.current) setStatus('saved')
  }, [me.id])

  const update = useCallback(
    (fn: (d: RoomData) => RoomData) => {
      setData((d) => {
        if (!d) return d
        const next = fn(d)
        latest.current = next
        return next
      })
      pending.current = true
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(save, SAVE_DELAY)
    },
    [save],
  )

  // 화면을 떠날 때 저장 안 된 변경이 있으면 바로 저장
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      if (pending.current) save()
    },
    [save],
  )

  if (!data) {
    return (
      <div className="grid h-full place-items-center bg-gradient-to-b from-[#FFF0F5] to-[#EAF5FF]">
        <p className="font-cute text-ink-soft">방을 불러오는 중…</p>
      </div>
    )
  }

  const item = selected && selected !== 'char' ? data.items.find((i) => i.id === selected) ?? null : null
  const setItem = (patch: Partial<RoomItem>) => update((d) => ({ ...d, items: d.items.map((i) => (i.id === selected ? { ...i, ...patch } : i)) }))

  function addItem(kind: Kind) {
    if (data!.items.length >= MAX_ITEMS) return
    const id = Math.random().toString(36).slice(2, 10)
    const it: RoomItem = {
      id,
      kind,
      design: 0,
      color: catalogOf(kind).color,
      u: 0.5 + (Math.random() - 0.5) * 0.3,
      v: kind === 'rug' ? 0.4 : 0.2 + Math.random() * 0.15,
    }
    update((d) => ({ ...d, items: [...d.items, it] }))
    setSelected(id)
  }

  const statusText =
    status === 'loading' ? '' : status === 'saving' ? '저장 중…' : status === 'saved' ? '저장됨 ✓' : status === 'error' ? '저장 실패' : '자동 저장'

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#FFF0F5] to-[#EAF5FF]">
      <header className="flex items-center justify-between px-5 pb-2 pt-5">
        <div>
          <h1 className="font-cute text-2xl leading-tight">내 방</h1>
          <p className="text-xs text-ink-soft">가구와 캐릭터를 끌어서 옮겨 보세요</p>
        </div>
        <button
          onClick={() => status === 'error' && save()}
          className={`rounded-full px-3 py-1.5 text-xs ${status === 'error' ? 'bg-[#E25A6A] text-white' : 'bg-white/70 text-ink-soft'}`}
        >
          {status === 'error' ? '저장 실패 · 다시 시도' : statusText}
        </button>
      </header>

      <div className="px-3">
        <div className="overflow-hidden rounded-3xl border-2 border-white shadow-[0_8px_24px_rgba(120,110,170,0.15)]">
          <RoomScene
            data={data}
            look={look}
            sleeping={me.status === 'sleep'}
            selected={selected}
            onSelect={setSelected}
            onMoveItem={(id, u, v) => update((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, u, v } : i)) }))}
            onMoveChar={(u, v) => update((d) => ({ ...d, char: { u, v } }))}
            className="h-auto w-full"
          />
        </div>
      </div>

      <div className="no-scrollbar mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {item ? (
          <section className="rounded-[24px] border-2 border-white bg-white/75 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-cute text-lg">{catalogOf(item.kind).label} 꾸미기</h2>
              <button onClick={() => setSelected(null)} className="rounded-full bg-white px-3 py-1 text-xs text-ink-soft">
                완료
              </button>
            </div>
            <span className="mb-1.5 block text-sm text-ink-soft">디자인</span>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {catalogOf(item.kind).designs.map((name, i) => (
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
            <span className="mb-1.5 block text-sm text-ink-soft">색상</span>
            <Swatches colors={FURN_COLORS} value={item.color} onPick={(c) => setItem({ color: c })} />
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
        ) : (
          <section className="rounded-[24px] border-2 border-white bg-white/75 p-4">
            {selected === 'char' && <p className="mb-3 text-center text-xs text-ink-soft">내 캐릭터예요. 끌어서 방 안 어디로든 옮길 수 있어요.</p>}
            <div className="mb-3 grid grid-cols-3 gap-1 rounded-2xl bg-white/70 p-1">
              {(
                [
                  ['furniture', '가구'],
                  ['wall', '벽지'],
                  ['floor', '바닥'],
                ] as [Panel, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setPanel(id)}
                  className={`squish rounded-xl py-2 font-cute text-sm ${panel === id ? 'bg-accent text-white' : 'text-ink-soft'}`}
                >
                  {label}
                </button>
              ))}
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
                  {data.items.length >= MAX_ITEMS
                    ? `가구는 최대 ${MAX_ITEMS}개까지 놓을 수 있어요.`
                    : '눌러서 추가하고, 방에서 가구를 누르면 디자인·색·삭제를 바꿀 수 있어요.'}
                </p>
              </>
            )}

            {panel === 'wall' && (
              <>
                <span className="mb-1.5 block text-sm text-ink-soft">벽지</span>
                <div className="mb-4 grid grid-cols-5 gap-2">
                  {WALL_TYPES.map((name, i) => (
                    <button
                      key={name}
                      onClick={() => update((d) => ({ ...d, wall: { ...d.wall, type: i } }))}
                      className={`squish flex flex-col items-center rounded-2xl px-1 py-1.5 ${data.wall.type === i ? 'bg-white shadow-[0_0_0_3px_var(--color-accent)]' : 'bg-white/60'}`}
                    >
                      <svg viewBox="0 0 60 60" className="h-10 w-10 rounded-xl">
                        <defs>
                          <WallPattern id={`tw${uid}${i}`} type={i} color={data.wall.color} />
                        </defs>
                        <rect width="60" height="60" fill={data.wall.color} />
                        {i > 0 && <rect width="60" height="60" fill={`url(#tw${uid}${i})`} />}
                      </svg>
                      <span className="mt-1 text-[11px]">{name}</span>
                    </button>
                  ))}
                </div>
                <span className="mb-1.5 block text-sm text-ink-soft">색상</span>
                <Swatches colors={WALL_COLORS} value={data.wall.color} onPick={(c) => update((d) => ({ ...d, wall: { ...d.wall, color: c } }))} />
              </>
            )}

            {panel === 'floor' && (
              <>
                <span className="mb-1.5 block text-sm text-ink-soft">바닥재</span>
                <div className="mb-4 grid grid-cols-5 gap-2">
                  {FLOOR_TYPES.map((name, i) => (
                    <button
                      key={name}
                      onClick={() => update((d) => ({ ...d, floor: { ...d.floor, type: i } }))}
                      className={`squish rounded-2xl px-1 py-3 text-[11px] ${data.floor.type === i ? 'bg-white shadow-[0_0_0_3px_var(--color-accent)]' : 'bg-white/60'}`}
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
        )}
      </div>
    </div>
  )
}
