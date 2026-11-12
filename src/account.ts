import { supabase } from './supabase'

// 아이디 로그인: 이메일 없이 쓰도록 아이디를 내부용 주소로 바꿔서 Supabase 비밀번호 로그인 사용
// (실제로 메일이 가지 않도록 Supabase의 "이메일 확인"은 꺼 둬야 함)
const DOMAIN = 'everyone-chat.app'
export const ID_RULE = /^[a-z0-9_]{4,20}$/
export const toEmail = (id: string) => `${id.trim().toLowerCase()}@${DOMAIN}`
export const idOf = (email?: string | null) => (email && email.endsWith('@' + DOMAIN) ? email.split('@')[0] : null)

export async function currentAccount() {
  const { data } = await supabase.auth.getUser()
  const u = data.user
  return { anonymous: !u || u.is_anonymous === true || !u.email, loginId: idOf(u?.email) }
}

/** 지금 쓰는 임시 계정에 아이디·비밀번호를 붙여서 정식 계정으로 (프로필·친구·대화 그대로) */
export async function secureAccount(id: string, password: string): Promise<string | null> {
  const loginId = id.trim().toLowerCase()
  if (!ID_RULE.test(loginId)) return '아이디는 영문 소문자·숫자·_ 4~20자로 정해 주세요.'
  if (password.length < 6) return '비밀번호는 6자 이상으로 정해 주세요.'
  const { error: e1 } = await supabase.auth.updateUser({ email: toEmail(loginId) })
  if (e1) {
    if (/already|registered|exists/i.test(e1.message)) return '이미 다른 사람이 쓰는 아이디예요.'
    console.error(e1)
    return '등록에 실패했어요. 잠시 후 다시 시도해 주세요.'
  }
  const { error: e2 } = await supabase.auth.updateUser({ password })
  if (e2) {
    console.error(e2)
    return '비밀번호 등록에 실패했어요. 다시 시도해 주세요.'
  }
  return null
}

export async function changePassword(password: string): Promise<string | null> {
  if (password.length < 6) return '비밀번호는 6자 이상으로 정해 주세요.'
  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    console.error(error)
    return '비밀번호 변경에 실패했어요.'
  }
  return null
}

export async function loginWithId(id: string, password: string): Promise<string | null> {
  const loginId = id.trim().toLowerCase()
  if (!ID_RULE.test(loginId) || !password) return '아이디와 비밀번호를 확인해 주세요.'
  const { error } = await supabase.auth.signInWithPassword({ email: toEmail(loginId), password })
  if (error) return /invalid/i.test(error.message) ? '아이디 또는 비밀번호가 맞지 않아요.' : '로그인에 실패했어요. 잠시 후 다시 시도해 주세요.'
  return null
}
