import { useCallback, useEffect, useState } from 'react'

// 이 기기(브라우저)에만 저장되는 화면 설정
export type ViewSize = 'mini' | 'small' | 'normal' | 'large'
export type Settings = {
  /** PC 화면에서 앱 크기 */
  size: ViewSize
  /** 일정 시간 아무 조작이 없으면 시크릿 모드로 */
  secretOn: boolean
  /** 시크릿 모드로 바뀌는 시간 (분) */
  secretMinutes: number
}

export const SIZE_OPTIONS: { id: ViewSize; label: string; desc: string }[] = [
  { id: 'mini', label: '미니', desc: '오른쪽 아래 작은 창' },
  { id: 'small', label: '작게', desc: '좁은 화면' },
  { id: 'normal', label: '보통', desc: '기본' },
  { id: 'large', label: '크게', desc: '넓은 화면' },
]
export const SECRET_MINUTES = [1, 3, 5, 10, 30]

const KEY = 'bondee-settings'
const DEFAULT: Settings = { size: 'normal', secretOn: false, secretMinutes: 5 }

function read(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    return {
      size: SIZE_OPTIONS.some((o) => o.id === raw.size) ? raw.size : DEFAULT.size,
      secretOn: typeof raw.secretOn === 'boolean' ? raw.secretOn : DEFAULT.secretOn,
      secretMinutes: SECRET_MINUTES.includes(raw.secretMinutes) ? raw.secretMinutes : DEFAULT.secretMinutes,
    }
  } catch {
    return DEFAULT
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(read)
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* 저장 못 해도 이번 접속 동안은 적용 */
      }
      return next
    })
  }, [])
  return [settings, update] as const
}

/** 마지막 조작 후 minutes분이 지나면 onIdle */
export function useIdle(enabled: boolean, minutes: number, onIdle: () => void) {
  useEffect(() => {
    if (!enabled) return
    let timer = setTimeout(onIdle, minutes * 60_000)
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(onIdle, minutes * 60_000)
    }
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [enabled, minutes, onIdle])
}

/** PC(넓은 화면)에서의 앱 틀 크기 */
export const FRAME_CLASS: Record<ViewSize, string> = {
  mini: 'md:transform-gpu md:fixed md:bottom-4 md:right-4 md:left-auto md:top-auto md:mx-0 md:h-[min(620px,92dvh)] md:w-[340px] md:max-w-none md:overflow-hidden md:rounded-3xl md:text-[14px]',
  small: 'md:max-w-[380px]',
  normal: 'md:max-w-md',
  large: 'md:max-w-[600px]',
}
