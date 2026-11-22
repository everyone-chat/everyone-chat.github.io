import { useEffect, useState } from 'react'
import { DEFAULT_PREFS, deviceSubscribed, disablePush, enablePush, isIOS, isStandalone, loadPrefs, pushSupported, savePrefs, testPush } from '../push'

const field = 'w-full rounded-2xl border-2 border-white bg-white px-4 py-2.5 outline-none focus:border-accent'
const PRESETS = [
  { title: '(광고) 기다리던 시리즈 공개예정 D-1', body: '지금 미리 알림 받고 바로 시청하세요' },
  { title: '알림', body: '새 소식이 {n}건 있어요' },
  { title: '배송 알림', body: '주문하신 상품 {n}건의 배송 상태가 바뀌었어요' },
  { title: '새 메시지', body: '확인하지 않은 메시지가 {n}건 있어요' },
  { title: '업무 알림', body: '결재 요청 {n}건이 도착했어요' },
]

/** 휴대폰 알림: 새 메시지가 오면 휴대폰 위쪽 알림으로, 내가 정한 문구만 */
export default function PushPanel() {
  const [title, setTitle] = useState(DEFAULT_PREFS.title)
  const [body, setBody] = useState(DEFAULT_PREFS.body)
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const iosNeedsHome = isIOS() && !isStandalone()

  useEffect(() => {
    loadPrefs().then((p) => {
      setTitle(p.title)
      setBody(p.body)
    })
    deviceSubscribed().then(setOn)
  }, [])

  async function toggle() {
    setBusy(true)
    setMsg('')
    if (on) {
      await disablePush()
      setOn(false)
      setMsg('이 기기에서 알림을 껐어요.')
    } else {
      const err = await enablePush({ title, body })
      if (err) setMsg(err)
      else {
        setOn(true)
        setMsg('이 기기에서 알림을 켰어요.')
      }
    }
    setBusy(false)
  }

  return (
    <section className="mt-7 rounded-[28px] border-2 border-white bg-white/70 px-5 py-6">
      <h2 className="mb-2 font-cute text-lg">📱 휴대폰 알림</h2>
      <p className="mb-4 text-xs leading-relaxed text-ink-soft">
        새 메시지가 오면 휴대폰 위쪽에 <b>내가 정한 문구</b>로만 알림이 떠요. 보낸 사람이나 내용은 나오지 않고, 앱을 보고 있을 땐 오지 않아요.
      </p>

      {iosNeedsHome && (
        <div className="mb-4 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-xs leading-relaxed">
          아이폰은 먼저 <b>사파리 공유 버튼(□↑) → 홈 화면에 추가</b>를 한 뒤, 홈 화면에 생긴 <b>"알림"</b> 아이콘으로 열어서 여기서 알림을 켜 주세요.
        </div>
      )}
      {!iosNeedsHome && !pushSupported() && <p className="mb-4 text-xs text-accent-deep">이 브라우저는 알림을 지원하지 않아요.</p>}

      <span className="mb-1.5 block text-sm text-ink-soft">빠른 선택</span>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.title}
            onClick={() => {
              setTitle(p.title)
              setBody(p.body)
            }}
            className="squish rounded-full bg-white/80 px-3 py-1.5 text-xs"
          >
            {p.title.length > 14 ? p.title.slice(0, 14) + '…' : p.title}
          </button>
        ))}
      </div>
      <label className="mb-1 block text-sm text-ink-soft">제목</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} className={field} />
      <label className="mb-1 mt-3 block text-sm text-ink-soft">내용 · {'{n}'}을 넣으면 그 자리에 안 읽은 개수 (안 넣어도 돼요)</label>
      <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={100} className={field} />

      {/* 미리보기 */}
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#f2f2f2] px-3 py-2.5 text-[#1f1f1f]">
        <img src="/push-icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex justify-between text-[13px] font-bold">
            <span className="truncate">{title || '알림'}</span>
            <span className="shrink-0 pl-2 text-[11px] font-normal text-[#777]">지금</span>
          </div>
          <div className="truncate text-[13px] text-[#444]">{(body || '').replaceAll('{n}', '2')}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={toggle}
          disabled={busy || (iosNeedsHome && !on)}
          className={`squish rounded-2xl py-2.5 font-cute ${on ? 'bg-white text-ink' : 'bg-accent text-white'} disabled:opacity-40`}
        >
          {busy ? '잠시만요…' : on ? '이 기기 알림 끄기' : '이 기기 알림 켜기'}
        </button>
        <button
          onClick={async () => {
            setBusy(true)
            const ok = await savePrefs({ enabled: true, title: title.trim() || '알림', body: body.trim() || DEFAULT_PREFS.body })
            setMsg(ok ? '문구를 저장했어요.' : '저장에 실패했어요.')
            setBusy(false)
          }}
          disabled={busy}
          className="squish rounded-2xl bg-white py-2.5 text-sm disabled:opacity-40"
        >
          문구 저장
        </button>
      </div>
      {on && (
        <button
          onClick={async () => {
            setBusy(true)
            await savePrefs({ enabled: true, title: title.trim() || '알림', body: body.trim() || DEFAULT_PREFS.body })
            setMsg(await testPush())
            setBusy(false)
          }}
          disabled={busy}
          className="squish mt-2 w-full rounded-2xl bg-white/70 py-2.5 text-sm disabled:opacity-40"
        >
          시험 알림 보내기
        </button>
      )}
      {msg && <p className="mt-2 text-xs leading-relaxed text-ink-soft">{msg}</p>}
      <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
        알림 위쪽에 보이는 앱 이름과 아이콘은 안드로이드는 "Chrome"(또는 홈 화면에 추가했다면 "알림"), 아이폰은 "알림"으로 표시돼요.
      </p>
    </section>
  )
}
