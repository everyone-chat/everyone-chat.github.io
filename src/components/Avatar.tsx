type Props = {
  emoji: string
  color: string
  size?: number
  sleeping?: boolean
}

// 큰 머리 + 작은 몸통 비율의 2D 캐릭터 (본디 감성의 둥근 실루엣)
export default function Avatar({ emoji, color, size = 72, sleeping }: Props) {
  const head = size
  const body = size * 0.62
  return (
    <div className="relative flex flex-col items-center" style={{ width: head, height: head + body * 0.62 }}>
      {/* 몸통 */}
      <div
        className="absolute rounded-[45%] shadow-[inset_0_-6px_0_rgba(0,0,0,0.06)]"
        style={{
          width: body,
          height: body * 0.85,
          top: head * 0.78,
          background: color,
          border: '3px solid white',
        }}
      />
      {/* 발 */}
      <div className="absolute flex gap-[18%]" style={{ top: head * 0.78 + body * 0.72, width: body * 0.7, justifyContent: 'center' }}>
        <span className="block rounded-full bg-white/90" style={{ width: body * 0.24, height: body * 0.14 }} />
        <span className="block rounded-full bg-white/90" style={{ width: body * 0.24, height: body * 0.14 }} />
      </div>
      {/* 머리 */}
      <div
        className="relative grid place-items-center rounded-full border-[3px] border-white shadow-[0_6px_14px_rgba(120,110,170,0.18),inset_0_-8px_0_rgba(0,0,0,0.05)]"
        style={{ width: head, height: head, background: color }}
      >
        <span style={{ fontSize: head * 0.58, lineHeight: 1, filter: sleeping ? 'saturate(.7)' : undefined }}>{emoji}</span>
        {/* 볼터치 */}
        <span className="absolute rounded-full bg-[#FF9DB8]/45" style={{ width: head * 0.16, height: head * 0.1, left: head * 0.12, top: head * 0.6 }} />
        <span className="absolute rounded-full bg-[#FF9DB8]/45" style={{ width: head * 0.16, height: head * 0.1, right: head * 0.12, top: head * 0.6 }} />
      </div>
    </div>
  )
}
