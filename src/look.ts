// 캐릭터 외형 코드: profiles.emoji 칸에 문자열로 저장 (DB 구조 변경 없음)
// a3:성별:헤어:눈:표정:상의:하의:원피스:신발:모자:안경:머리색:피부
//   (원피스·모자·안경은 -1 = 없음)

export type Gender = 'f' | 'm'

export const HAIR_NAMES = {
  f: ['롱 스트레이트', '사이드파트 미디엄', '양갈래 땋은머리', '하이 포니테일', '단발 보브'],
  m: ['소프트 메시', '사이드파트', '볼륨 컬', '콤마 헤어', '숏 크롭'],
} as const
export const EYE_NAMES = ['기본 눈', '웃는 눈', '고양이 눈', '졸린 눈', '반짝이는 눈']
export const EXPR_NAMES = ['기본 웃음', '활짝 웃음', '놀람', '당황', '삐짐']
export const TOP_NAMES = ['기본 자켓', '베이직 가디건', '후드', '데님 자켓', '스포티 집업']
export const BOTTOM_NAMES = ['플리츠 스커트', 'A라인 스커트', '데님 숏팬츠', '데님 팬츠', '트레이닝 팬츠']
export const ONE_NAMES = ['멜빵 원피스', '리본 원피스', '파자마 세트', '데님 세트', '로브 세트']
export const SHOE_NAMES = ['검은 부츠', '흰색 운동화', '갈색 로퍼', '스포티 운동화', '포근한 슬리퍼']
export const HAT_NAMES = ['기본 헤어밴드', '리본 헤어밴드', '수면 모자', '볼캡 모자', '니트 비니']
export const ACC_NAMES = ['둥근 안경', '사각 안경', '선글라스', '헤드폰', '작은 리본']

// 0번 = 그림 원래 색
export const HAIR_COLORS = ['', '#4A2F25', '#2A2426', '#7A3F2A', '#8A7468', '#C08A57', '#E7C27A', '#2F3150', '#E9A3B8']
export const SKINS = ['', '#F7D6C0', '#EBBB9C', '#C98F6B']

export type Look = {
  g: Gender
  hair: number
  eyes: number
  expr: number
  top: number
  bottom: number
  one: number
  shoes: number
  hat: number
  acc: number
  hairColor: number
  skin: number
}

const clamp = (n: number, len: number, min = 0) => (Number.isInteger(n) && n >= min && n < len ? n : Math.max(0, min))

export const DEFAULT_LOOK: Look = { g: 'f', hair: 0, eyes: 0, expr: 0, top: 0, bottom: 0, one: -1, shoes: 0, hat: -1, acc: -1, hairColor: 0, skin: 0 }

export function parseLook(code: string | undefined): Look {
  const p = (code ?? '').split(':')
  if (p[0] === 'a3' && p.length === 13) {
    const n = p.slice(2).map(Number)
    return {
      g: p[1] === 'm' ? 'm' : 'f',
      hair: clamp(n[0], 5),
      eyes: clamp(n[1], 5),
      expr: clamp(n[2], 5),
      top: clamp(n[3], 5),
      bottom: clamp(n[4], 5),
      one: clamp(n[5], 5, -1),
      shoes: clamp(n[6], 5),
      hat: clamp(n[7], 5, -1),
      acc: clamp(n[8], 5, -1),
      hairColor: clamp(n[9], HAIR_COLORS.length),
      skin: clamp(n[10], SKINS.length),
    }
  }
  // 이전 캐릭터(a2) → 새 캐릭터로 변환
  if (p[0] === 'a2' && p.length === 10) {
    const n = p.slice(2).map(Number)
    const g: Gender = p[1] === 'm' ? 'm' : 'f'
    const o = clamp(n[2], 5)
    const outfitF = [[0, 0], [1, 1], [2, 0], [3, 3], [4, 4]]
    const outfitM = [[0, 4], [2, 3], [1, 3], [3, 3], [4, 4]]
    const [top, bottom] = (g === 'f' ? outfitF : outfitM)[o]
    const exprMap = [0, 1, 2, 4, 1]
    return {
      ...DEFAULT_LOOK,
      g,
      hair: clamp(n[0], 5),
      eyes: clamp(n[1], 5),
      expr: exprMap[clamp(n[3], 5)],
      top,
      bottom,
      shoes: g === 'f' ? 0 : 1,
      hairColor: Math.min(clamp(n[4], 8) + 1, HAIR_COLORS.length - 1),
      skin: clamp(n[7], SKINS.length),
    }
  }
  // 그보다 예전 값은 글자 기반 기본 외형
  let h = 0
  for (const ch of code ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const g: Gender = h % 2 ? 'm' : 'f'
  return { ...DEFAULT_LOOK, g, hair: h % 5, top: h % 5, bottom: g === 'm' ? 3 : h % 3, shoes: (h >> 3) % 4 }
}

export const encodeLook = (l: Look) =>
  `a3:${l.g}:${l.hair}:${l.eyes}:${l.expr}:${l.top}:${l.bottom}:${l.one}:${l.shoes}:${l.hat}:${l.acc}:${l.hairColor}:${l.skin}`

export function randomLook(): Look {
  const r = (n: number) => Math.floor(Math.random() * n)
  const g: Gender = r(2) ? 'm' : 'f'
  return { ...DEFAULT_LOOK, g, hair: r(5), eyes: r(5), top: r(5), bottom: g === 'm' ? 3 + r(2) : r(5), shoes: r(4) }
}
