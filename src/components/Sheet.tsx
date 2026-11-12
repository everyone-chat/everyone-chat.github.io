import type { ReactNode } from 'react'

// 아래에서 올라오는 둥근 시트
export default function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button aria-label="닫기" className="fade-in absolute inset-0 bg-[#4A4560]/25" onClick={onClose} />
      <div className="sheet-up pb-safe relative w-full max-w-md rounded-t-[32px] bg-cream px-5 pt-3 shadow-[0_-8px_30px_rgba(74,69,96,0.15)]">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#E4DDEA]" />
        {children}
      </div>
    </div>
  )
}
