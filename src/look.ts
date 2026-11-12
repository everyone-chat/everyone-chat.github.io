// 캐릭터 외형 코드: profiles.emoji 칸에 문자열로 저장 (DB 구조 변경 없음)
// a2:성별:헤어:눈:코디:표정:머리색:눈색:옷색:피부
//   예) a2:f:0:0:0:0:0:0:0:0

export type Gender = 'f' | 'm'

export const PARTS = {
  f: {
    hair: ['롱 스트레이트', '사이드파트 웨이브', '양갈래 땋은머리', '하이 포니테일', '단발 보브'],
    eyes: ['동글 눈', '웃는 눈', '고양이 눈', '처진 눈', '반짝이는 눈'],
    outfit: ['자켓+스커트', '베이지 가디건', '후드 캐주얼', '데님 캐주얼', '스포티룩'],
    expr: ['기본 웃음', '윙크', '놀람', '삐짐', '활짝 웃음'],
  },
  m: {
    hair: ['소프트 메시', '사이드파트', '볼륨 컬', '콤마 헤어', '숏 크롭'],
    eyes: ['동그란 눈', '웃는 눈', '날렵한 눈', '졸린 눈', '반짝이는 눈'],
    outfit: ['기본 재킷', '후드 캐주얼', '가디건 단정룩', '데님 캐주얼', '스포티룩'],
    expr: ['기본 웃음', '윙크', '놀람', '진지', '활짝 웃음'],
  },
} as const

export const HAIR_COLORS = ['#4A2F25', '#2A2426', '#7A3F2A', '#7D6A5E', '#B07D4F', '#2F3150', '#E7C27A', '#E9A3B8']
export const EYE_COLORS = ['#2B211F', '#5A3A2C', '#7A5A3A', '#5E6470', '#4B5C8A', '#8A5560']
// 0번은 "코디 원래 색"
export const OUTFIT_COLORS = ['', '#2B2523', '#E6D2B0', '#F3EAD8', '#7F9CC4', '#7A5038', '#F2B8C6', '#B9A6E0', '#9FD3B0']
export const SKINS = ['#FCE7DA', '#F7D6C0', '#EBBB9C', '#C98F6B']

export type Look = {
  g: Gender
  hair: number
  eyes: number
  outfit: number
  expr: number
  hairColor: number
  eyeColor: number
  outfitColor: number
  skin: number
}

const clamp = (n: number, len: number) => (Number.isInteger(n) && n >= 0 && n < len ? n : 0)

export function parseLook(code: string | undefined): Look {
  const p = (code ?? '').split(':')
  if (p[0] === 'a2' && p.length === 10) {
    const n = p.slice(2).map(Number)
    return {
      g: p[1] === 'm' ? 'm' : 'f',
      hair: clamp(n[0], 5),
      eyes: clamp(n[1], 5),
      outfit: clamp(n[2], 5),
      expr: clamp(n[3], 5),
      hairColor: clamp(n[4], HAIR_COLORS.length),
      eyeColor: clamp(n[5], EYE_COLORS.length),
      outfitColor: clamp(n[6], OUTFIT_COLORS.length),
      skin: clamp(n[7], SKINS.length),
    }
  }
  // 예전 캐릭터(a1: 헤어 4종) → 새 캐릭터로 자연스럽게 변환
  if (p[0] === 'a1' && p.length === 4) {
    const old = p[1]
    const g: Gender = old === 'short' ? 'm' : 'f'
    const hair = old === 'bob' ? 4 : old === 'buns' ? 2 : 0
    return { g, hair, eyes: 0, outfit: 0, expr: 0, hairColor: clamp(Number(p[2]), 6), eyeColor: 0, outfitColor: 0, skin: clamp(Number(p[3]), SKINS.length) }
  }
  // 그보다 예전(이모지) 값은 글자 기반으로 기본 외형 지정
  let h = 0
  for (const ch of code ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return { g: h % 2 ? 'm' : 'f', hair: h % 5, eyes: 0, outfit: h % 5, expr: 0, hairColor: h % 3, eyeColor: 0, outfitColor: 0, skin: h % 2 }
}

export const encodeLook = (l: Look) =>
  `a2:${l.g}:${l.hair}:${l.eyes}:${l.outfit}:${l.expr}:${l.hairColor}:${l.eyeColor}:${l.outfitColor}:${l.skin}`

export function randomLook(): Look {
  const r = (n: number) => Math.floor(Math.random() * n)
  return { g: r(2) ? 'm' : 'f', hair: r(5), eyes: r(5), outfit: r(5), expr: 0, hairColor: r(3), eyeColor: 0, outfitColor: 0, skin: r(2) }
}
