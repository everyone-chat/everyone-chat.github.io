import { useId } from 'react'
import MANIFEST from '../character/manifest.json'
import { HAIR_COLORS, SKINS, parseLook, type Look } from '../look'

// =========================================================
// 시트에서 잘라낸 PNG(WebP) 파츠를 같은 캔버스(420 x 640)에 겹쳐서 그림
// 머리·피부 레이어는 "기본색 = 흰색" 비율 이미지라서, 곱하기 필터로 원하는 색이 됨
// =========================================================

const M = MANIFEST as unknown as Record<string, [number, number, number, number]>
export const CANVAS = { w: 420, h: 640, feet: 624, top: 150 }
const BASE = import.meta.env.BASE_URL + 'parts/'
const HEAD_BOX = '90 112 245 245'


type Props = {
  look: string
  /** 예전 버전 호환용 (쓰지 않음) */
  color?: string
  size?: number
  /** 상태(status)에 맞는 행동 포즈로 표시 */
  status?: string
  /** 예전 호환: 자는 중 */
  sleeping?: boolean
  headOnly?: boolean
}

export default function Avatar({ look, size = 72, status, sleeping, headOnly }: Props) {
  return <CharacterSvg look={parseLook(look)} size={size} status={sleeping ? 'sleep' : status} headOnly={headOnly} />
}

function Part({ name, filter }: { name: string; filter?: string }) {
  const m = M[name]
  if (!m) return null
  return <image href={`${BASE}${name}.webp`} x={m[0]} y={m[1]} width={m[2]} height={m[3]} filter={filter} preserveAspectRatio="none" />
}

function Tint({ id, color }: { id: string; color: string }) {
  return (
    <filter id={id} colorInterpolationFilters="sRGB" x="0" y="0" width="1" height="1">
      <feFlood floodColor={color} result="c" />
      <feComposite in="c" in2="SourceGraphic" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" />
    </filter>
  )
}

export function CharacterSvg({ look: l, size = 72, status, headOnly }: { look: Look; size?: number; status?: string; headOnly?: boolean }) {
  const uid = useId().replace(/:/g, '')
  const hairC = HAIR_COLORS[l.hairColor]
  const skinC = SKINS[l.skin]
  const hf = `url(#h${uid})`
  const sf = `url(#s${uid})`
  // 행동 포즈 그림은 옷을 입힐 수 없어서 쓰지 않음 → 항상 내가 고른 옷을 입은 서 있는 모습 (상태는 이름표 위 글자로)
  void status
  const height = headOnly ? size : (size * CANVAS.h) / CANVAS.w
  const h = `hair_${l.g}${l.hair}`

  return (
    <svg
      width={size}
      height={height}
      viewBox={headOnly ? HEAD_BOX : `0 0 ${CANVAS.w} ${CANVAS.h}`}
      aria-hidden
      style={{ overflow: headOnly ? 'hidden' : 'visible', display: 'block' }}
    >
      <defs>
        <Tint id={`h${uid}`} color={hairC} />
        <Tint id={`s${uid}`} color={skinC} />
      </defs>
      {!headOnly && <ellipse cx="212" cy="626" rx="88" ry="10" fill="#5A4E7A" opacity=".12" />}
      {!headOnly && (
        <>
          <Part name={`body_${l.g}_skin`} filter={sf} />
          <Part name={`body_${l.g}_lines`} />
          {l.one >= 0 ? (
            <Part name={`one_${l.g}${l.one}`} />
          ) : (
            <>
              <Part name={`bottom_${l.g}${l.bottom}`} />
              <Part name={`top_${l.g}${l.top}`} />
            </>
          )}
          <Part name={`shoes_${l.shoes}`} />
        </>
      )}
      <g>
        <Part name={`${h}_skin`} filter={sf} />
        <Part name={`${h}_hair`} filter={hf} />
        <Part name={`${h}_lines`} />
        <Part name={l.expr === 4 ? 'expr4_eyes' : `eyes_${l.eyes}`} />
        <Part name={`expr_${l.expr}`} />
        <Part name={`mark_${l.expr}`} />
        {l.acc >= 0 && <Part name={`acc_${l.acc}`} />}
        {l.hat >= 0 && <Part name={`hat_${l.hat}`} />}
      </g>
    </svg>
  )
}
