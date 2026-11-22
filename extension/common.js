// 공용 설정 (background·popup에서 사용)
export const SUPABASE_URL = 'https://uzzyadqvshwtrqsaexbr.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_eBXn4fB7b4fVbDQU9G6HGQ_erdnV2jq' // 공개용 키
export const ID_DOMAIN = 'everyone-chat.app'

export const DEFAULTS = {
  enabled: true,
  title: '알림',
  text: '새 소식이 {n}건 있어요',
  icon: '🔔',
  style: 'white',
  seconds: 8,
  sites: '', // 비우면 모든 사이트, 아니면 줄마다 도메인 (예: naver.com)
}

export const STYLES = {
  white: { label: '흰색 카드', bg: '#ffffff', fg: '#1f1f1f', sub: '#6b6b6b', accent: '#ff5a36', border: '#e6e6e6' },
  green: { label: '초록 띠', bg: '#1ec05c', fg: '#ffffff', sub: '#e8fff0', accent: '#ffffff', border: '#19a84f' },
  blue: { label: '파랑 띠', bg: '#2f6fed', fg: '#ffffff', sub: '#e3ecff', accent: '#ffffff', border: '#255cd0' },
  orange: { label: '주황 띠', bg: '#ff6a3d', fg: '#ffffff', sub: '#fff0ea', accent: '#ffffff', border: '#ea5a2f' },
  dark: { label: '검정 띠', bg: '#222222', fg: '#ffffff', sub: '#bdbdbd', accent: '#ffd400', border: '#111111' },
}

export const ICONS = ['🔔', '🛒', '📦', '💬', '📢', '✉️', '📊', '✅']
