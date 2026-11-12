import { useState } from 'react'
import { supabase } from '../supabase'
import ProfileEditor from '../components/ProfileEditor'
import { COLORS, type Profile } from '../types'
import { encodeLook, randomLook } from '../look'
import Sky from '../components/Sky'
import { loginWithId } from '../account'

type Props = { onJoined: (p: Profile) => void }

export default function Entry({ onJoined }: Props) {
  const [step, setStep] = useState<'code' | 'profile' | 'login'>('code')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [emoji, setEmoji] = useState(() => encodeLook(randomLook()))
  const [color, setColor] = useState(COLORS[Math.floor(Math.random() * COLORS.length)])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function ensureSession() {
    const { data } = await supabase.auth.getSession()
    if (data.session) return
    const { error } = await supabase.auth.signInAnonymously()
    if (error) throw error
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    setError('')
    try {
      await ensureSession()
      const { data, error } = await supabase.rpc('verify_invite', { p_code: code })
      if (error) throw error
      if (!data) {
        setError('입장 코드가 맞지 않아요. 초대한 친구에게 다시 물어봐 주세요.')
        return
      }
      setStep('profile')
    } catch (err) {
      console.error(err)
      setError('연결에 문제가 있어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const err = await loginWithId(loginId, password)
      if (err) return setError(err)
      const { data: u } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', u.user!.id).maybeSingle()
      if (profile?.approved) return onJoined(profile as Profile)
      if (profile?.banned) {
        await supabase.auth.signOut()
        return setError('내보내진 계정이에요. 방 주인에게 물어봐 주세요.')
      }
      // 채팅방을 나갔던 계정: 입장 코드만 다시 넣으면 그대로 복귀
      if (profile) {
        setNickname(profile.nickname)
        setEmoji(profile.emoji)
        setColor(profile.color)
      }
      setStep('code')
      setError('로그인했어요. 입장 코드를 다시 넣으면 예전 그대로 들어가요.')
    } catch (err) {
      console.error(err)
      setError('로그인에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  async function submitProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!nickname.trim()) {
      setError('닉네임을 입력해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await ensureSession()
      const { data, error } = await supabase.rpc('join_community', {
        p_code: code,
        p_nickname: nickname.trim(),
        p_emoji: emoji,
        p_color: color,
      })
      if (error) {
        if (error.message.includes('banned')) {
          setStep('code')
          setError('이 브라우저는 채팅방에서 내보내졌어요.')
          return
        }
        if (error.message.includes('invalid_code')) {
          setStep('code')
          setError('입장 코드가 바뀌었어요. 새 코드를 입력해 주세요.')
          return
        }
        throw error
      }
      onJoined(data as Profile)
    } catch (err) {
      console.error(err)
      setError('입장에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative h-dvh overflow-y-auto">
      <Sky />
      <div className="relative mx-auto flex min-h-full max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-6 text-center">
          <div className="mb-2 text-5xl">🫧</div>
          <h1 className="font-cute text-4xl text-ink">우리 광장</h1>
          <p className="mt-1 text-ink-soft">친구들만 들어올 수 있는 작은 공간</p>
        </div>

        <div className="pop rounded-[32px] border-2 border-white bg-white/70 p-6 shadow-[0_12px_32px_rgba(120,110,170,0.15)] backdrop-blur">
          {step === 'login' ? (
            <form onSubmit={submitLogin} className="flex flex-col gap-3">
              <span className="font-cute text-lg">아이디로 로그인</span>
              <input
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                autoFocus
                autoCapitalize="off"
                autoComplete="username"
                placeholder="아이디"
                className="w-full rounded-2xl border-2 border-white bg-white/80 px-4 py-3 text-base outline-none focus:border-accent"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="비밀번호"
                className="w-full rounded-2xl border-2 border-white bg-white/80 px-4 py-3 text-base outline-none focus:border-accent"
              />
              {error && <p className="text-sm text-accent-deep">{error}</p>}
              <button disabled={busy} className="squish rounded-2xl bg-accent py-3.5 font-cute text-lg text-white shadow-[0_4px_0_var(--color-accent-deep)] disabled:opacity-60">
                {busy ? '로그인 중…' : '로그인'}
              </button>
              <button type="button" onClick={() => { setStep('code'); setError('') }} className="text-sm text-ink-soft underline">
                처음이에요 (입장 코드로 들어가기)
              </button>
            </form>
          ) : step === 'code' ? (
            <form onSubmit={submitCode} className="flex flex-col gap-4">
              <label>
                <span className="mb-1.5 block font-cute text-lg">입장 코드</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                  autoCapitalize="off"
                  autoComplete="off"
                  placeholder="초대받은 코드를 입력해요"
                  className="w-full rounded-2xl border-2 border-white bg-white/80 px-4 py-3 text-base outline-none focus:border-accent"
                />
              </label>
              {error && <p className="text-sm text-accent-deep">{error}</p>}
              <button
                disabled={busy}
                className="squish rounded-2xl bg-accent py-3.5 font-cute text-lg text-white shadow-[0_4px_0_var(--color-accent-deep)] disabled:opacity-60"
              >
                {busy ? '확인 중…' : '들어가기'}
              </button>
              <button type="button" onClick={() => { setStep('login'); setError('') }} className="text-sm text-ink-soft underline">
                이미 계정이 있어요 (아이디로 로그인)
              </button>
            </form>
          ) : (
            <form onSubmit={submitProfile} className="flex flex-col gap-5">
              <h2 className="text-center font-cute text-xl">나를 꾸며요</h2>
              <ProfileEditor
                nickname={nickname}
                look={emoji}
                color={color}
                onChange={(v) => {
                  if (v.nickname !== undefined) setNickname(v.nickname)
                  if (v.look) setEmoji(v.look)
                  if (v.color) setColor(v.color)
                }}
              />
              {error && <p className="text-sm text-accent-deep">{error}</p>}
              <button
                disabled={busy}
                className="squish rounded-2xl bg-accent py-3.5 font-cute text-lg text-white shadow-[0_4px_0_var(--color-accent-deep)] disabled:opacity-60"
              >
                {busy ? '입장 중…' : '마이룸으로 가기'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-ink-soft">
          회원가입 없이 이 브라우저에 자동 저장돼요.
          <br />
          브라우저 기록을 지우거나 다른 기기에서 들어오면 새로 입장해야 해요.
        </p>
      </div>
    </div>
  )
}
