import { useId, type ReactNode } from 'react'
import { shade } from './geometry'
import { hueOf, type Kind } from './catalog'
import FURN from '../character/furniture.json'

// =========================================================
// 가구 에셋 (단위: cm, 기준점 = 바닥에 닿는 가운데 (0,0), 위쪽이 음수)
// 캐릭터와 같은 진한 갈색 외곽선 + 플랫 컬러, 윗면을 살짝 보여서 원근감 표현
// =========================================================

export const FOL = '#3E2B25'
const s = { stroke: FOL, strokeWidth: 1.7, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
const WOOD = '#D9A877'
const WOOD_D = '#9C6B4A'
const WHITE = '#FFFFFF'

/** 윗면 사다리꼴: 뒤쪽이 좁고 앞쪽이 넓음 */
const top = (w: number, y: number, d: number, inset = 0.06) =>
  `M${-w / 2 + w * inset} ${y - d} L${w / 2 - w * inset} ${y - d} L${w / 2} ${y} L${-w / 2} ${y} Z`

function Bed({ d, c }: { d: number; c: string }) {
  const frame = d === 1 ? '#F7F2EC' : d === 2 ? WOOD_D : WOOD
  const head =
    d === 1 ? (
      <path d="M-78 -45 L-78 -105 Q-78 -142 0 -142 Q78 -142 78 -105 L78 -45 Z" fill={frame} {...s} />
    ) : d === 2 ? (
      <g>
        <rect x="-86" y="-148" width="9" height="148" rx="3" fill={frame} {...s} />
        <rect x="77" y="-148" width="9" height="148" rx="3" fill={frame} {...s} />
        <rect x="-77" y="-120" width="154" height="75" rx="6" fill={shade(frame, 0.15)} {...s} />
      </g>
    ) : (
      <g>
        <rect x="-80" y="-118" width="160" height="73" rx="8" fill={frame} {...s} />
        <path d="M-66 -104 L66 -104" stroke={shade(frame, -0.2)} strokeWidth="1.4" />
      </g>
    )
  return (
    <g>
      {head}
      <path d={top(176, -34, 26, 0.03)} fill={WHITE} {...s} />
      <rect x="-40" y="-64" width="80" height="14" rx="6" fill={WHITE} {...s} />
      <path d={top(182, -32, 18, 0.02)} fill={c} {...s} />
      <path d="M-70 -42 Q0 -38 70 -42" fill="none" stroke={shade(c, -0.15)} strokeWidth="1.2" />
      <rect x="-94" y="-34" width="188" height="24" rx="4" fill={c} {...s} />
      <rect x="-94" y="-14" width="188" height="6" rx="2" fill={frame} {...s} />
      <rect x="-90" y="-9" width="7" height="9" fill={frame} {...s} />
      <rect x="83" y="-9" width="7" height="9" fill={frame} {...s} />
    </g>
  )
}

function Sofa({ d, c }: { d: number; c: string }) {
  const r = d === 1 ? 4 : 14
  const dark = shade(c, -0.1)
  return (
    <g>
      <rect x="-80" y="-88" width="160" height="50" rx={r} fill={c} {...s} />
      {d === 2 &&
        [-50, -17, 17, 50].map((x) => <circle key={x} cx={x} cy="-66" r="2" fill={dark} />)}
      <path d={top(160, -32, 14, 0.02)} fill={shade(c, 0.12)} {...s} />
      {d === 2 && <path d="M0 -46 L0 -32" stroke={dark} strokeWidth="1.2" />}
      <rect x="-82" y="-32" width="164" height="20" rx={Math.min(r, 8)} fill={dark} {...s} />
      <rect x="-96" y="-66" width="22" height="56" rx={d === 1 ? 4 : 11} fill={c} {...s} />
      <rect x="74" y="-66" width="22" height="56" rx={d === 1 ? 4 : 11} fill={c} {...s} />
      {d === 0 && <rect x="-60" y="-70" width="34" height="24" rx="9" fill={shade(c, 0.35)} {...s} transform="rotate(-8 -43 -58)" />}
      <rect x="-86" y="-12" width="7" height="12" rx="2" fill={WOOD_D} {...s} />
      <rect x="79" y="-12" width="7" height="12" rx="2" fill={WOOD_D} {...s} />
    </g>
  )
}

function Desk({ d, c }: { d: number; c: string }) {
  const dark = shade(c, -0.18)
  return (
    <g>
      <rect x="-60" y="-66" width="6" height="66" fill={dark} {...s} />
      <rect x="54" y="-66" width="6" height="66" fill={dark} {...s} />
      {d === 1 && (
        <g>
          <rect x="16" y="-66" width="44" height="58" rx="2" fill={c} {...s} />
          <path d="M16 -47 L60 -47 M16 -28 L60 -28" stroke={FOL} strokeWidth="1.3" />
          {[-56, -37, -18].map((y) => (
            <rect key={y} x="34" y={y} width="8" height="2.6" rx="1.3" fill={FOL} />
          ))}
        </g>
      )}
      {d === 2 && <rect x="-54" y="-30" width="108" height="5" fill={c} {...s} />}
      <path d={top(132, -70, 12, 0.04)} fill={shade(c, 0.15)} {...s} />
      <rect x="-66" y="-70" width="132" height="7" rx="2" fill={c} {...s} />
      {d === 0 && (
        <g>
          <rect x="-40" y="-86" width="22" height="7" rx="1" fill="#F7C5CF" {...s} transform="rotate(-6 -29 -82)" />
          <path d="M28 -76 L28 -96 M28 -96 Q38 -104 44 -94" fill="none" {...s} />
          <path d="M38 -98 L50 -92 L44 -86 Z" fill="#FFE2A8" {...s} />
        </g>
      )}
      {d === 2 && (
        <g>
          <path d="M-26 -78 L-20 -100 L22 -100 L16 -78 Z" fill="#5E5A66" {...s} />
          <path d="M-32 -76 L22 -76" {...s} strokeWidth={2.6} />
          <circle cx="-2" cy="-89" r="2.2" fill={WHITE} />
        </g>
      )}
    </g>
  )
}

function Chair({ d, c }: { d: number; c: string }) {
  const dark = shade(c, -0.15)
  if (d === 1)
    return (
      <g>
        <path d="M-18 -40 L-24 0 M18 -40 L24 0 M0 -40 L0 -2" {...s} strokeWidth={4} stroke={WOOD_D} />
        <path d="M-18 -40 L-24 0 M18 -40 L24 0" stroke={WOOD} strokeWidth={2.2} />
        <ellipse cx="0" cy="-42" rx="26" ry="8" fill={c} {...s} />
        <path d="M-26 -42 L-26 -36 Q0 -28 26 -36 L26 -42" fill={dark} {...s} />
      </g>
    )
  if (d === 2)
    return (
      <g>
        <rect x="-32" y="-88" width="64" height="48" rx="16" fill={c} {...s} />
        <path d={top(56, -30, 10, 0.03)} fill={shade(c, 0.12)} {...s} />
        <rect x="-32" y="-30" width="64" height="18" rx="7" fill={dark} {...s} />
        <rect x="-42" y="-62" width="16" height="50" rx="8" fill={c} {...s} />
        <rect x="26" y="-62" width="16" height="50" rx="8" fill={c} {...s} />
        <rect x="-32" y="-12" width="5" height="12" fill={WOOD_D} {...s} />
        <rect x="27" y="-12" width="5" height="12" fill={WOOD_D} {...s} />
      </g>
    )
  return (
    <g>
      <rect x="-21" y="-92" width="5" height="52" fill={WOOD} {...s} />
      <rect x="16" y="-92" width="5" height="52" fill={WOOD} {...s} />
      <rect x="-21" y="-92" width="42" height="20" rx="5" fill={c} {...s} />
      <path d="M-24 0 L-22 -40 M24 0 L22 -40" {...s} strokeWidth={4.4} stroke={FOL} />
      <path d="M-24 0 L-22 -40 M24 0 L22 -40" stroke={WOOD} strokeWidth={2.4} />
      <path d={top(52, -40, 9, 0.04)} fill={shade(c, 0.12)} {...s} />
      <rect x="-26" y="-40" width="52" height="6" rx="2" fill={dark} {...s} />
    </g>
  )
}

function Cabinet({ d, c }: { d: number; c: string }) {
  const dark = shade(c, -0.12)
  if (d === 1) {
    const books = ['#F7C5CF', '#BFD9F2', '#FFE2A8', '#BFE3C9', '#D9CCF2', '#8C6B5A']
    return (
      <g>
        <path d={top(84, -130, 8, 0.05)} fill={shade(c, 0.12)} {...s} />
        <rect x="-42" y="-130" width="84" height="128" rx="3" fill={c} {...s} />
        {[-128, -86, -44].map((y, row) => (
          <g key={y}>
            <rect x="-35" y={y + 6} width="70" height="34" fill={dark} />
            {books.slice(row, row + 4).map((b, i) => (
              <rect key={i} x={-32 + i * 11} y={y + 12 + (i % 2) * 3} width="9" height={28 - (i % 2) * 3} rx="1" fill={b} {...s} strokeWidth={1.1} />
            ))}
            <path d={`M-35 ${y + 40} L35 ${y + 40}`} {...s} />
          </g>
        ))}
        <rect x="-38" y="-2" width="6" height="2" fill={FOL} />
        <rect x="32" y="-2" width="6" height="2" fill={FOL} />
      </g>
    )
  }
  if (d === 2)
    return (
      <g>
        <path d={top(92, -152, 9, 0.05)} fill={shade(c, 0.12)} {...s} />
        <rect x="-46" y="-152" width="92" height="146" rx="4" fill={c} {...s} />
        <path d="M0 -146 L0 -12" {...s} />
        <rect x="-8" y="-88" width="3" height="16" rx="1.5" fill={FOL} />
        <rect x="5" y="-88" width="3" height="16" rx="1.5" fill={FOL} />
        <rect x="-42" y="-6" width="8" height="6" fill={WOOD_D} {...s} />
        <rect x="34" y="-6" width="8" height="6" fill={WOOD_D} {...s} />
      </g>
    )
  return (
    <g>
      <path d={top(92, -84, 10, 0.05)} fill={shade(c, 0.12)} {...s} />
      <rect x="-46" y="-84" width="92" height="78" rx="4" fill={c} {...s} />
      {[-78, -54, -30].map((y) => (
        <g key={y}>
          <rect x="-40" y={y} width="80" height="20" rx="3" fill={shade(c, 0.06)} {...s} strokeWidth={1.3} />
          <circle cx="0" cy={y + 10} r="2.6" fill={WOOD_D} {...s} strokeWidth={1} />
        </g>
      ))}
      <rect x="-42" y="-6" width="8" height="6" fill={WOOD_D} {...s} />
      <rect x="34" y="-6" width="8" height="6" fill={WOOD_D} {...s} />
      <path d="M22 -92 Q20 -104 28 -110 Q34 -100 30 -92 Z" fill="#BFE3C9" {...s} strokeWidth={1.2} />
      <rect x="20" y="-94" width="12" height="9" rx="2" fill="#F7C5CF" {...s} strokeWidth={1.2} />
    </g>
  )
}

function Plant({ d, c }: { d: number; c: string }) {
  const pot = (
    <g>
      <path d="M-17 -32 L17 -32 L13 0 L-13 0 Z" fill={c} {...s} />
      <rect x="-19" y="-36" width="38" height="7" rx="3" fill={shade(c, -0.08)} {...s} />
    </g>
  )
  if (d === 1)
    return (
      <g>
        <rect x="-10" y="-88" width="20" height="56" rx="10" fill="#8CC99A" {...s} />
        <rect x="-26" y="-66" width="13" height="24" rx="6.5" fill="#8CC99A" {...s} />
        <path d="M-13 -50 L-8 -50" {...s} />
        <rect x="13" y="-74" width="12" height="22" rx="6" fill="#8CC99A" {...s} />
        <path d="M13 -58 L9 -58" {...s} />
        <circle cx="0" cy="-90" r="4" fill="#F7A8C0" {...s} strokeWidth={1.2} />
        {pot}
      </g>
    )
  if (d === 2)
    return (
      <g>
        <path d="M0 -36 L0 -60" {...s} strokeWidth={3.4} stroke={WOOD_D} />
        <circle cx="0" cy="-78" r="26" fill="#9FD3A8" {...s} />
        <circle cx="-9" cy="-86" r="5" fill="#B9E2C0" />
        {pot}
      </g>
    )
  const leaf = (x: number, y: number, r: number) => (
    <path d={`M0 -34 Q${x * 0.4} ${y * 0.5} ${x} ${y} Q${x + 14 * Math.sign(x || 1)} ${y - 4} ${x + 10 * Math.sign(x || 1)} ${y + 12} Q${x * 0.6} ${y + 18} 0 -34 Z`} fill="#7FC28E" {...s} transform={`rotate(${r} 0 -34)`} />
  )
  return (
    <g>
      {leaf(-26, -96, -8)}
      {leaf(24, -100, 8)}
      {leaf(-4, -112, 0)}
      {leaf(-30, -70, -20)}
      {leaf(28, -72, 18)}
      {pot}
    </g>
  )
}

function Lamp({ d, c }: { d: number; c: string }) {
  if (d === 1)
    return (
      <g>
        <ellipse cx="0" cy="-3" rx="14" ry="4" fill={WOOD_D} {...s} />
        <path d="M0 -6 L0 -92" {...s} strokeWidth={3.6} />
        <path d="M0 -6 L0 -92" stroke={WOOD} strokeWidth={1.8} />
        <circle cx="0" cy="-112" r="22" fill={c} {...s} />
        <circle cx="0" cy="-112" r="30" fill={c} opacity=".25" />
        <circle cx="-7" cy="-119" r="5" fill={WHITE} opacity=".7" />
      </g>
    )
  if (d === 2)
    return (
      <g>
        <path d="M-20 0 L0 -112 L20 0 M0 -112 L0 0" fill="none" {...s} strokeWidth={4} />
        <path d="M-20 0 L0 -112 L20 0 M0 -112 L0 0" fill="none" stroke={WOOD} strokeWidth={2} />
        <path d="M-26 -108 L26 -108 L18 -146 L-18 -146 Z" fill={c} {...s} />
        <path d="M-18 -116 L18 -116" stroke={shade(c, -0.15)} strokeWidth="1.4" />
      </g>
    )
  return (
    <g>
      <ellipse cx="0" cy="-3" rx="16" ry="4.5" fill="#5E5A66" {...s} />
      <path d="M0 -6 L0 -118" {...s} strokeWidth={3.4} />
      <path d="M0 -6 L0 -118" stroke="#8A8494" strokeWidth={1.6} />
      <path d="M-24 -116 L24 -116 L14 -152 L-14 -152 Z" fill={c} {...s} />
      <path d="M-16 -116 L16 -116 L28 -80 L-28 -80 Z" fill={c} opacity=".18" />
    </g>
  )
}

const SPRITES: Record<Exclude<Kind, 'rug'>, (p: { d: number; c: string }) => ReactNode> = {
  bed: Bed,
  sofa: Sofa,
  desk: Desk,
  chair: Chair,
  cabinet: Cabinet,
  plant: Plant,
  lamp: Lamp,
}

// 시트에서 잘라낸 PNG 가구의 실제 가로 크기 (cm)
export const PNG_CM: Record<string, number> = { bed: 190, sofa: 175, desk: 135, chair: 52, cabinet: 100, rug: 215 }
const FSIZE = FURN as unknown as Record<string, [number, number]>
const SRC = (k: string) => `${import.meta.env.BASE_URL}parts/furn_${k}.webp`

/** PNG 가구: 기준점 = 바닥 가운데 (러그는 중심) */
export function PngFurniture({ kind, color, center }: { kind: string; color: string; center?: boolean }) {
  const uid = useId().replace(/:/g, '')
  const [pw, ph] = FSIZE[kind]
  const w = PNG_CM[kind]
  const h = (w * ph) / pw
  const hue = hueOf(color)
  return (
    <g>
      {hue !== 0 && (
        <filter id={`hr${uid}`} colorInterpolationFilters="sRGB">
          <feColorMatrix type="hueRotate" values={String(hue)} />
        </filter>
      )}
      <image
        href={SRC(kind)}
        x={-w / 2}
        y={center ? -h / 2 : -h}
        width={w}
        height={h}
        preserveAspectRatio="none"
        filter={hue !== 0 ? `url(#hr${uid})` : undefined}
      />
    </g>
  )
}
export const pngSize = (kind: string) => {
  const [pw, ph] = FSIZE[kind]
  return { w: PNG_CM[kind], h: (PNG_CM[kind] * ph) / pw }
}
export const furnSrc = SRC

export function Sprite({ kind, design, color }: { kind: Exclude<Kind, 'rug'>; design: number; color: string }) {
  if (kind in PNG_CM) return <PngFurniture kind={kind} color={color} />
  const C = SPRITES[kind]
  return <C d={design} c={color} />
}

/** 러그: 바닥 평면 위에 그리는 모양 (단위 정사각형 -1~1 기준, 바닥 좌표로 변환해서 사용) */
export const RUG_SIZE = { w: 190, d: 130 }
