import { useId, useRef, type ReactNode } from 'react'
import { CharacterSvg } from '../components/Avatar'
import type { Look } from '../look'
import { CM_U, CM_V, H, K, W, clampUV, fromScreen, pt, scaleAt, shade, toScreen } from './geometry'
import { FOL, RUG_SIZE, Sprite } from './Furniture'
import type { RoomData, RoomItem } from './catalog'

const EDGE = '#A9706A'
const FLOOR_POLY = '0,335 130,278 568,278 720,355 720,405 0,405'
const LEFT_POLY = '0,0 40,0 130,55 130,278 0,335'
const RIGHT_POLY = '640,0 720,0 720,355 568,278 568,55'
const CEIL_POLY = '40,0 640,0 568,55 130,55'

// 캐릭터 실제 키 (cm) — 가구와 같은 비율로 보이게
const CHAR_CM = 106

type Props = {
  data: RoomData
  look: Look
  sleeping?: boolean
  selected?: string | null
  onSelect?: (id: string | null) => void
  onMoveItem?: (id: string, u: number, v: number) => void
  onMoveChar?: (u: number, v: number) => void
  className?: string
}

// ---------------------------------------------------------
// 벽지 패턴 (색은 벽 색에서 자동으로 만든 진한 톤)
// ---------------------------------------------------------
export function WallPattern({ id, type, color, transform }: { id: string; type: number; color: string; transform?: string }) {
  const tint = shade(color, -0.12)
  const light = shade(color, 0.45)
  if (type === 0) return null
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={type === 1 ? 26 : type === 3 ? 34 : type === 4 ? 40 : 30} height={type === 1 ? 10 : type === 3 ? 34 : type === 4 ? 40 : 30} patternTransform={transform}>
      {type === 1 && <rect x="0" y="0" width="13" height="10" fill={tint} opacity=".45" />}
      {type === 2 && (
        <>
          <circle cx="8" cy="8" r="3" fill={tint} opacity=".7" />
          <circle cx="23" cy="23" r="3" fill={light} />
        </>
      )}
      {type === 3 && (
        <>
          <rect x="0" y="0" width="34" height="14" fill={tint} opacity=".28" />
          <rect x="0" y="0" width="14" height="34" fill={tint} opacity=".28" />
        </>
      )}
      {type === 4 && (
        <>
          <path d="M12 16 C12 13 8 11 6.5 13.5 C5 16 8 18.5 12 21.5 C16 18.5 19 16 17.5 13.5 C16 11 12 13 12 16 Z" fill={tint} opacity=".6" />
          <path d="M32 36 C32 33 28 31 26.5 33.5 C25 36 28 38.5 32 41.5 C36 38.5 39 36 37.5 33.5 C36 31 32 33 32 36 Z" fill={light} />
        </>
      )}
    </pattern>
  )
}

// ---------------------------------------------------------
// 바닥재 (원근에 맞춰 선을 계산)
// ---------------------------------------------------------
const rows = (n: number, pow = 1.25) => Array.from({ length: n + 1 }, (_, k) => Math.pow(k / n, pow))
const seg = (u1: number, v1: number, u2: number, v2: number) => {
  const a = toScreen(u1, v1)
  const b = toScreen(u2, v2)
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}

