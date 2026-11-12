import type { Tab } from '../types'

const ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: 'plaza', label: '광장', icon: '🏝️' },
  { id: 'chat', label: '채팅', icon: '💬' },
  { id: 'me', label: '나', icon: '🧸' },
]

export default function BottomNav({ tab, unread, onChange }: { tab: Tab; unread: number; onChange: (t: Tab) => void }) {
  return (
    <nav className="pb-safe border-t border-white bg-white/85 px-3 pt-2 backdrop-blur">
      <div className="mx-auto flex max-w-md justify-between">
        {ITEMS.map((it) => {
          const active = it.id === tab
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className={`squish relative flex w-[4.5rem] flex-col items-center rounded-2xl py-1.5 ${active ? 'bg-[#FFE4EE]' : ''}`}
            >
              <span className={`text-2xl transition-transform ${active ? 'scale-110' : 'opacity-70 grayscale-[40%]'}`}>{it.icon}</span>
              <span className={`font-cute text-xs ${active ? 'text-accent-deep' : 'text-ink-soft'}`}>{it.label}</span>
              {it.id === 'chat' && unread > 0 && (
                <span className="pop absolute right-3 top-0 min-w-5 rounded-full bg-accent-deep px-1.5 text-[11px] leading-5 text-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
