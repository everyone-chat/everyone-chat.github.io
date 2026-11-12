// 캐릭터 외형 코드: profiles.emoji 칸에 "a1:헤어:머리색:피부" 형태로 저장
// (DB 구조를 바꾸지 않으려고 기존 칸을 재사용)

export const HAIR_STYLES = [
  { id: 'short', label: '숏컷' },
  { id: 'bob', label: '단발' },
  { id: 'long', label: '긴머리' },
  { id: 'buns', label: '양갈래' },
] as const
export type HairStyle = (typeof HAIR_STYLES)[number]['id']

export const HAIR_COLORS = ['#2E2430', '#5A3B2E', '#8A5A3C', '#E3B56A', '#F3A6C0', '#9DB4EE']
export const SKINS = ['#FFE7D6', '#F8D3B8', '#E6B392', '#C48A66']

export type Look = { hair: HairStyle; hairColor: number; skin: number }

export function parseLook(code: string | undefined): Look {
  const parts = (code ?? '').split(':')
  if (parts[0] === 'a1' && parts.length === 4) {
    const hair = HAIR_STYLES.some((h) => h.id === parts[1]) ? (parts[1] as HairStyle) : 'short'
    return {
      hair,
      hairColor: clamp(Number(parts[2]), HAIR_COLORS.length),
      skin: clamp(Number(parts[3]), SKINS.length),
    }
  }
  // 예전 방식(이모지)으로 저장된 친구는 이름 기반으로 기본 외형 지정
  let h = 0
  for (const ch of code ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return { hair: HAIR_STYLES[h % 4].id, hairColor: h % HAIR_COLORS.length, skin: h % 2 }
}

export const encodeLook = (l: Look) => `a1:${l.hair}:${l.hairColor}:${l.skin}`

export function randomLook(): Look {
  return {
    hair: HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)].id,
    hairColor: Math.floor(Math.random() * 3),
    skin: Math.floor(Math.random() * 2),
  }
}

function clamp(n: number, len: number) {
  return Number.isInteger(n) && n >= 0 && n < len ? n : 0
}