function FloorPattern({ type, color }: { type: number; color: string }) {
  const ln = shade(color, -0.14)
  const paths: string[] = []
  const fills: ReactNode[] = []
  if (type === 0) {
    // 원목 마루
    const r = rows(9)
    r.forEach((v) => paths.push(seg(-0.2, v, 1.2, v)))
    for (let i = 0; i < r.length - 1; i++)
      for (let u = (i % 2) * 0.13; u < 1.1; u += 0.26) paths.push(seg(u, r[i], u, r[i + 1]))
  } else if (type === 1) {
    // 타일
    rows(7, 1.15).forEach((v) => paths.push(seg(-0.2, v, 1.2, v)))
    for (let u = 0; u <= 1.001; u += 1 / 8) paths.push(seg(u, 0, u, 1))
  } else if (type === 2) {
    // 체커보드
    const r = rows(7, 1.15)
    for (let i = 0; i < r.length - 1; i++)
      for (let j = 0; j < 8; j++)
        if ((i + j) % 2 === 0) {
          const u1 = j / 8
          const u2 = (j + 1) / 8
          const pts = [toScreen(u1, r[i]), toScreen(u2, r[i]), toScreen(u2, r[i + 1]), toScreen(u1, r[i + 1])].map(pt).join(' ')
          fills.push(<polygon key={`${i}-${j}`} points={pts} fill={shade(color, -0.12)} />)
        }
  } else if (type === 3) {
    // 카펫: 부드러운 점 질감
    let seed = 7
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
    for (let i = 0; i < 160; i++) {
      const p = toScreen(rnd(), Math.pow(rnd(), 0.8))
      fills.push(<circle key={i} cx={p.x} cy={p.y} r={0.8 + scaleAt((p.y - 278) / 127) * 0.6} fill={shade(color, -0.1)} opacity=".6" />)
    }
  } else {
    // 헤링본 마루
    const r = rows(14, 1.2)
    for (let i = 0; i < r.length - 1; i++) {
      paths.push(seg(-0.2, r[i], 1.2, r[i]))
      for (let u = -0.04; u < 1.05; u += 0.05) {
        paths.push(i % 2 ? seg(u, r[i], u + 0.035, r[i + 1]) : seg(u + 0.035, r[i], u, r[i + 1]))
      }
    }
  }
  return (
    <g>
      {fills}
      {paths.length > 0 && <path d={paths.join(' ')} stroke={ln} strokeWidth="1.1" fill="none" opacity=".8" />}
    </g>
  )
}

// ---------------------------------------------------------
// 러그 (바닥 평면에 붙여서 원근 그대로)
// ---------------------------------------------------------
function rugPoly(u: number, v: number, w: number, d: number, round: boolean) {
  const ru = (w / 2) * CM_U
  const rv = (d / 2) * CM_V
  const pts = round
    ? Array.from({ length: 32 }, (_, i) => {
        const a = (i / 32) * Math.PI * 2
        return toScreen(u + Math.cos(a) * ru, v + Math.sin(a) * rv)
      })
    : [toScreen(u - ru, v - rv), toScreen(u + ru, v - rv), toScreen(u + ru, v + rv), toScreen(u - ru, v + rv)]
  return pts.map(pt).join(' ')
}

function Rug({ it }: { it: RoomItem }) {
  const { w, d } = RUG_SIZE
  if (it.design === 0)
    return (
      <g>
        <polygon points={rugPoly(it.u, it.v, w, d, true)} fill={it.color} stroke={FOL} strokeWidth="1.4" />
        <polygon points={rugPoly(it.u, it.v, w * 0.72, d * 0.72, true)} fill="none" stroke={shade(it.color, 0.45)} strokeWidth="2.4" strokeDasharray="5 4" />
      </g>
    )
  if (it.design === 1)
    return (
      <g>
        <polygon points={rugPoly(it.u, it.v, w, d, false)} fill={shade(it.color, -0.12)} stroke={FOL} strokeWidth="1.4" />
        <polygon points={rugPoly(it.u, it.v, w * 0.8, d * 0.72, false)} fill={it.color} />
        <polygon points={rugPoly(it.u, it.v, w * 0.55, d * 0.42, false)} fill="none" stroke={shade(it.color, 0.5)} strokeWidth="1.6" />
      </g>
    )
  const ru = (w / 2) * CM_U
  const rv = (d / 2) * CM_V
  const stripes: ReactNode[] = []
  for (let k = 0; k < 5; k++) {
    const v1 = it.v - rv + ((2 * rv) / 5) * k
    const v2 = v1 + (2 * rv) / 5
    if (k % 2 === 0) continue
    stripes.push(
      <polygon key={k} points={[toScreen(it.u - ru, v1), toScreen(it.u + ru, v1), toScreen(it.u + ru, v2), toScreen(it.u - ru, v2)].map(pt).join(' ')} fill={shade(it.color, 0.5)} />,
    )
  }
  return (
    <g>
      <polygon points={rugPoly(it.u, it.v, w, d, false)} fill={it.color} />
      {stripes}
      <polygon points={rugPoly(it.u, it.v, w, d, false)} fill="none" stroke={FOL} strokeWidth="1.4" />
    </g>
  )
}

