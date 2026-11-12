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
  ver: 2
  wall: { type: number; color: string }
  floor: { type: number; color: string }
  items: RoomItem[]
  char: { u: number; v: number }
  /** 내 방(=광장)에 놀러 온 친구들 위치 */
  guests: Record<string, { u: number; v: number }>
}

/** 시트에서 잘라낸 PNG 가구 (색은 색조 회전으로 변경) */
export const PNG_KINDS: Kind[] = ['bed', 'sofa', 'desk', 'chair', 'cabinet', 'rug']
export const isPng = (k: Kind) => PNG_KINDS.includes(k)
export const HUE_SWATCHES: { hex: string; hue: number }[] = [
  { hex: '#F7C5CF', hue: 0 },
  { hex: '#FFD8B8', hue: 28 },
  { hex: '#FFE9A8', hue: 58 },
  { hex: '#BFE3C9', hue: 135 },
  { hex: '#BFD9F2', hue: 195 },
  { hex: '#D9CCF2', hue: 250 },
]
export const hueOf = (hex: string) => HUE_SWATCHES.find((h) => h.hex.toLowerCase() === hex.toLowerCase())?.hue ?? 0

export const FURN_COLORS = ['#F7C5CF', '#FFE2A8', '#BFE3C9', '#BFD9F2', '#D9CCF2', '#F5F0E8', '#D9A877', '#8C6B5A', '#5E5A66']
export const WALL_COLORS = ['#F3DCDD', '#FCEFD9', '#DDEFE3', '#DCE8F7', '#E9E1F7', '#FBF8F4', '#F7E6CF', '#E8D2C2']
export const FLOOR_COLORS = ['#F5D7A1', '#E3B47E', '#C98F5E', '#F2E8DC', '#D6E4EE', '#E8D9EC', '#CFE6D4', '#B9A08A']

export const WALL_TYPES = ['기본 핑크', '크림', '스트라이프', '하트', '체크']
/** 벽지 종류 → 그리는 무늬 (0 민무늬, 1 스트라이프, 3 체크, 4 하트) */
export const WALL_PATTERN = [0, 0, 1, 4, 3]
export const WALL_PRESET = ['#F3DCDD', '#FBF1E3', '', '', '']
export const FLOOR_TYPES = ['우드 (밝은 톤)', '우드 (진한 톤)', '화이트 우드', '헤링본', '타일']
/** 바닥 종류 → 그리는 무늬 (0 원목, 1 타일, 4 헤링본) */
export const FLOOR_PATTERN = [0, 0, 0, 4, 1]
export const FLOOR_PRESET = ['#F5D7A1', '#C98F5E', '#F4EEE6', '', '']

export const CATALOG: { kind: Kind; label: string; designs: string[]; color: string; box: string }[] = [
  { kind: 'bed', label: '침대', designs: ['기본'], color: '#F7C5CF', box: '' },
  { kind: 'sofa', label: '소파', designs: ['기본'], color: '#F7C5CF', box: '' },
  { kind: 'desk', label: '책상', designs: ['기본'], color: '#F7C5CF', box: '' },
  { kind: 'chair', label: '의자', designs: ['기본'], color: '#F7C5CF', box: '' },
  { kind: 'cabinet', label: '수납장', designs: ['기본'], color: '#F7C5CF', box: '' },
  { kind: 'rug', label: '러그', designs: ['기본'], color: '#F7C5CF', box: '' },
  { kind: 'plant', label: '화분', designs: ['몬스테라', '선인장', '동글 나무'], color: '#F5F0E8', box: '-40 -120 80 125' },
  { kind: 'lamp', label: '조명', designs: ['스탠드 조명', '동그란 조명', '삼각대 조명'], color: '#FFE2A8', box: '-40 -165 80 170' },
]

export const catalogOf = (k: Kind) => CATALOG.find((c) => c.kind === k)!

export const MAX_ITEMS = 30

export const DEFAULT_ROOM: RoomData = {
  ver: 2,
  wall: { type: 0, color: '#F3DCDD' },
  floor: { type: 0, color: '#F5D7A1' },
  items: [
    { id: 'rug1', kind: 'rug', design: 0, color: '#F7C5CF', u: 0.5, v: 0.32 },
    { id: 'bed1', kind: 'bed', design: 0, color: '#F7C5CF', u: 0.24, v: 0.06 },
    { id: 'sofa1', kind: 'sofa', design: 0, color: '#F7C5CF', u: 0.62, v: 0.05 },
    { id: 'plant1', kind: 'plant', design: 0, color: '#F5F0E8', u: 0.86, v: 0.12 },
  ],
  char: { u: 0.5, v: 0.4 },
  guests: {},
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
  const r = raw as Partial<RoomData> & { ver?: number }
  const items = Array.isArray(r.items) ? r.items : []
  // 1차 저장본의 벽지·바닥 번호를 새 목록 번호로 변환
  const old = r.ver !== 2
  const wt = idx(r.wall?.type, 5)
  const ft = idx(r.floor?.type, 5)
  const g = r.guests && typeof r.guests === 'object' ? r.guests : {}
  return {
    ver: 2,
    wall: { type: old ? [0, 2, 0, 4, 3][wt] : wt, color: hex(r.wall?.color, DEFAULT_ROOM.wall.color) },
    floor: { type: old ? [0, 4, 4, 0, 3][ft] : ft, color: hex(r.floor?.color, DEFAULT_ROOM.floor.color) },
    items: items
      .filter((it): it is RoomItem => !!it && KINDS.includes((it as RoomItem).kind))
      .slice(0, MAX_ITEMS)
      .map((it) => ({
        id: typeof it.id === 'string' ? it.id.slice(0, 16) : Math.random().toString(36).slice(2, 10),
        kind: it.kind,
        design: isPng(it.kind) ? 0 : idx(it.design, 3),
        color: hex(it.color, catalogOf(it.kind).color),
        u: clamp01(it.u, 0.5),
        v: clamp01(it.v, 0.3),
        flip: !!it.flip,
      })),
    char: { u: clamp01(r.char?.u, 0.5), v: clamp01(r.char?.v, 0.35) },
    guests: Object.fromEntries(
      Object.entries(g)
        .filter(([k]) => /^[0-9a-f-]{36}$/.test(k))
        .slice(0, 60)
        .map(([k, p]) => [k, { u: clamp01((p as { u: number }).u, 0.5), v: clamp01((p as { v: number }).v, 0.4) }]),
    ),
  }
}
