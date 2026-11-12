import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import { sweepDeletedImages, uploadImage } from './images'
import Entry from './screens/Entry'
import Plaza from './screens/Plaza'
import Chat from './screens/Chat'
import ChatList from './screens/ChatList'
import Me from './screens/Me'
import BottomNav from './components/BottomNav'
import Sky from './components/Sky'
import { peerOf, roomOf, type Friendship, type Message, type Profile, type Tab } from './types'

type Phase = 'loading' | 'entry' | 'main' | 'error' | 'kicked'

const HEARTBEAT_MS = 60_000
const PER_ROOM = 200

function errText(msg: string, map: Record<string, string>, fallback: string) {
  for (const k of Object.keys(map)) if (msg.includes(k)) return map[k]
  return fallback
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [myId, setMyId] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [friendIds, setFriendIds] = useState<string[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('plaza')
  const [activePeer, setActivePeer] = useState<string | null>(null)
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [draft, setDraft] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const viewRef = useRef({ tab, activePeer })
  viewRef.current = { tab, activePeer }

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

  // ---------- 데이터 불러오기 (서버가 친구 것만 돌려줌) ----------
  const loadProfiles = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at')
    if (!error && data) setProfiles(data as Profile[])
  }, [])

  const loadFriends = useCallback(async () => {
    if (!myId) return
    const { data, error } = await supabase.from('friendships').select('*')
    if (!error && data) setFriendIds((data as Friendship[]).map((f) => (f.user_a === myId ? f.user_b : f.user_a)))
  }, [myId])

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase.from('messages').select('*').order('id', { ascending: false }).limit(2000)
    if (!error && data) setMessages((data as Message[]).reverse())
    setMessagesLoading(false)
  }, [])

  const loadAll = useCallback(() => {
    loadProfiles()
    loadFriends()
    loadMessages()
  }, [loadProfiles, loadFriends, loadMessages])

  const touch = useCallback(async () => {
    if (!myId) return
    const last_seen = new Date().toISOString()
    setProfiles((ps) => ps.map((p) => (p.id === myId ? { ...p, last_seen } : p)))
    await supabase.from('profiles').update({ last_seen }).eq('id', myId)
  }, [myId])

  // ---------- 실시간 구독 + 접속 표시 ----------
  useEffect(() => {
    if (phase !== 'main' || !myId) return
    loadAll()
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
      // 친구가 생기거나 끊기면 보이는 사람과 대화를 다시 불러옴
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => loadAll())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const old = payload.old as { id?: number }
        setMessages((ms) => ms.filter((x) => x.id !== old.id))
        sweepDeletedImages()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new as Message
        setMessages((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m]))
        const peer = peerOf(m, myId)
        const v = viewRef.current
        if (m.user_id !== myId && !(v.tab === 'chat' && v.activePeer === peer)) {
          setUnread((u) => ({ ...u, [peer]: (u[peer] ?? 0) + 1 }))
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') loadAll()
      })

    const beat = setInterval(() => {
      if (document.visibilityState === 'visible') touch()
    }, HEARTBEAT_MS)
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now())
        touch()
        loadAll()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(beat)
      clearInterval(tick)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [phase, myId, loadAll, touch])

  // ---------- 파생 데이터 ----------
  const me = useMemo(() => profiles.find((p) => p.id === myId) ?? null, [profiles, myId])
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles])
  const friends = useMemo(
    () => profiles.filter((p) => p.approved && p.id !== myId && friendIds.includes(p.id)),
    [profiles, friendIds, myId],
  )
  const allMembers = useMemo(() => profiles.filter((p) => p.approved), [profiles])
  const bannedMembers = useMemo(() => profiles.filter((p) => p.banned), [profiles])
  const lastByPeer = useMemo(() => {
    const map = new Map<string, Message>()
    if (myId) for (const m of messages) map.set(peerOf(m, myId), m)
    return map
  }, [messages, myId])
  const roomMessages = useMemo(
    () => (myId && activePeer ? messages.filter((m) => peerOf(m, myId) === activePeer).slice(-PER_ROOM) : []),
    [messages, myId, activePeer],
  )
  const totalUnread = friends.reduce((n, f) => n + (unread[f.id] ?? 0), 0)
  const peerProfile = activePeer ? friends.find((f) => f.id === activePeer) ?? null : null

  // 마스터가 나를 내보내면 바로 안내 화면으로
  useEffect(() => {
    if (phase === 'main' && me && !me.approved && me.banned) setPhase('kicked')
  }, [phase, me])

  // 보고 있던 친구와 친구가 끊기면 목록으로
  useEffect(() => {
    if (activePeer && !peerProfile && profiles.length > 1) setActivePeer(null)
  }, [activePeer, peerProfile, friendIds, profiles.length])

  // ---------- 동작 ----------
  function openChat(peerId: string) {
    setActivePeer(peerId)
    setTab('chat')
    setUnread((u) => ({ ...u, [peerId]: 0 }))
  }

  async function addFriend(code: string) {
    const { error } = await supabase.rpc('add_friend', { p_code: code })
    if (error) return errText(error.message, { not_found: '그 코드를 가진 친구가 없어요.', self: '내 코드예요.' }, '추가에 실패했어요.')
    loadAll()
    return null
  }

  async function removeFriend(p: Profile) {
    const { error } = await supabase.rpc('remove_friend', { p_user: p.id })
    if (error) return false
    setFriendIds((ids) => ids.filter((id) => id !== p.id))
    setMessages((ms) => ms.filter((m) => !myId || peerOf(m, myId) !== p.id))
    if (activePeer === p.id) setActivePeer(null)
    sweepDeletedImages()
    return true
  }

  async function setFriendCode(code: string) {
    const { data, error } = await supabase.rpc('set_friend_code', { p_code: code })
    if (error)
      return errText(error.message, { taken: '이미 다른 사람이 쓰는 코드예요.', invalid_code: '한글·영문·숫자·-·_ 2~16자로 정해 주세요.' }, '바꾸기에 실패했어요.')
    setProfiles((ps) => ps.map((p) => (p.id === myId ? { ...p, friend_code: data as string } : p)))
    return null
  }

  async function kick(p: Profile) {
    const { error } = await supabase.rpc('kick_member', { p_user: p.id })
    if (error) {
      console.error(error)
      return false
    }
    setProfiles((ps) => ps.map((x) => (x.id === p.id ? { ...x, approved: false, banned: true } : x)))
    return true
  }

  async function setInviteCode(code: string) {
    const { error } = await supabase.rpc('set_invite_code', { p_code: code })
    if (error)
      return errText(error.message, { invalid_code: '4~30자로 정해 주세요.', same_as_admin: '마스터 코드와 같으면 안 돼요.' }, '바꾸기에 실패했어요.')
    return null
  }

  async function unban(p: Profile) {
    const { error } = await supabase.rpc('unban_member', { p_user: p.id })
    if (error) {
      console.error(error)
      return false
    }
    setProfiles((ps) => ps.map((x) => (x.id === p.id ? { ...x, approved: true, banned: false } : x)))
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

  async function clearConversation() {
    if (!activePeer || !myId) return false
    const { error } = await supabase.rpc('clear_conversation', { p_peer: activePeer })
    if (error) {
      console.error(error)
      return false
    }
    setMessages((ms) => ms.filter((m) => peerOf(m, myId) !== activePeer))
    sweepDeletedImages()
    return true
  }

  async function claimAdmin(code: string) {
    const { data, error } = await supabase.rpc('claim_admin', { p_code: code })
    if (error || !data) return false
    setProfiles((ps) => ps.map((x) => (x.id === myId ? { ...x, is_admin: true } : x)))
    loadProfiles()
    return true
  }

  async function leave() {
    await supabase.rpc('leave_community')
    await supabase.auth.signOut()
    setMyId(null)
    setProfiles([])
    setFriendIds([])
    setMessages([])
    setDraft('')
    setActivePeer(null)
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
    if (!myId || !activePeer) return false
    let image_path: string | null = null
    if (file) {
      try {
        image_path = await uploadImage(myId, file)
      } catch (err) {
        console.error(err)
        return false
      }
    }
    const { data, error } = await supabase
      .from('messages')
      .insert({ content: text, image_path, ...roomOf(myId, activePeer) })
      .select()
      .single()
    if (error || !data) {
      console.error(error)
      // 메시지 저장에 실패하면 먼저 올라간 사진 파일도 지움
      if (image_path) supabase.storage.from('chat-images').remove([image_path])
      return false
    }
    const m = data as Message
    setMessages((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m]))
    // 200개를 넘어 자동 정리된 옛 메시지의 사진도 지움
    if (roomMessages.length >= PER_ROOM - 1) {
      sweepDeletedImages()
      loadMessages()
    }
    return true
  }

  function changeTab(t: Tab) {
    setTab(t)
    if (t === 'chat' && activePeer) setUnread((u) => ({ ...u, [activePeer]: 0 }))
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
          <p className="mt-3 font-cute text-xl">내보내졌어요</p>
          <p className="mt-1 text-sm text-ink-soft">다시 들어오려면 방 주인에게 물어봐 주세요.</p>
          <button onClick={() => location.reload()} className="squish mt-4 rounded-2xl bg-white px-5 py-2.5 font-cute text-ink">
            다시 들어갈 수 있는지 확인
          </button>
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
            profiles={[me, ...friends]}
            now={now}
            onChangeStatus={changeStatus}
            onGreet={(p) => openChat(p.id)}
            onKick={kick}
          />
        )}
        {tab === 'chat' &&
          (peerProfile ? (
            <Chat
              key={peerProfile.id}
              me={me}
              peer={peerProfile}
              now={now}
              onBack={() => setActivePeer(null)}
              profileMap={profileMap}
              messages={roomMessages}
              loading={messagesLoading}
              draft={draft}
              onDraftChange={setDraft}
              onSend={send}
              onDelete={deleteMessage}
              onClearAll={clearConversation}
            />
          ) : (
            <ChatList friends={friends} lastByPeer={lastByPeer} unread={unread} now={now} onOpen={openChat} onAddFriend={() => setTab('me')} />
          ))}
        {tab === 'me' && (
          <Me
            me={me}
            onSaveProfile={saveProfile}
            onChangeStatus={changeStatus}
            onClaimAdmin={claimAdmin}
            onLeave={leave}
            friends={friends}
            allMembers={allMembers}
            onSetCode={setFriendCode}
            onAddFriend={addFriend}
            onRemoveFriend={removeFriend}
            onKick={kick}
            banned={bannedMembers}
            onUnban={unban}
            onSetInvite={setInviteCode}
          />
        )}
      </main>
      <BottomNav tab={tab} unread={totalUnread} onChange={changeTab} />
    </div>
  )
}
