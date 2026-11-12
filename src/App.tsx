import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import { sweepDeletedImages, uploadImage } from './images'
import Entry from './screens/Entry'
import Plaza from './screens/Plaza'
import Chat from './screens/Chat'
import Me from './screens/Me'
import BottomNav from './components/BottomNav'
import Sky from './components/Sky'
import { isOnline, type Message, type Profile, type Tab } from './types'

type Phase = 'loading' | 'entry' | 'main' | 'error' | 'kicked'

const HEARTBEAT_MS = 60_000

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [myId, setMyId] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('plaza')
  const [unread, setUnread] = useState(0)
  const [draft, setDraft] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const tabRef = useRef(tab)
  tabRef.current = tab

  // ---------- 첫 진입: 저장된 세션으로 자동 입장 ----------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const session = data.session
        if (!session) return !cancelled && setPhase('entry')
        const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
        if (error) throw error
        if (cancelled) return
        if (profile?.approved) {
          setMyId(profile.id)
          setProfiles([profile as Profile])
          setPhase('main')
        } else setPhase(profile?.banned ? 'kicked' : 'entry')
      } catch (err) {
        console.error(err)
        if (!cancelled) setPhase('error')
      }
    })()
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setMyId(null)
        setPhase('entry')
      }
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  // ---------- 데이터 불러오기 ----------
  const loadProfiles = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at')
    if (!error && data) setProfiles(data as Profile[])
  }, [])

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase.from('messages').select('*').order('id', { ascending: false }).limit(200)
    if (!error && data) setMessages((data as Message[]).reverse())
    setMessagesLoading(false)
  }, [])

  const touch = useCallback(async () => {
    if (!myId) return
    const last_seen = new Date().toISOString()
    setProfiles((ps) => ps.map((p) => (p.id === myId ? { ...p, last_seen } : p)))
    await supabase.from('profiles').update({ last_seen }).eq('id', myId)
  }, [myId])

  // ---------- 실시간 구독 + 접속 표시 ----------
  useEffect(() => {
    if (phase !== 'main' || !myId) return
    loadProfiles()
    loadMessages()
    touch()
    sweepDeletedImages()

    const channel = supabase
      .channel('plaza')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as { id?: string }
          setProfiles((ps) => ps.filter((p) => p.id !== old.id))
          return
        }
        const row = payload.new as Profile
        setProfiles((ps) => (ps.some((p) => p.id === row.id) ? ps.map((p) => (p.id === row.id ? row : p)) : [...ps, row]))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const old = payload.old as { id?: number }
        setMessages((ms) => ms.filter((x) => x.id !== old.id))
        sweepDeletedImages()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new as Message
        setMessages((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m].slice(-200)))
        if (m.user_id !== myId && tabRef.current !== 'chat') setUnread((u) => u + 1)
      })
      .subscribe((status) => {
        // 연결이 끊겼다 다시 붙으면 놓친 데이터 다시 불러오기
        if (status === 'SUBSCRIBED') {
          loadProfiles()
          loadMessages()
        }
      })

    const beat = setInterval(() => {
      if (document.visibilityState === 'visible') touch()
    }, HEARTBEAT_MS)
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now())
        touch()
        loadProfiles()
        loadMessages()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(beat)
      clearInterval(tick)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [phase, myId, loadProfiles, loadMessages, touch])

  // ---------- 동작 ----------
  const me = useMemo(() => profiles.find((p) => p.id === myId) ?? null, [profiles, myId])
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles])
  const members = useMemo(() => profiles.filter((p) => p.approved), [profiles])
  const onlineCount = members.filter((p) => isOnline(p, now)).length

  // 마스터가 나를 내보내면 바로 안내 화면으로
  useEffect(() => {
    if (phase === 'main' && me && !me.approved && me.banned) setPhase('kicked')
  }, [phase, me])

  async function kick(p: Profile) {
    const { error } = await supabase.rpc('kick_member', { p_user: p.id })
    if (error) {
      console.error(error)
      return false
    }
    setProfiles((ps) => ps.map((x) => (x.id === p.id ? { ...x, approved: false, banned: true } : x)))
    return true
  }

  async function deleteMessage(id: number) {
    const target = messages.find((x) => x.id === id)
    const { error } = await supabase.from('messages').delete().eq('id', id)
    if (error) {
      console.error(error)
      return false
    }
    setMessages((ms) => ms.filter((x) => x.id !== id))
    if (target?.image_path) sweepDeletedImages()
    return true
  }

  async function clearAll() {
    const { data, error } = await supabase.rpc('clear_messages')
    if (error) {
      console.error(error)
      return false
    }
    setMessages([])
    if (((data as (string | null)[]) ?? []).some(Boolean)) sweepDeletedImages()
    return true
  }

  async function claimAdmin(code: string) {
    const { data, error } = await supabase.rpc('claim_admin', { p_code: code })
    if (error || !data) return false
    setProfiles((ps) => ps.map((x) => (x.id === myId ? { ...x, is_admin: true } : x)))
    return true
  }

  async function leave() {
    await supabase.rpc('leave_community')
    await supabase.auth.signOut()
    setMyId(null)
    setProfiles([])
    setMessages([])
    setDraft('')
    setPhase('entry')
  }

  async function changeStatus(status: string) {
    if (!myId) return
    const prev = me?.status
    setProfiles((ps) => ps.map((p) => (p.id === myId ? { ...p, status } : p)))
    const { error } = await supabase.from('profiles').update({ status, last_seen: new Date().toISOString() }).eq('id', myId)
    if (error && prev) setProfiles((ps) => ps.map((p) => (p.id === myId ? { ...p, status: prev } : p)))
  }

  async function saveProfile(v: { nickname: string; emoji: string; color: string }) {
    if (!myId) return false
    const { data, error } = await supabase.from('profiles').update(v).eq('id', myId).select().single()
    if (error || !data) return false
    setProfiles((ps) => ps.map((p) => (p.id === myId ? (data as Profile) : p)))
    return true
  }

  async function send(text: string, file: File | null) {
    let image_path: string | null = null
    if (file && myId) {
      try {
        image_path = await uploadImage(myId, file)
      } catch (err) {
        console.error(err)
        return false
      }
    }
    const { data, error } = await supabase.from('messages').insert({ content: text, image_path }).select().single()
    if (error || !data) {
      console.error(error)
      // 메시지 저장에 실패하면 먼저 올라간 사진 파일도 지움
      if (image_path) supabase.storage.from('chat-images').remove([image_path])
      return false
    }
    const m = data as Message
    setMessages((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m].slice(-200)))
    // 200개를 넘어 자동 정리된 옛 메시지의 사진도 지움
    if (messages.length >= 199) sweepDeletedImages()
    return true
  }

  function changeTab(t: Tab) {
    setTab(t)
    if (t === 'chat') setUnread(0)
  }

  // ---------- 화면 ----------
  if (phase === 'loading' || (phase === 'main' && !me)) {
    return (
      <div className="relative grid h-dvh place-items-center">
        <Sky />
        <div className="relative text-center">
          <div className="bob text-5xl">🫧</div>
          <p className="mt-3 font-cute text-lg text-ink-soft">광장으로 가는 중…</p>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="relative grid h-dvh place-items-center px-6">
        <Sky />
        <div className="relative text-center">
          <div className="text-5xl">🌧️</div>
          <p className="mt-3 font-cute text-lg">연결에 문제가 생겼어요</p>
          <button onClick={() => location.reload()} className="squish mt-4 rounded-2xl bg-accent px-6 py-3 font-cute text-white">
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'kicked') {
    return (
      <div className="relative grid h-dvh place-items-center px-6">
        <Sky />
        <div className="relative text-center">
          <div className="text-5xl">🚪</div>
          <p className="mt-3 font-cute text-xl">채팅방에서 내보내졌어요</p>
          <p className="mt-1 text-sm text-ink-soft">다시 들어오려면 방 주인에게 물어봐 주세요.</p>
        </div>
      </div>
    )
  }

  if (phase === 'entry' || !me) {
    return (
      <Entry
        onJoined={(p) => {
          setMyId(p.id)
          setProfiles([p])
          setTab('plaza')
          setPhase('main')
        }}
      />
    )
  }

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-white shadow-[0_0_40px_rgba(120,110,170,0.15)]">
      <main className="min-h-0 flex-1">
        {tab === 'plaza' && (
          <Plaza
            me={me}
            profiles={members}
            now={now}
            onChangeStatus={changeStatus}
            onGreet={(p) => {
              setDraft(`@${p.nickname} 안녕! `)
              changeTab('chat')
            }}
            onKick={kick}
          />
        )}
        {tab === 'chat' && (
          <Chat
            me={me}
            profileMap={profileMap}
            messages={messages}
            onlineCount={onlineCount}
            loading={messagesLoading}
            draft={draft}
            onDraftChange={setDraft}
            onSend={send}
            onDelete={deleteMessage}
            onClearAll={clearAll}
          />
        )}
        {tab === 'me' && <Me me={me} onSaveProfile={saveProfile} onChangeStatus={changeStatus} onClaimAdmin={claimAdmin} onLeave={leave} />}
      </main>
      <BottomNav tab={tab} unread={unread} onChange={changeTab} />
    </div>
  )
}
