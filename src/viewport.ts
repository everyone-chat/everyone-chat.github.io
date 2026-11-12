import { useEffect } from 'react'

/**
 * 휴대폰 자판이 올라오면 실제로 보이는 높이(visualViewport)에 화면을 맞춤
 * → 입력창이 자판 바로 위에 붙어 따라 올라감 (iOS Safari·안드로이드 크롬 공통)
 */
export function useViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport
    const root = document.documentElement
    let maxH = 0
    let lastW = window.innerWidth
    const apply = () => {
      const h = vv ? vv.height : window.innerHeight
      if (window.innerWidth !== lastW) {
        lastW = window.innerWidth
        maxH = 0 // 화면 회전
      }
      maxH = Math.max(maxH, h)
      root.style.setProperty('--app-h', `${Math.round(h)}px`)
      // 자판이 열렸는지 (아래 메뉴를 숨겨 대화 칸을 넓게)
      root.classList.toggle('kb-open', h < maxH - 150)
      // iOS는 자판이 열리면 페이지 전체를 위로 밀어 올리므로 다시 맨 위로 고정
      if (vv && vv.offsetTop > 0) window.scrollTo(0, 0)
    }
    apply()
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)
    window.addEventListener('resize', apply)
    return () => {
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
      window.removeEventListener('resize', apply)
    }
  }, [])
}
