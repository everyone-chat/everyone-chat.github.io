import { Fragment, useState } from 'react'
import Sheet from './Sheet'

const URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi
const TRAIL = /[.,!?)\]}'"…~]+$/

/** 글 속 주소를 누를 수 있는 링크로 (누르면 바로 열지 않고 열기 방법 선택) */
export function LinkText({ text, onLink }: { text: string; onLink: (url: string) => void }) {
  const parts = text.split(URL_RE)
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{p}</Fragment>
        const tail = p.match(TRAIL)?.[0] ?? ''
        const raw = tail ? p.slice(0, -tail.length) : p
        const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
        return (
          <Fragment key={i}>
            <a
              href={url}
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onLink(url)
              }}
              className="break-all text-[#3B6FD8] underline underline-offset-2"
            >
              {raw}
            </a>
            {tail}
          </Fragment>
        )
      })}
    </>
  )
}

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
const isMac = () => /Mac/i.test(navigator.platform || navigator.userAgent)

/**
 * 웹페이지는 보안상 브라우저의 시크릿 창을 직접 열 수 없음
 * → 링크를 복사해 두고 시크릿 창 여는 단축키를 안내 (기록 남김 없이 열기)
 */
export function LinkSheet({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const key = isMac() ? '⌘ + Shift + N' : 'Ctrl + Shift + N'

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div className="flex flex-col gap-3 pb-5">
        <h2 className="font-cute text-xl">링크 열기</h2>
        <p className="break-all rounded-2xl bg-white px-4 py-2.5 text-sm text-ink-soft">{url}</p>

        <button onClick={copy} className="squish rounded-2xl bg-ink py-3 font-cute text-white">
          🕶 시크릿 창으로 열기 (링크 복사)
        </button>
        {copied && (
          <div className="pop rounded-2xl bg-[#FFF0F5] px-4 py-3 text-sm leading-relaxed">
            링크를 복사했어요.
            {isMobile() ? (
              <>
                <br />
                브라우저 메뉴에서 <b>새 시크릿 탭</b>(사파리는 <b>개인정보 보호 탭</b>)을 열고, 주소창을 길게 눌러 <b>붙여넣고 이동</b>하세요.
              </>
            ) : (
              <>
                <br />
                <b>{key}</b> 로 시크릿 창을 열고 <b>{isMac() ? '⌘' : 'Ctrl'} + V</b>, <b>Enter</b> 를 누르세요.
              </>
            )}
          </div>
        )}

        <button
          onClick={() => {
            window.open(url, '_blank', 'noopener,noreferrer')
            onClose()
          }}
          className="squish rounded-2xl bg-white py-3 text-sm"
        >
          그냥 새 탭에서 열기
        </button>
        <p className="text-center text-xs text-ink-soft">웹사이트는 보안상 시크릿 창을 직접 열 수 없어서, 링크를 복사해 시크릿 창에 붙여넣는 방식이에요.</p>
      </div>
    </Sheet>
  )
}
