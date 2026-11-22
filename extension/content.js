// 보고 있는 페이지 맨 위에 알림 띠를 띄움 (페이지 스타일과 섞이지 않게 Shadow DOM 사용)
;(() => {
  const STYLES = {
    white: { bg: '#ffffff', fg: '#1f1f1f', sub: '#6b6b6b', accent: '#ff5a36', border: '#e6e6e6' },
    green: { bg: '#1ec05c', fg: '#ffffff', sub: '#e8fff0', accent: '#ffffff', border: '#19a84f' },
    blue: { bg: '#2f6fed', fg: '#ffffff', sub: '#e3ecff', accent: '#ffffff', border: '#255cd0' },
    orange: { bg: '#ff6a3d', fg: '#ffffff', sub: '#fff0ea', accent: '#ffffff', border: '#ea5a2f' },
    dark: { bg: '#222222', fg: '#ffffff', sub: '#bdbdbd', accent: '#ffd400', border: '#111111' },
  }
  const shown = new Set()

  function siteAllowed(sites) {
    const list = (sites || '')
      .split(/[\n,]/)
      .map((x) => x.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
      .filter(Boolean)
    if (!list.length) return true
    const h = location.hostname.toLowerCase()
    return list.some((d) => h === d || h.endsWith('.' + d))
  }

  async function render(p) {
    const s = p.settings
    if (!siteAllowed(s.sites) || shown.has(p.at)) return
    if (document.hidden) return // 이 탭을 볼 때 다시 확인
    if (Date.now() - p.at > 2 * 60_000) return
    // 같은 알림은 한 번만 (다른 탭·새 페이지에서 또 뜨지 않게)
    const { lastShownAt = 0 } = await chrome.storage.local.get('lastShownAt')
    if (lastShownAt >= p.at) return
    await chrome.storage.local.set({ lastShownAt: p.at })
    shown.add(p.at)
    const c = STYLES[s.style] || STYLES.white
    const host = document.createElement('div')
    host.style.cssText = 'all:initial;position:fixed;top:0;left:0;right:0;z-index:2147483647;pointer-events:none;'
    const root = host.attachShadow({ mode: 'closed' })
    const text = String(s.text || '').replace(/\{n\}/g, String(p.n))
    root.innerHTML = `
      <style>
        .bar{pointer-events:auto;box-sizing:border-box;display:flex;align-items:center;gap:10px;margin:0 auto;max-width:720px;
          padding:10px 14px;background:${c.bg};color:${c.fg};border:1px solid ${c.border};border-top:none;border-radius:0 0 14px 14px;
          box-shadow:0 6px 20px rgba(0,0,0,.18);font:14px/1.35 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Pretendard",sans-serif;
          transform:translateY(-110%);transition:transform .35s cubic-bezier(.2,.9,.3,1);cursor:pointer}
        .bar.in{transform:translateY(0)}
        .ic{font-size:20px;line-height:1;flex:none}
        .tx{flex:1;min-width:0}
        .t{font-weight:700;display:flex;gap:6px;align-items:center}
        .t small{font-weight:400;color:${c.sub};font-size:12px}
        .b{color:${c.sub};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .dot{width:7px;height:7px;border-radius:50%;background:${c.accent};flex:none}
        .x{all:unset;cursor:pointer;color:${c.sub};font-size:18px;padding:0 4px;flex:none}
      </style>
      <div class="bar" role="status">
        <span class="ic"></span>
        <div class="tx"><div class="t"><span class="ti"></span><small>지금</small></div><div class="b"></div></div>
        <span class="dot"></span>
        <button class="x" aria-label="닫기">×</button>
      </div>`
    root.querySelector('.ic').textContent = s.icon || '🔔'
    root.querySelector('.ti').textContent = s.title || '알림'
    root.querySelector('.b').textContent = text
    const bar = root.querySelector('.bar')
    const close = () => {
      bar.classList.remove('in')
      setTimeout(() => host.remove(), 400)
    }
    bar.addEventListener('click', close)
    document.documentElement.appendChild(host)
    requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.add('in')))
    const sec = Number(s.seconds)
    if (sec > 0) setTimeout(close, sec * 1000)
  }

  chrome.runtime.onMessage.addListener((p) => p?.type === 'banner' && render(p))
  // 다른 탭을 보고 있다가 이 탭으로 돌아오면, 2분 안에 온 알림은 여기서 띄움
  const checkPending = () =>
    !document.hidden && chrome.storage.local.get('pending').then(({ pending }) => pending && render(pending)).catch(() => {})
  document.addEventListener('visibilitychange', checkPending)
  checkPending()
})()
