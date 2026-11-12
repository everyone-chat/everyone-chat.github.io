import type { ReactNode } from 'react'
import { EYE_COLORS, HAIR_COLORS, OUTFIT_COLORS, SKINS, parseLook, type Gender, type Look } from '../look'

// =========================================================
// 조합형 캐릭터 (SVG 파츠)
// 캔버스 100 x 150, 큰 머리 + 작은 몸 비율, 진한 갈색 외곽선
// 그리는 순서: 뒷머리 → 하의/다리 → 상의/팔 → 귀 → 얼굴 → 눈·입 → 앞머리 → 효과
// =========================================================

const OL = '#2A1F1C'
const SW = 1.8
const CREAM = '#F6EEE3'
const WHITE = '#FFFFFF'
const line = { stroke: OL, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

type Props = {
  look: string
  /** 예전 버전 호환용 (말풍선 테마색). 캐릭터 그림에는 쓰지 않음 */
  color?: string
  size?: number
  sleeping?: boolean
  /** 얼굴만 (채팅 목록 등 작은 자리) */
  headOnly?: boolean
}

export default function Avatar({ look, size = 72, sleeping, headOnly }: Props) {
  const l = parseLook(look)
  return <CharacterSvg look={l} size={size} sleeping={sleeping} headOnly={headOnly} />
}

export function CharacterSvg({ look: l, size = 72, sleeping, headOnly }: { look: Look; size?: number; sleeping?: boolean; headOnly?: boolean }) {
  const hair = HAIR_COLORS[l.hairColor]
  const skin = SKINS[l.skin]
  const eye = EYE_COLORS[l.eyeColor]
  const out = OUTFIT_COLORS[l.outfitColor] || ''
  const vb = headOnly ? '11 5 78 78' : '0 0 100 150'
  const height = headOnly ? size : size * 1.5
  const hairParts = HAIRS[l.g][l.hair](hair)
  const outfit = headOnly ? null : OUTFITS[l.g][l.outfit](out, skin)

  return (
    <svg width={size} height={height} viewBox={vb} aria-hidden style={{ overflow: 'visible', display: 'block' }}>
      {!headOnly && <ellipse cx="50" cy="141" rx="21" ry="3.5" fill="#5A4E7A" opacity=".12" />}
      {hairParts.back}
      {outfit?.lower}
      {outfit?.upper}
      {/* 귀 */}
      <ellipse cx="24.5" cy="47" rx="4.8" ry="5.8" fill={skin} {...line} />
      <ellipse cx="75.5" cy="47" rx="4.8" ry="5.8" fill={skin} {...line} />
      <path d="M25.5 45 Q23.5 47 25.5 49.5" fill="none" stroke={OL} strokeWidth="1" opacity=".5" />
      <path d="M74.5 45 Q76.5 47 74.5 49.5" fill="none" stroke={OL} strokeWidth="1" opacity=".5" />
      {/* 얼굴 */}
      <ellipse cx="50" cy="42.5" rx="26" ry="23.5" fill={skin} {...line} />
      {/* 볼터치 */}
      <ellipse cx="34.5" cy="54.5" rx="4.2" ry="2.4" fill="#FF9DB0" opacity=".45" />
      <ellipse cx="65.5" cy="54.5" rx="4.2" ry="2.4" fill="#FF9DB0" opacity=".45" />
      <Face l={l} eye={eye} sleeping={sleeping} />
      {hairParts.front}
      {!sleeping && <ExprMarks l={l} />}
    </svg>
  )
}

// ---------------------------------------------------------
// 눈 · 표정
// ---------------------------------------------------------
const EX = [40, 60]
const EY = 48

function Eye({ kind, x, side, c }: { kind: number; x: number; side: -1 | 1; c: string }) {
  const y = EY
  switch (kind) {
    case 1: // 웃는 눈
      return <path d={`M${x - 3.6} ${y + 1} Q${x} ${y - 3.8} ${x + 3.6} ${y + 1}`} fill="none" {...line} strokeWidth={2.2} />
    case 2: {
      // 고양이 / 날렵한 눈: 바깥 눈꼬리가 올라감
      const o = side * 4.3
      return (
        <g>
          <path d={`M${x - o} ${y + 0.6} Q${x - o * 0.2} ${y - 3.6} ${x + o} ${y - 1.8} Q${x + o * 0.2} ${y + 3.4} ${x - o} ${y + 0.6} Z`} fill={c} />
          <path d={`M${x - o} ${y + 0.4} Q${x - o * 0.2} ${y - 3.8} ${x + o * 1.1} ${y - 2.2}`} fill="none" {...line} strokeWidth={2} />
          <circle cx={x + side * 0.6} cy={y - 1} r="0.9" fill={WHITE} />
        </g>
      )
    }
    case 3: // 처진 / 졸린 눈: 위 눈꺼풀이 반쯤 덮음
      return (
        <g>
          <path d={`M${x - 3.3} ${y - 0.4} A3.3 3.5 0 0 0 ${x + 3.3} ${y - 0.4} Z`} fill={c} />
          <path d={`M${x - side * 4} ${y - 1.4} L${x + side * 4} ${y - 0.2}`} fill="none" {...line} strokeWidth={2.1} />
        </g>
      )
    case 4: // 반짝이는 눈
      return (
        <g>
          <ellipse cx={x} cy={y} rx="3.7" ry="4.3" fill={c} />
          <path
            d={`M${x} ${y - 2.6} Q${x + 0.4} ${y - 0.4} ${x + 2.2} ${y} Q${x + 0.4} ${y + 0.4} ${x} ${y + 2.6} Q${x - 0.4} ${y + 0.4} ${x - 2.2} ${y} Q${x - 0.4} ${y - 0.4} ${x} ${y - 2.6} Z`}
            fill={WHITE}
          />
          <circle cx={x + 1.9} cy={y - 2.4} r="0.7" fill={WHITE} />
        </g>
      )
    default: // 동글 눈
      return (
        <g>
          <ellipse cx={x} cy={y} rx="3.1" ry="3.7" fill={c} />
          <circle cx={x + 1} cy={y - 1.3} r="1.1" fill={WHITE} />
        </g>
      )
  }
}

function Face({ l, eye, sleeping }: { l: Look; eye: string; sleeping?: boolean }) {
  let eyes: ReactNode
  if (sleeping) {
    eyes = EX.map((x) => <path key={x} d={`M${x - 3.6} ${EY - 0.5} Q${x} ${EY + 2.6} ${x + 3.6} ${EY - 0.5}`} fill="none" {...line} strokeWidth={2.2} />)
  } else if (l.expr === 1) {
    // 윙크: 오른쪽 눈은 감음
    eyes = (
      <>
        <Eye kind={l.eyes} x={EX[0]} side={-1} c={eye} />
        <path d={`M63.6 45.4 L58.6 48 L63.6 50.6`} fill="none" {...line} strokeWidth={2.2} />
      </>
    )
  } else {
    eyes = (
      <>
        <Eye kind={l.eyes} x={EX[0]} side={-1} c={eye} />
        <Eye kind={l.eyes} x={EX[1]} side={1} c={eye} />
      </>
    )
  }

  let mouth: ReactNode
  let brows: ReactNode = null
  const expr = sleeping ? 0 : l.expr
  switch (expr) {
    case 2: // 놀람
      mouth = <ellipse cx="50" cy="57.5" rx="1.9" ry="2.5" fill="#C2565F" {...line} strokeWidth={1.4} />
      break
    case 3:
      if (l.g === 'f') {
        // 삐짐
        brows = (
          <>
            <path d="M35.5 40.5 L43.5 42.6" {...line} strokeWidth={1.8} />
            <path d="M64.5 40.5 L56.5 42.6" {...line} strokeWidth={1.8} />
          </>
        )
        mouth = <path d="M46.8 58 Q50 55 53.2 58" fill="none" {...line} strokeWidth={1.9} />
      } else {
        // 진지
        brows = (
          <>
            <path d="M35.5 41.8 L43.5 41.4" {...line} strokeWidth={1.9} />
            <path d="M64.5 41.8 L56.5 41.4" {...line} strokeWidth={1.9} />
          </>
        )
        mouth = <path d="M47 57 L53 57" {...line} strokeWidth={1.9} />
      }
      break
    case 4: // 활짝 웃음
      mouth = (
        <g>
          <path d="M45.4 55 Q50 55.6 54.6 55 Q54.2 61.8 50 61.8 Q45.8 61.8 45.4 55 Z" fill="#B94654" {...line} strokeWidth={1.6} />
          <path d="M47.4 60 Q50 58.2 52.6 60 Q51.5 61.3 50 61.3 Q48.5 61.3 47.4 60 Z" fill="#F48C9A" />
        </g>
      )
      break
    default: // 기본 웃음
      mouth = <path d="M46.6 56 Q50 59 53.4 56" fill="none" {...line} strokeWidth={1.9} />
  }

  return (
    <g>
      {eyes}
      {brows}
      {mouth}
    </g>
  )
}

function ExprMarks({ l }: { l: Look }) {
  const y = '#F5C542'
  switch (l.expr) {
    case 1:
      return (
        <g stroke={y} strokeWidth="1.8" strokeLinecap="round">
          <path d="M80 42 L85 40" />
          <path d="M80.5 47 L86 47" />
          <path d="M80 52 L85 54" />
        </g>
      )
    case 2:
      return (
        <g stroke="#FF7A93" strokeWidth="1.8" strokeLinecap="round">
          <path d="M76 12 L79 6" />
          <path d="M81 16 L86.5 12.5" />
          <path d="M82.5 22 L88.5 21" />
        </g>
      )
    case 3:
      return l.g === 'f' ? (
        <g fill={WHITE} {...line} strokeWidth={1.4}>
          <circle cx="81" cy="14" r="4" />
          <circle cx="86.5" cy="12" r="3.6" />
          <circle cx="85" cy="17.5" r="3.2" />
          <circle cx="81" cy="14" r="4" stroke="none" />
          <circle cx="86.5" cy="12" r="3.6" stroke="none" />
          <circle cx="85" cy="17.5" r="3.2" stroke="none" />
        </g>
      ) : null
    case 4:
      return (
        <g stroke={y} strokeWidth="1.8" strokeLinecap="round">
          <path d="M79 14 L83 9" />
          <path d="M82.5 20 L88 17.5" />
          <path d="M83.5 26 L89 26" />
        </g>
      )
    default:
      return null
  }
}

// ---------------------------------------------------------
// 헤어 (뒷머리 / 앞머리 분리)
// ---------------------------------------------------------
type HairParts = { back?: ReactNode; front: ReactNode }
const strand = { fill: 'none', stroke: OL, strokeWidth: 1, strokeLinecap: 'round' as const, opacity: 0.35 }

// 일자 앞머리 (여자 롱/양갈래/보브 공용)
const blunt = (c: string) => (
  <g>
    <path
      d="M24.3 50 C22.8 27 34 17.5 50 17.5 C66 17.5 77.2 27 75.7 50 C74.6 45 73 40.5 70.6 37.6 Q68 39 65.5 37.8 Q62 39.2 58.6 37.8 Q55 39.3 51.6 37.8 Q48 39.3 44.5 37.8 Q41 39.2 37.6 37.8 Q34 39 29.4 37.6 C27 40.5 25.4 45 24.3 50 Z"
      fill={c}
      {...line}
    />
    <path d="M40 22 Q36 28 37 36" {...strand} />
    <path d="M60 22 Q64 28 63 36" {...strand} />
    <path d="M33 22.5 Q40 19.5 46 19.8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".3" />
  </g>
)

const HAIRS: Record<Gender, ((c: string) => HairParts)[]> = {
  f: [
    // 0 롱 스트레이트 (앞머리)
    (c) => ({
      back: (
        <g>
          <path d="M50 16 C31 16 21 28 21 47 L19.2 106 Q25 111 31 106 L33.5 70 L66.5 70 L69 106 Q75 111 80.8 106 L79 47 C79 28 69 16 50 16 Z" fill={c} {...line} />
          <path d="M24 70 L23.5 100" {...strand} />
          <path d="M76 70 L76.5 100" {...strand} />
        </g>
      ),
      front: blunt(c),
    }),
    // 1 사이드파트 미디엄 웨이브 (앞머리 없음)
    (c) => ({
      back: (
        <g>
          <path
            d="M50 15 C30 15 19 28 19.5 48 C18 60 23 68 18.5 78 Q16.5 88 25 90 Q31 90 32 84 L33.5 70 L66.5 70 L68 84 Q69 90 75 90 Q83.5 88 81.5 78 C77 68 82 60 80.5 48 C81 28 70 15 50 15 Z"
            fill={c}
            {...line}
          />
          <path d="M22 66 Q20 74 23 82" {...strand} />
          <path d="M78 66 Q80 74 77 82" {...strand} />
        </g>
      ),
      front: (
        <g>
          <path
            d="M23.6 54 C21 30 33 16.5 49 16.5 C68 16.5 79 29 76.4 54 C75 46 73 40 68 35.5 C62 31 53 30.5 44 27.5 C40 31 36 34 33 38 C29 42 26 47 23.6 54 Z"
            fill={c}
            {...line}
          />
          <path d="M44 27.5 C40 23 41 19 44 17.5" {...strand} />
          <path d="M52 30 Q62 31 70 38" {...strand} />
          <path d="M76.4 50 Q73 58 76 66 Q72 62 72 54" fill={c} {...line} strokeWidth={1.4} />
        </g>
      ),
    }),
    // 2 양갈래 땋은머리
    (c) => {
      const braid = (x: number) => (
        <g>
          {[62, 69, 76, 83].map((y) => (
            <ellipse key={y} cx={x} cy={y} rx="5.2" ry="4.6" fill={c} {...line} strokeWidth={1.5} />
          ))}
          <rect x={x - 3.4} y="87" width="6.8" height="3" rx="1.4" fill="#E9A3B8" {...line} strokeWidth={1.2} />
          <path d={`M${x - 3} 90 Q${x} 98 ${x + 3} 90 Z`} fill={c} {...line} strokeWidth={1.5} />
        </g>
      )
      return {
        back: <path d="M50 16 C31 16 21 28 21 47 L22 60 L78 60 L79 47 C79 28 69 16 50 16 Z" fill={c} {...line} />,
        front: (
          <g>
            {braid(21.5)}
            {braid(78.5)}
            {blunt(c)}
          </g>
        ),
      }
    },
    // 3 하이 포니테일
    (c) => ({
      back: (
        <g>
          <path d="M59 19 C64 6 79 3 83 13 C87 27 80 38 84 54 C87 67 82 79 75 86 Q77 72 73.5 63 C69 50 76 38 70 27 Z" fill={c} {...line} />
          <path d="M77 14 Q82 30 78 48" {...strand} />
        </g>
      ),
      front: (
        <g>
          <path
            d="M24.4 50 C22.8 27 34 17 50 17 C66 17 77.2 27 75.6 50 C73.5 41 69 35.5 61 33.5 C54 36 42 35 35.5 30.5 C30.5 36 27 42 24.4 50 Z"
            fill={c}
            {...line}
          />
          <path d="M26.8 42 Q22.4 56 25.2 68 Q28.4 58 29.6 45 Z" fill={c} {...line} strokeWidth={1.4} />
          <path d="M73.2 42 Q77.6 56 74.8 68 Q71.6 58 70.4 45 Z" fill={c} {...line} strokeWidth={1.4} />
          <rect x="59" y="14.5" width="6" height="5" rx="2" transform="rotate(-30 62 17)" fill="#E9A3B8" {...line} strokeWidth={1.2} />
          <path d="M38 22 Q46 19 56 21" {...strand} />
        </g>
      ),
    }),
    // 4 단발 보브
    (c) => ({
      back: (
        <path d="M50 16 C30 16 20 28 20.5 48 C20 58 20.5 65 24 69 Q31 73 37 67 L63 67 Q69 73 76 69 C79.5 65 80 58 79.5 48 C80 28 70 16 50 16 Z" fill={c} {...line} />
      ),
      front: (
        <g>
          {blunt(c)}
          <path d="M24.3 46 C22 54 22.5 62 25 68 Q28 66 28.6 60 C27.6 55 27.6 50 28.6 45 Z" fill={c} {...line} strokeWidth={1.5} />
          <path d="M75.7 46 C78 54 77.5 62 75 68 Q72 66 71.4 60 C72.4 55 72.4 50 71.4 45 Z" fill={c} {...line} strokeWidth={1.5} />
        </g>
      ),
    }),
  ],
  m: [
    // 0 소프트 메시
    (c) => ({
      front: (
        <g>
          <path
            d="M22.6 52 C18 38 21 22 33 15.5 C41 10.5 53 10 61 13 C71 15 80 23 79.6 35 C80.2 41 79 47 77.4 52 C76 45.5 74 41 71.5 37.5 Q68 41 63.5 36.5 Q59.5 41.5 54.5 36 Q50 41.5 45 36 Q40.5 40.5 36 35.5 Q32 38.5 29 37.5 C26.5 41.5 24.5 46.5 22.6 52 Z"
            fill={c}
            {...line}
          />
          <path d="M44 15 Q48 22 46 30" {...strand} />
          <path d="M58 15.5 Q63 22 62 30" {...strand} />
          <path d="M33 21 Q31 27 32 33" {...strand} />
          <path d="M34 19 Q42 14 50 14.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".28" />
        </g>
      ),
    }),
    // 1 사이드파트
    (c) => ({
      front: (
        <g>
          <path
            d="M22.8 52 C19 31 32 14.5 50 14.5 C68 14.5 81 28 77.2 52 C76 44 74 39.5 70.5 36.5 C63 39 53 38 45 32.5 C40.5 29.5 37 26.5 35 24.5 C30 32 25.5 41 22.8 52 Z"
            fill={c}
            {...line}
          />
          <path d="M35 24.5 C38 21 40 19 41 16.5" {...strand} />
          <path d="M44 28 Q56 32 68 34" {...strand} />
          <path d="M48 22 Q58 26 70 28" {...strand} />
        </g>
      ),
    }),
    // 2 볼륨 컬 (원을 겹쳐 곱슬 외곽 표현)
    (c) => {
      const curls: [number, number, number][] = [
        [26, 44, 6.5], [27.5, 34, 7.5], [33, 24.5, 8], [42, 18, 8.5], [52.5, 16, 8.5], [62.5, 18.5, 8.2], [70.5, 25, 7.8], [74.5, 34.5, 7.2], [74.5, 44, 6.2],
        [35, 36, 5.6], [43.5, 35.5, 5.6], [52, 36, 5.6], [60.5, 35.5, 5.6], [67.5, 37, 5.2],
      ]
      return {
        front: (
          <g>
            {curls.map(([x, y, r], i) => (
              <circle key={'o' + i} cx={x} cy={y} r={r} fill={c} {...line} />
            ))}
            <ellipse cx="50" cy="28" rx="22" ry="12" fill={c} />
            {curls.map(([x, y, r], i) => (
              <circle key={'f' + i} cx={x} cy={y} r={r - SW / 2} fill={c} />
            ))}
            <path d="M40 24 Q44 20 48 23" {...strand} />
            <path d="M55 22 Q59 18 63 22" {...strand} />
            <path d="M30 32 Q33 28 36 31" {...strand} />
          </g>
        ),
      }
    },
    // 3 콤마 헤어 (가운데 가르마 + 쉼표 모양 앞머리)
    (c) => ({
      front: (
        <g>
          <path
            d="M22.8 52 C19 31 32 14 50 14 C68 14 81 31 77.2 52 C75.6 44 73 38.5 68 35.5 C65.5 40.5 59.5 42.5 55 38.5 C53.5 33 51.5 28 50 24.5 C48.5 28 46.5 33 45 38.5 C40.5 42.5 34.5 40.5 32 35.5 C27 38.5 24.4 44 22.8 52 Z"
            fill={c}
            {...line}
          />
          <path d="M55 38.5 Q57.5 35 60 37.5" {...strand} />
          <path d="M45 38.5 Q42.5 35 40 37.5" {...strand} />
          <path d="M50 24.5 Q49 19 50 15" {...strand} />
        </g>
      ),
    }),
    // 4 숏 크롭
    (c) => ({
      front: (
        <g>
          <path
            d="M24 47 C22 28 34 16.5 50 16.5 C66 16.5 78 28 76 47 C75 41 73.5 37 71.5 34 L68 36 L65 31.5 L61.5 35 L58 30.5 L54 34.5 L50 30 L46 34.5 L42 30.5 L38.5 35 L35 31.5 L32 36 L28.5 34 C26.5 37.5 25 42 24 47 Z"
            fill={c}
            {...line}
          />
          <path d="M40 20 Q44 18 50 18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".28" />
        </g>
      ),
    }),
  ],
}

// ---------------------------------------------------------
// 코디 (하의+다리+신발 / 상의+팔+손)
// ---------------------------------------------------------
type OutfitParts = { lower: ReactNode; upper: ReactNode }

const TORSO = 'M35 64 Q50 61 65 64 L67.5 97 Q50 100 32.5 97 Z'
const SLEEVE_L = 'M35.5 64.5 Q29 66.5 28 76 L27 95 Q31 98 35 96 L36.5 73 Z'
const SLEEVE_R = 'M64.5 64.5 Q71 66.5 72 76 L73 95 Q69 98 65 96 L63.5 73 Z'

function Upper({ main, skin, children, sleeves }: { main: string; skin: string; children?: ReactNode; sleeves?: ReactNode }) {
  return (
    <g>
      <path d={TORSO} fill={main} {...line} />
      {children}
      <path d={SLEEVE_L} fill={main} {...line} />
      <path d={SLEEVE_R} fill={main} {...line} />
      {sleeves}
      <circle cx="30.5" cy="99" r="3.9" fill={skin} {...line} strokeWidth={1.5} />
      <circle cx="69.5" cy="99" r="3.9" fill={skin} {...line} strokeWidth={1.5} />
    </g>
  )
}

// 여자: 다리 + 양말 + 신발
function GirlLegs({ skin, sock, shoe, sneaker, top = 108 }: { skin: string; sock: string; shoe: string; sneaker?: boolean; top?: number }) {
  return (
    <g>
      <rect x="39.5" y={top} width="6.2" height={130 - top} fill={skin} {...line} strokeWidth={1.5} />
      <rect x="54.3" y={top} width="6.2" height={130 - top} fill={skin} {...line} strokeWidth={1.5} />
      <rect x="39.2" y="121.5" width="6.8" height="9" rx="1" fill={sock} {...line} strokeWidth={1.5} />
      <rect x="54" y="121.5" width="6.8" height="9" rx="1" fill={sock} {...line} strokeWidth={1.5} />
      <Shoe x={42.2} y={133} color={shoe} sneaker={sneaker} />
      <Shoe x={57.8} y={133} color={shoe} sneaker={sneaker} />
    </g>
  )
}

function Shoe({ x, y, color, sneaker }: { x: number; y: number; color: string; sneaker?: boolean }) {
  return (
    <g>
      <path d={`M${x - 7} ${y + 1} Q${x - 7} ${y - 4.5} ${x} ${y - 4.5} Q${x + 7} ${y - 4.5} ${x + 7} ${y + 1} L${x + 7} ${y + 2} Q${x + 7} ${y + 4.5} ${x + 3.5} ${y + 4.5} L${x - 3.5} ${y + 4.5} Q${x - 7} ${y + 4.5} ${x - 7} ${y + 2} Z`} fill={color} {...line} strokeWidth={1.6} />
      {sneaker ? (
        <>
          <path d={`M${x - 6.6} ${y + 1.6} L${x + 6.6} ${y + 1.6}`} stroke={OL} strokeWidth="1.2" />
          <path d={`M${x - 6.4} ${y + 2.4} L${x + 6.4} ${y + 2.4} L${x + 6} ${y + 4} L${x - 6} ${y + 4} Z`} fill={WHITE} />
          <path d={`M${x - 2} ${y - 3} L${x + 2} ${y - 1.5} M${x - 2} ${y - 1.5} L${x + 2} ${y - 3}`} stroke={color === WHITE ? OL : WHITE} strokeWidth=".9" />
        </>
      ) : (
        <path d={`M${x - 3} ${y - 2.5} Q${x} ${y - 1} ${x + 3} ${y - 2.5}`} fill="none" stroke={WHITE} strokeWidth=".9" opacity=".6" />
      )}
    </g>
  )
}

// 긴 바지 (남자 공용 + 여자 데님)
function Pants({ color, stripe, cargo, shoe = '#2B2523', sneaker = true }: { color: string; stripe?: boolean; cargo?: boolean; shoe?: string; sneaker?: boolean }) {
  return (
    <g>
      <path d="M33.5 94 L50.4 94 L49.6 129.5 L35.5 129.5 Z" fill={color} {...line} />
      <path d="M49.6 94 L66.5 94 L64.5 129.5 L50.4 129.5 Z" fill={color} {...line} />
      {stripe && (
        <>
          <path d="M35 97 L36.6 128" stroke={WHITE} strokeWidth="1.6" />
          <path d="M65 97 L63.4 128" stroke={WHITE} strokeWidth="1.6" />
        </>
      )}
      {cargo && (
        <>
          <rect x="35.5" y="108" width="6" height="7" rx="1" fill={color} {...line} strokeWidth={1.2} />
          <rect x="58.5" y="108" width="6" height="7" rx="1" fill={color} {...line} strokeWidth={1.2} />
        </>
      )}
      <Shoe x={42.5} y={133.5} color={shoe} sneaker={sneaker} />
      <Shoe x={57.5} y={133.5} color={shoe} sneaker={sneaker} />
    </g>
  )
}

const Skirt = ({ color, pleats, buttons }: { color: string; pleats?: boolean; buttons?: boolean }) => (
  <g>
    <path d="M34 93 L66 93 L69.5 111 Q50 113.5 30.5 111 Z" fill={color} {...line} />
    {pleats && [40, 46, 54, 60].map((x) => <path key={x} d={`M${x} 95 L${x + (x - 50) * 0.18} 111.5`} stroke={OL} strokeWidth="1" opacity=".5" />)}
    {buttons && (
      <>
        <circle cx="50" cy="99" r="1.1" fill={WHITE} />
        <circle cx="50" cy="104" r="1.1" fill={WHITE} />
      </>
    )}
  </g>
)

// 앞이 열린 자켓 안쪽 이너
const InnerOpen = ({ color, square }: { color: string; square?: boolean }) =>
  square ? (
    <g>
      <path d="M43 64.5 L57 64.5 L57.4 96.5 L42.6 96.5 Z" fill={color} {...line} strokeWidth={1.4} />
      <path d="M43.6 70 L56.4 70" stroke={OL} strokeWidth="1.2" />
    </g>
  ) : (
    <path d="M43.6 63.5 Q50 66.5 56.4 63.5 L57 96.8 L43 96.8 Z" fill={color} {...line} strokeWidth={1.4} />
  )

const zip = <path d="M50 64 L50 98" stroke="#D9D9D9" strokeWidth="1.2" />

const OUTFITS: Record<Gender, ((c: string, skin: string) => OutfitParts)[]> = {
  f: [
    // 0 기본 자켓 + 스커트
    (c, skin) => ({
      lower: (
        <g>
          <GirlLegs skin={skin} sock="#2B2523" shoe="#2B2523" />
          <Skirt color="#2B2523" buttons />
        </g>
      ),
      upper: (
        <Upper main={c || '#2B2523'} skin={skin}>
          <InnerOpen color={CREAM} square />
        </Upper>
      ),
    }),
    // 1 베이지 가디건 룩
    (c, skin) => ({
      lower: (
        <g>
          <GirlLegs skin={skin} sock={WHITE} shoe="#6B4532" />
          <Skirt color="#6B4A3A" />
        </g>
      ),
      upper: (
        <Upper main={c || '#E6D2B0'} skin={skin}>
          <path d="M43 63.5 L50 71 L57 63.5" fill="none" {...line} strokeWidth={1.4} />
          <path d="M43.5 63.6 L47.5 68.6 L44 69.6 Z" fill={WHITE} {...line} strokeWidth={1.1} />
          <path d="M56.5 63.6 L52.5 68.6 L56 69.6 Z" fill={WHITE} {...line} strokeWidth={1.1} />
          <path d="M50 71 L50 98" stroke={OL} strokeWidth="1.2" />
          {[76, 83, 90].map((y) => (
            <circle key={y} cx="51.8" cy={y} r="1" fill="#6B4532" />
          ))}
        </Upper>
      ),
    }),
    // 2 후드 캐주얼
    (c, skin) => ({
      lower: (
        <g>
          <GirlLegs skin={skin} sock={WHITE} shoe={WHITE} sneaker />
          <Skirt color="#2B2523" pleats />
        </g>
      ),
      upper: (
        <Upper main={c || '#F1E4CC'} skin={skin}>
          <path d="M36 64.5 Q50 57 64 64.5 Q50 70 36 64.5 Z" fill={c || '#F1E4CC'} {...line} strokeWidth={1.5} />
          <path d="M46.5 66.5 L46 75" stroke={OL} strokeWidth="1.1" />
          <path d="M53.5 66.5 L54 75" stroke={OL} strokeWidth="1.1" />
          <path d="M41 84 L59 84 L61 95 L39 95 Z" fill="none" {...line} strokeWidth={1.3} />
        </Upper>
      ),
    }),
    // 3 데님 캐주얼
    (c, skin) => ({
      lower: <Pants color="#8FA9CC" shoe={WHITE} />,
      upper: (
        <Upper main={c || '#7F9CC4'} skin={skin}>
          <InnerOpen color={WHITE} />
          <rect x="37" y="72" width="5" height="4" rx=".8" fill="none" {...line} strokeWidth={1.1} />
          <rect x="58" y="72" width="5" height="4" rx=".8" fill="none" {...line} strokeWidth={1.1} />
        </Upper>
      ),
    }),
    // 4 스포티룩
    (c, skin) => ({
      lower: (
        <g>
          <GirlLegs skin={skin} sock={WHITE} shoe={WHITE} sneaker top={104} />
          <path d="M34 93 L66 93 L67 106 L51 106 L50 101 L49 106 L33 106 Z" fill="#2B2523" {...line} />
        </g>
      ),
      upper: (
        <Upper
          main={c || '#2B2523'}
          skin={skin}
          sleeves={
            <>
              <path d="M30 70 L28.8 94" stroke={WHITE} strokeWidth="1.5" />
              <path d="M70 70 L71.2 94" stroke={WHITE} strokeWidth="1.5" />
            </>
          }
        >
          <rect x="44" y="61.5" width="12" height="4" rx="1.5" fill={c || '#2B2523'} {...line} strokeWidth={1.3} />
          {zip}
        </Upper>
      ),
    }),
  ],
  m: [
    // 0 기본 재킷
    (c, skin) => ({
      lower: <Pants color="#2B2523" shoe="#2B2523" />,
      upper: (
        <Upper main={c || '#2B2523'} skin={skin}>
          <InnerOpen color={CREAM} />
        </Upper>
      ),
    }),
    // 1 후드 캐주얼
    (c, skin) => ({
      lower: <Pants color="#3A3433" cargo shoe="#2B2523" />,
      upper: (
        <Upper main={c || '#D9C6AE'} skin={skin}>
          <path d="M36 64.5 Q50 57 64 64.5 Q50 70 36 64.5 Z" fill={c || '#D9C6AE'} {...line} strokeWidth={1.5} />
          <path d="M46.5 66.5 L46 75" stroke={OL} strokeWidth="1.1" />
          <path d="M53.5 66.5 L54 75" stroke={OL} strokeWidth="1.1" />
          <path d="M41 84 L59 84 L61 95 L39 95 Z" fill="none" {...line} strokeWidth={1.3} />
        </Upper>
      ),
    }),
    // 2 가디건 단정룩
    (c, skin) => ({
      lower: <Pants color="#EFE6D6" shoe="#3A2A22" sneaker={false} />,
      upper: (
        <Upper main={c || '#7A5038'} skin={skin}>
          <path d="M43 63.5 L50 72 L57 63.5 Z" fill={WHITE} {...line} strokeWidth={1.3} />
          <path d="M44 63.6 L48 68 L45 69.4 Z" fill={WHITE} {...line} strokeWidth={1.1} />
          <path d="M56 63.6 L52 68 L55 69.4 Z" fill={WHITE} {...line} strokeWidth={1.1} />
          <path d="M50 72 L50 98" stroke={OL} strokeWidth="1.2" />
          {[77, 84, 91].map((y) => (
            <circle key={y} cx="51.8" cy={y} r="1" fill="#E6D2B0" />
          ))}
        </Upper>
      ),
    }),
    // 3 데님 캐주얼
    (c, skin) => ({
      lower: <Pants color="#6E8DB8" shoe="#7A6A60" />,
      upper: (
        <Upper main={c || '#5F7FAF'} skin={skin}>
          <InnerOpen color={WHITE} />
          <rect x="37" y="72" width="5" height="4" rx=".8" fill="none" {...line} strokeWidth={1.1} />
          <rect x="58" y="72" width="5" height="4" rx=".8" fill="none" {...line} strokeWidth={1.1} />
        </Upper>
      ),
    }),
    // 4 스포티룩
    (c, skin) => ({
      lower: <Pants color={c || '#2B2523'} stripe shoe="#2B2523" />,
      upper: (
        <Upper
          main={c || '#2B2523'}
          skin={skin}
          sleeves={
            <>
              <path d="M30 70 L28.8 94" stroke={WHITE} strokeWidth="1.5" />
              <path d="M70 70 L71.2 94" stroke={WHITE} strokeWidth="1.5" />
            </>
          }
        >
          <rect x="44" y="61.5" width="12" height="4" rx="1.5" fill={c || '#2B2523'} {...line} strokeWidth={1.3} />
          {zip}
        </Upper>
      ),
    }),
  ],
}
