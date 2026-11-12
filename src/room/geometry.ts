// =========================================================
// 방의 고정 원근 (참고 이미지 구도: 720 x 405)
// 바닥 좌표: u = 왼쪽(0) ~ 오른쪽(1), v = 뒷벽(0) ~ 화면 앞(1)
// =========================================================

export const W = 720
export const H = 405
export const BACK = { l: 130, r: 568, top: 55, bottom: 278 }
const DEPTH_PX = H - BACK.bottom // 127

/** 뒷벽 기준 1cm 당 픽셀 (뒷벽 너비 438px ≈ 4.9m) */
export const K = 0.89

export const yOf = (v: number) => BACK.bottom + v * DEPTH_PX
export const leftAt = (y: number) => BACK.l - ((y - BACK.bottom) * BACK.l) / 57
export const rightAt = (y: number) => BACK.r + ((y - BACK.bottom) * 152) / 77

/** 바닥 좌표 → 화면 좌표 */
export function toScreen(u: number, v: number) {
  const y = yOf(v)
  const l = leftAt(y)
  const r = rightAt(y)
  return { x: l + u * (r - l), y }
}

/** 화면 좌표 → 바닥 좌표 */
export function fromScreen(x: number, y: number) {
  const v = (y - BACK.bottom) / DEPTH_PX
  const l = leftAt(y)
  const r = rightAt(y)
  return { u: (x - l) / (r - l), v }
}

/** 그 깊이에서의 크기 배율 (뒷벽 = 1) */
export const scaleAt = (v: number) => {
  const y = yOf(v)
  return (rightAt(y) - leftAt(y)) / (BACK.r - BACK.l)
}

// 가구·캐릭터가 움직일 수 있는 범위
export const U_MIN = 0.06
export const U_MAX = 0.94
export const V_MIN = 0.02
export const V_MAX = 0.74
export const clampUV = (u: number, v: number) => ({
  u: Math.min(U_MAX, Math.max(U_MIN, u)),
  v: Math.min(V_MAX, Math.max(V_MIN, v)),
})

/** 바닥 위 cm 크기 → 바닥 좌표 크기 (러그용) */
export const CM_U = 1 / 490
export const CM_V = 1 / 420

export const pt = (p: { x: number; y: number }) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`

/** 색을 밝게(+) / 어둡게(-) */
export function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt)),
  )
  return '#' + ch.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')
}
