export type Profile = {
  id: string
  nickname: string
  emoji: string
  color: string
  status: string
  approved: boolean
  is_admin: boolean
  banned: boolean
  friend_code: string
  friends_rev: number
  created_at: string
  last_seen: string
}

export type Message = {
  id: number
  user_id: string
  content: string
  image_path: string | null
  room_a: string
  room_b: string
  created_at: string
}

export type Tab = 'plaza' | 'chat' | 'me'

export const STATUSES = [
  { id: 'rest', label: '쉬는 중', icon: '☕' },
  { id: 'work', label: '일하는 중', icon: '💻' },
  { id: 'sleep', label: '자는 중', icon: '💤' },
  { id: 'play', label: '노는 중', icon: '🎮' },
  { id: 'happy', label: '기분 좋음', icon: '🥰' },
  { id: 'busy', label: '바쁨', icon: '🔥' },
] as const

export const statusOf = (id: string) => STATUSES.find((s) => s.id === id) ?? STATUSES[0]


export const COLORS = ['#FFD6E0', '#FFE8B6', '#C9F2D9', '#CDE7FF', '#E3D7FF', '#FFD9C2']

// 마지막 활동이 2분 30초 이내면 접속 중으로 표시
export const ONLINE_MS = 150_000
export const isOnline = (p: Profile, now: number) => now - new Date(p.last_seen).getTime() < ONLINE_MS

export type Friendship = { user_a: string; user_b: string; created_at: string }

// 두 사람 대화방 키 (작은 ID가 앞)
export const roomOf = (a: string, b: string) => (a < b ? { room_a: a, room_b: b } : { room_a: b, room_b: a })
export const peerOf = (m: { room_a: string; room_b: string }, me: string) => (m.room_a === me ? m.room_b : m.room_a)
