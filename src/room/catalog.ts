export type Kind = 'bed' | 'sofa' | 'desk' | 'chair' | 'cabinet' | 'rug' | 'plant' | 'lamp'

export type RoomItem = {
  id: string
  kind: Kind
  design: number
  color: string
  u: number
  v: number
  flip?: boolean
}

export type RoomData = {
  ver: 1
  wall: { type: number; color: string }
  floor: { type: number; color: string }
  items: RoomItem[]
  char: { u: number; v: number }
}

export const FURN_COLORS = ['#F7C5CF', '#FFE2A8', '#BFE3C9', '#BFD9F2', '#D9CCF2', '#F5F0E8', '#D9A877', '#8C6B5A', '#5E5A66']
export const WALL_COLORS = ['#F3DCDD', '#FCEFD9', '#DDEFE3', '#DCE8F7', '#E9E1F7', '#FBF8F4', '#F7E6CF', '#E8D2C2']
export const FLOOR_COLORS = ['#F5D7A1', '#E3B47E', '#C98F5E', '#F2E8DC', '#D6E4EE', '#E8D9EC', '#CFE6D4', '#B9A08A']

export const WALL_TYPES = ['민무늬', '스트라이프', '도트', '체크', '하트']
export const FLOOR_TYPES = ['원목', '타일', '체커보드', '카펫', '헤링본 마루']

export const CATALOG: { kind: Kind; label: string; designs: string[]; color: string; box: string }[] = [
  { kind: 'bed', label: '침대', designs: ['원목 침대', '아치 침대', '포스트 침대'], color: '#F7C5CF', box: '-100 -150 200 156' },
  { kind: 'sofa', label: '소파', designs: ['둥근 소파', '각진 소파', '버튼 소파'], color: '#BFD9F2', box: '-100 -95 200 100' },
  { kind: 'desk', label: '책상', designs: ['기본 책상', '서랍 책상', '노트북 책상'], color: '#D9A877', box: '-75 -110 150 115' },
  { kind: 'chair', label: '의자', designs: ['나무 의자', '동그란 스툴', '폭신 암체어'], color: '#FFE2A8', box: '-45 -100 90 105' },
  { kind: 'cabinet', label: '수납장', designs: ['서랍장', '책장', '옷장'], color: '#F5F0E8', box: '-55 -165 110 170' },
  { kind: 'rug', label: '러그', designs: ['동그란 러그', '테두리 러그', '줄무늬 러그'], color: '#D9CCF2', box: '' },
  { kind: 'plant', label: '화분', designs: ['몬스테라', '선인장', '동글 나무'], color: '#F5F0E8', box: '-40 -120 80 125' },
  { kind: 'lamp', label: '조명', designs: ['스탠드 조명', '동그란 조명', '삼각대 조명'], color: '#FFE2A8', box: '-40 -165 80 170' },
]

export const catalogOf = (k: Kind) => CATALOG.find((c) => c.kind === k)!

export const MAX_ITEMS = 30

export const DEFAULT_ROOM: RoomData = {
  ver: 1,
  wall: { type: 0, color: '#F3DCDD' },
  floor: { type: 0, color: '#F5D7A1' },
  items: [
    { id: 'rug1', kind: 'rug', design: 0, color: '#D9CCF2', u: 0.5, v: 0.32 },
    { id: 'bed1', kind: 'bed', design: 0, color: '#F7C5CF', u: 0.24, v: 0.06 },
    { id: 'plant1', kind: 'plant', design: 0, color: '#F5F0E8', u: 0.86, v: 0.12 },
  ],
  char: { u: 0.55, v: 0.38 },
}

const KINDS = CATALOG.map((c) => c.kind)
const num = (n: unknown, d: number) => (typeof n === 'number' && Number.isFinite(n) ? n : d)
const hex = (s: unknown, d: string) => (typeof s === 'string' && /^#[0-9A-Fa-f]{6}$/.test(s) ? s : d)
const idx = (n: unknown, len: number) => {
  const v = num(n, 0)
  return Number.isInteger(v) && v >= 0 && v < len ? v : 0
}
const clamp01 = (n: unknown, d: number) => Math.min(1, Math.max(0, num(n, d)))

/** 저장된 값이 깨져 있어도 안전하게 복원 */
export function sanitizeRoom(raw: unknown): RoomData {
  if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_ROOM)
  const r = raw as Partial<RoomData>
  const items = Array.isArray(r.items) ? r.items : []
  return {
    ver: 1,
    wall: { type: idx(r.wall?.type, WALL_TYPES.length), color: hex(r.wall?.color, DEFAULT_ROOM.wall.color) },
    floor: { type: idx(r.floor?.type, FLOOR_TYPES.length), color: hex(r.floor?.color, DEFAULT_ROOM.floor.color) },
    items: items
      .filter((it): it is RoomItem => !!it && KINDS.includes((it as RoomItem).kind))
      .slice(0, MAX_ITEMS)
      .map((it) => ({
        id: typeof it.id === 'string' ? it.id.slice(0, 16) : Math.random().toString(36).slice(2, 10),
        kind: it.kind,
        design: idx(it.design, 3),
        color: hex(it.color, catalogOf(it.kind).color),
        u: clamp01(it.u, 0.5),
        v: clamp01(it.v, 0.3),
        flip: !!it.flip,
      })),
    char: { u: clamp01(r.char?.u, 0.5), v: clamp01(r.char?.v, 0.35) },
  }
}
