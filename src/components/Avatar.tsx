import { useId } from 'react'
import { HAIR_COLORS, SKINS, parseLook } from '../look'

type Props = {
  look: string
  color: string
  size?: number
  sleeping?: boolean
  /** 얼굴만 (채팅 프로필 등 작은 자리) */
  headOnly?: boolean
}

const INK = '#3A3142'

// 큰 머리 + 작은 몸의 치비 캐릭터 (SVG로 직접 그림)
export default function Avatar({ look, color, size = 72, sleeping, headOnly }: Props) {
  const l = parseLook(look)
  const hair = HAIR_COLORS[l.hairColor]
  const skin = SKINS[l.skin]
  const uid = useId().replace(/:/g, '')
  const vb = headOnly ? '8 8 84 84' : '0 0 100 132'
  const h = headOnly ? size : size * 1.32

  return (
    <svg width={size} height={h} viewBox={vb} aria-hidden style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={`cheek${uid}`}>
          <stop offset="0" stopColor="#FF8FAE" stopOpacity=".55" />
          <stop offset="1" stopColor="#FF8FAE" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 그림자 */}
      {!headOnly && <ellipse cx="50" cy="127" rx="22" ry="4" fill="#5A4E7A" opacity=".12" />}

      {/* 뒷머리 */}
      {l.hair === 'long' && <path d="M15 50 C15 22 32 13 50 13 C68 13 85 22 85 50 L87 104 C70 110 30 110 13 104 Z" fill={hair} />}
      {l.hair === 'bob' && <path d="M14 52 C14 22 32 13 50 13 C68 13 86 22 86 52 L86 76 C78 82 22 82 14 76 Z" fill={hair} />}
      {l.hair === 'buns' && (
        <>
          <circle cx="20" cy="24" r="12" fill={hair} />
          <circle cx="80" cy="24" r="12" fill={hair} />
        </>
      )}

      {!headOnly && (
        <g>
          {/* 다리·신발 */}
          <rect x="38" y="108" width="9" height="13" rx="4.5" fill="#6E6888" />
          <rect x="53" y="108" width="9" height="13" rx="4.5" fill="#6E6888" />
          <ellipse cx="42" cy="122" rx="7" ry="4" fill="#fff" stroke="#E6E0EE" strokeWidth="1.5" />
          <ellipse cx="58" cy="122" rx="7" ry="4" fill="#fff" stroke="#E6E0EE" strokeWidth="1.5" />
          {/* 팔 */}
          <ellipse cx="27" cy="98" rx="6" ry="11" transform="rotate(18 27 98)" fill={color} stroke="#0000000f" strokeWidth="1.5" />
          <ellipse cx="73" cy="98" rx="6" ry="11" transform="rotate(-18 73 98)" fill={color} stroke="#0000000f" strokeWidth="1.5" />
          <circle cx="24" cy="108" r="4.5" fill={skin} />
          <circle cx="76" cy="108" r="4.5" fill={skin} />
          {/* 몸통 */}
          <path d="M31 86 Q50 79 69 86 L72 110 Q50 116 28 110 Z" fill={color} stroke="#0000000f" strokeWidth="1.5" />
          <path d="M43 83 Q50 89 57 83" fill="none" stroke="#ffffffaa" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}

      {/* 귀 */}
      <circle cx="16.5" cy="55" r="6" fill={skin} />
      <circle cx="83.5" cy="55" r="6" fill={skin} />

      {/* 얼굴 */}
      <circle cx="50" cy="51" r="34" fill={skin} />

      {/* 앞머리 */}
      {l.hair === 'short' && <path d="M16 52 C13 25 30 14 50 14 C70 14 87 25 84 52 C80 42 74 35 66 33 C58 41 44 42 32 37 C25 41 20 46 16 52 Z" fill={hair} />}
      {l.hair === 'bob' && <path d="M15 58 C12 26 30 14 50 14 C70 14 88 26 85 58 C82 46 78 38 72 34 C64 40 56 41 50 36 C44 41 36 40 28 34 C22 38 18 46 15 58 Z" fill={hair} />}
      {l.hair === 'long' && <path d="M15 60 C12 26 30 14 50 14 C70 14 88 26 85 60 C83 46 79 37 70 32 C60 38 52 38 50 30 C46 38 36 40 30 33 C21 38 17 48 15 60 Z" fill={hair} />}
      {l.hair === 'buns' && <path d="M16 50 C14 25 30 15 50 15 C70 15 86 25 84 50 C79 40 70 34 60 32 C54 38 46 38 40 32 C30 34 21 40 16 50 Z" fill={hair} />}
      {/* 머리 하이라이트 */}
      <path d="M33 22 Q42 18 50 19" fill="none" stroke="#ffffff55" strokeWidth="3" strokeLinecap="round" />

      {/* 볼터치 */}
      <ellipse cx="29" cy="66" rx="8" ry="5" fill={`url(#cheek${uid})`} />
      <ellipse cx="71" cy="66" rx="8" ry="5" fill={`url(#cheek${uid})`} />

      {/* 눈 */}
      {sleeping ? (
        <>
          <path d="M33 58 Q38 62 43 58" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M57 58 Q62 62 67 58" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="38" cy="58" rx="4.2" ry="5.2" fill={INK} />
          <ellipse cx="62" cy="58" rx="4.2" ry="5.2" fill={INK} />
          <circle cx="39.5" cy="56" r="1.6" fill="#fff" />
          <circle cx="63.5" cy="56" r="1.6" fill="#fff" />
        </>
      )}

      {/* 입 */}
      <path d="M46 68 Q50 72 54 68" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
