// 파스텔 하늘 + 흘러가는 구름 배경
const CLOUDS = [
  { top: '8%', w: 110, dur: 70, delay: -10, op: 0.9 },
  { top: '18%', w: 70, dur: 55, delay: -35, op: 0.7 },
  { top: '30%', w: 140, dur: 90, delay: -60, op: 0.6 },
  { top: '4%', w: 60, dur: 48, delay: -20, op: 0.8 },
]

export default function Sky() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-b from-[#BFE2FF] via-[#E2F1FF] to-[#FFEFF5]" />
      {CLOUDS.map((c, i) => (
        <div
          key={i}
          className="cloud absolute"
          style={{ top: c.top, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s`, opacity: c.op }}
        >
          <div className="relative" style={{ width: c.w, height: c.w * 0.4 }}>
            <span className="absolute bottom-0 left-0 h-[60%] w-full rounded-full bg-white" />
            <span className="absolute bottom-[20%] left-[18%] h-[80%] w-[42%] rounded-full bg-white" />
            <span className="absolute bottom-[25%] left-[45%] h-[70%] w-[34%] rounded-full bg-white" />
          </div>
        </div>
      ))}
    </div>
  )
}