// ---------------------------------------------------------
// 장면
// ---------------------------------------------------------
export default function RoomScene({ data, look, sleeping, selected, onSelect, onMoveItem, onMoveChar, className }: Props) {
  const uid = useId().replace(/:/g, '')
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ id: string; dx: number; dy: number; pointer: number } | null>(null)
  const interactive = !!onSelect

  const toSvg = (e: React.PointerEvent) => {
    const svg = svgRef.current!
    const p = svg.createSVGPoint()
    p.x = e.clientX
    p.y = e.clientY
    return p.matrixTransform(svg.getScreenCTM()!.inverse())
  }

  const startDrag = (id: string, u: number, v: number) => (e: React.PointerEvent) => {
    if (!interactive) return
    e.stopPropagation()
    onSelect?.(id)
    const p = toSvg(e)
    const a = toScreen(u, v)
    drag.current = { id, dx: a.x - p.x, dy: a.y - p.y, pointer: e.pointerId }
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.pointer !== e.pointerId) return
    const p = toSvg(e)
    const f = fromScreen(p.x + d.dx, p.y + d.dy)
    const c = clampUV(f.u, f.v)
    if (d.id === 'char') onMoveChar?.(c.u, c.v)
    else onMoveItem?.(d.id, c.u, c.v)
  }

  const endDrag = (e: React.PointerEvent) => {
    if (drag.current?.pointer === e.pointerId) drag.current = null
  }

  const wall = data.wall
  const floor = data.floor
  const rugs = data.items.filter((i) => i.kind === 'rug').sort((a, b) => a.v - b.v)
  const standing: ({ t: 'item'; it: RoomItem } | { t: 'char' })[] = [
    ...data.items.filter((i) => i.kind !== 'rug').map((it) => ({ t: 'item' as const, it })),
    { t: 'char' as const },
  ]
  standing.sort((a, b) => (a.t === 'char' ? data.char.v : a.it.v) - (b.t === 'char' ? data.char.v : b.it.v))

  const charScale = scaleAt(data.char.v)
  const charPos = toScreen(data.char.u, data.char.v)
  const charW = (CHAR_CM / 150) * 100 * K * charScale
  const charH = charW * 1.5

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      style={{ touchAction: interactive ? 'none' : undefined, userSelect: 'none', display: 'block' }}
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerDown={() => interactive && onSelect?.(null)}
    >
      <defs>
        <WallPattern id={`wb${uid}`} type={wall.type} color={wall.color} />
        <WallPattern id={`wl${uid}`} type={wall.type} color={shade(wall.color, 0.1)} transform="skewY(23) scale(.62 1)" />
        <WallPattern id={`wr${uid}`} type={wall.type} color={shade(wall.color, -0.03)} transform="skewY(-24) scale(.6 1)" />
        <clipPath id={`fc${uid}`}>
          <polygon points={FLOOR_POLY} />
        </clipPath>
        <linearGradient id={`sun${uid}`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".38" />
          <stop offset="1" stopColor="#fff" stopOpacity=".08" />
        </linearGradient>
      </defs>

      {/* 벽 · 천장 */}
      <polygon points={CEIL_POLY} fill={shade(wall.color, 0.3)} />
      <rect x="130" y="55" width="438" height="223" fill={wall.color} />
      <polygon points={LEFT_POLY} fill={shade(wall.color, 0.1)} />
      <polygon points={RIGHT_POLY} fill={shade(wall.color, -0.03)} />
      {wall.type > 0 && (
        <>
          <rect x="130" y="55" width="438" height="223" fill={`url(#wb${uid})`} />
          <polygon points={LEFT_POLY} fill={`url(#wl${uid})`} />
          <polygon points={RIGHT_POLY} fill={`url(#wr${uid})`} />
        </>
      )}
      {/* 햇살 */}
      <polygon points="568,92 568,278 238,278" fill={`url(#sun${uid})`} />

      {/* 창문 (오른쪽 벽) */}
      <g>
        <polygon points="612,84 714,57 714,274 612,249" fill="#FFFFFF" stroke={EDGE} strokeWidth="2" />
        <polygon points="620,92 706,69 706,262 620,241" fill="#F3F9FF" stroke={EDGE} strokeWidth="1.4" />
        <path d="M649 84.5 L649 248 M678 76.7 L678 255" stroke="#FFFFFF" strokeWidth="5" />
        <path d="M649 84.5 L649 248 M678 76.7 L678 255" stroke={EDGE} strokeWidth="1.2" opacity=".7" />
        <polygon points="608,250 718,276 718,282 608,256" fill="#FFFFFF" stroke={EDGE} strokeWidth="1.4" />
      </g>

      {/* 걸레받이 */}
      <rect x="130" y="270" width="438" height="8" fill="#FFFFFF" opacity=".9" />
      <polygon points="0,326 130,270 130,278 0,335" fill="#FFFFFF" opacity=".9" />
      <polygon points="568,270 720,346 720,355 568,278" fill="#FFFFFF" opacity=".9" />

      {/* 바닥 */}
      <polygon points={FLOOR_POLY} fill={floor.color} />
      <g clipPath={`url(#fc${uid})`}>
        <FloorPattern type={floor.type} color={floor.color} />
        <polygon points="238,278 568,278 600,405 40,405" fill="#fff" opacity=".1" />
      </g>

      {/* 모서리 선 */}
      <g stroke={EDGE} strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M130 55 L568 55 L568 278 L130 278 Z" />
        <path d="M130 55 L40 0 M568 55 L640 0 M130 278 L0 335 M568 278 L720 355" />
      </g>

      {/* 러그 (바닥에 붙어서 항상 맨 아래) */}
      {rugs.map((it) => (
        <g key={it.id} onPointerDown={startDrag(it.id, it.u, it.v)} style={{ cursor: interactive ? 'grab' : undefined }}>
          <Rug it={it} />
          {selected === it.id && <polygon points={rugPoly(it.u, it.v, RUG_SIZE.w + 14, RUG_SIZE.d + 14, it.design === 0)} fill="none" stroke="#FF6F9C" strokeWidth="2.4" strokeDasharray="6 5" />}
        </g>
      ))}

      {/* 서 있는 가구 + 캐릭터: 앞쪽(v가 큰 것)이 나중에 그려져서 위에 보임 */}
      {standing.map((o) => {
        if (o.t === 'char') {
          return (
            <g key="char" onPointerDown={startDrag('char', data.char.u, data.char.v)} style={{ cursor: interactive ? 'grab' : undefined }}>
              {selected === 'char' && <ellipse cx={charPos.x} cy={charPos.y} rx={charW * 0.42} ry={charW * 0.12} fill="none" stroke="#FF6F9C" strokeWidth="2.4" strokeDasharray="6 5" />}
              <g transform={`translate(${(charPos.x - charW / 2).toFixed(1)} ${(charPos.y - (141 / 150) * charH).toFixed(1)})`}>
                <CharacterSvg look={look} size={charW} sleeping={sleeping} />
              </g>
            </g>
          )
        }
        const it = o.it
        const p = toScreen(it.u, it.v)
        const sc = K * scaleAt(it.v)
        return (
          <g key={it.id} onPointerDown={startDrag(it.id, it.u, it.v)} style={{ cursor: interactive ? 'grab' : undefined }}>
            <ellipse cx={p.x} cy={p.y} rx={(it.kind === 'bed' || it.kind === 'sofa' ? 92 : it.kind === 'desk' ? 66 : 34) * sc} ry={7 * sc} fill="#5A3E36" opacity=".12" />
            {selected === it.id && (
              <ellipse cx={p.x} cy={p.y} rx={(it.kind === 'bed' || it.kind === 'sofa' ? 104 : it.kind === 'desk' ? 76 : 44) * sc} ry={12 * sc} fill="none" stroke="#FF6F9C" strokeWidth="2.4" strokeDasharray="6 5" />
            )}
            <g transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${(it.flip ? -sc : sc).toFixed(3)} ${sc.toFixed(3)})`}>
              <Sprite kind={it.kind as Exclude<RoomItem['kind'], 'rug'>} design={it.design} color={it.color} />
            </g>
          </g>
        )
      })}
    </svg>
  )
}
