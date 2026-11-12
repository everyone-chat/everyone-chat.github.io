import { SECRET_MINUTES, SIZE_OPTIONS, type Settings } from '../settings'

type Props = {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  onSecretNow: () => void
}

export default function ViewSettings({ settings, update, onSecretNow }: Props) {
  return (
    <section className="mt-7 rounded-[28px] border-2 border-white bg-white/70 px-5 py-6">
      <h2 className="mb-2 font-cute text-lg">화면 설정</h2>
      <p className="mb-4 text-xs leading-relaxed text-ink-soft">이 기기에만 저장돼요.</p>

      <span className="mb-1.5 block text-sm text-ink-soft">PC 화면 크기</span>
      <div className="mb-1 grid grid-cols-4 gap-1.5">
        {SIZE_OPTIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => update({ size: o.id })}
            className={`squish rounded-2xl py-2 text-sm ${settings.size === o.id ? 'bg-white shadow-[0_0_0_3px_var(--color-accent)]' : 'bg-white/60'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mb-4 text-xs text-ink-soft">{SIZE_OPTIONS.find((o) => o.id === settings.size)?.desc} · 휴대폰에서는 항상 전체 화면이에요.</p>

      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="block text-sm">시크릿 모드</span>
          <span className="text-xs text-ink-soft">아무 조작이 없으면 업무용 표 화면으로 바뀌어요</span>
        </div>
        <button
          role="switch"
          aria-checked={settings.secretOn}
          onClick={() => update({ secretOn: !settings.secretOn })}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${settings.secretOn ? 'bg-accent' : 'bg-[#D9D3E3]'}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${settings.secretOn ? 'left-6' : 'left-1'}`} />
        </button>
      </div>
      <span className="mb-1.5 block text-sm text-ink-soft">전환 시간</span>
      <div className="mb-3 grid grid-cols-5 gap-1.5">
        {SECRET_MINUTES.map((m) => (
          <button
            key={m}
            disabled={!settings.secretOn}
            onClick={() => update({ secretMinutes: m })}
            className={`squish rounded-2xl py-2 text-sm disabled:opacity-40 ${settings.secretMinutes === m ? 'bg-white shadow-[0_0_0_3px_var(--color-accent)]' : 'bg-white/60'}`}
          >
            {m}분
          </button>
        ))}
      </div>
      <button onClick={onSecretNow} className="squish w-full rounded-2xl bg-ink py-2.5 text-sm text-white">
        🙈 지금 시크릿 모드로
      </button>
      <p className="mt-2 text-center text-xs text-ink-soft">돌아올 때는 화면을 더블클릭하거나 Esc 키를 누르세요.</p>
    </section>
  )
}
