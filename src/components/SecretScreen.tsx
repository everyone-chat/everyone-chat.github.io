import { useEffect } from 'react'

// 시크릿 모드: 평범한 업무용 표처럼 보이는 화면. 더블클릭이나 Esc로 돌아옴
const ROWS = [
  ['1', '주간 업무 보고 정리', '진행 중', '11/14', '70%'],
  ['2', '거래처 자료 취합', '완료', '11/12', '100%'],
  ['3', '월간 지표 업데이트', '대기', '11/18', '0%'],
  ['4', '회의록 공유', '완료', '11/11', '100%'],
  ['5', '견적서 검토', '진행 중', '11/15', '40%'],
  ['6', '분기 계획 초안', '대기', '11/21', '10%'],
  ['7', '프로젝트 일정 점검', '진행 중', '11/13', '55%'],
  ['8', '자료실 정리', '대기', '11/22', '0%'],
]
const COLS = ['No.', '업무', '상태', '마감', '진행률']
const TITLE = '업무 진행 현황 - 스프레드시트'

export default function SecretScreen({ onExit }: { onExit: () => void }) {
  useEffect(() => {
    const prev = document.title
    document.title = TITLE
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    const prevIcon = icon?.href
    if (icon) icon.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' rx='2' fill='%231e8e3e'/><path d='M4 4h8v8H4z' fill='white'/><path d='M4 7h8M4 10h8M8 4v8' stroke='%231e8e3e'/></svg>"
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onExit()
    window.addEventListener('keydown', onKey)
    return () => {
      document.title = prev
      if (icon && prevIcon) icon.href = prevIcon
      window.removeEventListener('keydown', onKey)
    }
  }, [onExit])

  return (
    <div className="fixed inset-0 z-[100] overflow-auto bg-white font-sans text-[13px] text-[#202124]" onDoubleClick={onExit} style={{ fontFamily: 'Arial, "Malgun Gothic", sans-serif' }}>
      <div className="flex items-center gap-3 border-b border-[#dadce0] px-4 py-2">
        <div className="grid h-7 w-7 place-items-center rounded bg-[#1e8e3e] text-xs font-bold text-white">▦</div>
        <div>
          <div className="text-[15px]">업무 진행 현황</div>
          <div className="text-[11px] text-[#5f6368]">파일 &nbsp; 수정 &nbsp; 보기 &nbsp; 삽입 &nbsp; 서식 &nbsp; 데이터</div>
        </div>
      </div>
      <div className="flex items-center gap-2 border-b border-[#dadce0] bg-[#f8f9fa] px-4 py-1 text-[#5f6368]">
        <span className="rounded bg-white px-2 py-0.5 shadow-sm">fx</span>
        <span>=AVERAGE(E2:E9)</span>
      </div>
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="w-10 border border-[#e0e0e0] bg-[#f8f9fa]" />
            {['A', 'B', 'C', 'D', 'E', 'F'].map((c) => (
              <th key={c} className="w-28 border border-[#e0e0e0] bg-[#f8f9fa] py-0.5 font-normal text-[#5f6368]">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[COLS, ...ROWS, ...Array.from({ length: 22 }, () => [])].map((r, i) => (
            <tr key={i}>
              <td className="border border-[#e0e0e0] bg-[#f8f9fa] text-center text-[#5f6368]">{i + 1}</td>
              {Array.from({ length: 6 }, (_, j) => (
                <td key={j} className={`h-6 border border-[#e0e0e0] px-1.5 ${i === 0 ? 'bg-[#e8f0fe] font-bold' : ''} ${j === 1 ? 'min-w-48' : ''}`}>
                  {r[j] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
