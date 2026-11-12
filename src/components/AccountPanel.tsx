import { useEffect, useState } from 'react'
import { changePassword, currentAccount, secureAccount } from '../account'

const field = 'w-full rounded-2xl border-2 border-white bg-white px-4 py-2.5 outline-none focus:border-accent'

export default function AccountPanel() {
  const [state, setState] = useState<{ anonymous: boolean; loginId: string | null } | null>(null)
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [changing, setChanging] = useState(false)

  useEffect(() => {
    currentAccount().then(setState)
  }, [])

  if (!state) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pw !== pw2) return setMsg('비밀번호가 서로 달라요.')
    setBusy(true)
    const err = state!.anonymous ? await secureAccount(id, pw) : await changePassword(pw)
    setBusy(false)
    if (err) return setMsg(err)
    setMsg(state!.anonymous ? '등록했어요! 이제 다른 기기에서도 이 아이디로 로그인할 수 있어요.' : '비밀번호를 바꿨어요.')
    setPw('')
    setPw2('')
    setChanging(false)
    setState(await currentAccount())
  }

  return (
    <section className="mt-7 rounded-[28px] border-2 border-white bg-white/70 px-5 py-6">
      <h2 className="mb-2 font-cute text-lg">내 계정</h2>
      {state.anonymous ? (
        <>
          <p className="mb-3 text-xs leading-relaxed text-ink-soft">
            지금은 이 브라우저에만 저장된 임시 계정이에요. 아이디·비밀번호를 등록하면 다른 기기·브라우저에서도 같은 계정(캐릭터, 친구, 대화, 마스터 권한)으로 들어올 수 있어요.
          </p>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <input value={id} onChange={(e) => setId(e.target.value)} placeholder="아이디 (영문 소문자·숫자 4~20자)" autoCapitalize="off" autoComplete="username" className={field} />
            <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder="비밀번호 (6자 이상)" autoComplete="new-password" className={field} />
            <input value={pw2} onChange={(e) => setPw2(e.target.value)} type="password" placeholder="비밀번호 확인" autoComplete="new-password" className={field} />
            <button disabled={busy} className="squish mt-1 rounded-2xl bg-accent py-2.5 font-cute text-white disabled:opacity-50">
              {busy ? '등록 중…' : '계정 지키기'}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm">
            아이디 <b>{state.loginId}</b> 로 등록된 계정이에요.
          </p>
          {changing ? (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder="새 비밀번호 (6자 이상)" autoComplete="new-password" className={field} />
              <input value={pw2} onChange={(e) => setPw2(e.target.value)} type="password" placeholder="새 비밀번호 확인" autoComplete="new-password" className={field} />
              <button disabled={busy} className="squish mt-1 rounded-2xl bg-accent py-2.5 font-cute text-white disabled:opacity-50">
                {busy ? '바꾸는 중…' : '비밀번호 바꾸기'}
              </button>
            </form>
          ) : (
            <button onClick={() => setChanging(true)} className="squish w-full rounded-2xl bg-white py-2.5 text-sm">
              비밀번호 바꾸기
            </button>
          )}
        </>
      )}
      {msg && <p className="mt-2 text-sm text-ink-soft">{msg}</p>}
    </section>
  )
}
