import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applyTheme, read as readSettings } from './settings'

// 첫 화면부터 저장된 테마로 (깜빡임 방지)
applyTheme(readSettings().theme)
import App from './App'

// 휴대폰 알림용 서비스 워커
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
