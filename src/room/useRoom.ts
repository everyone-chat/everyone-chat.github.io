import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { DEFAULT_ROOM, sanitizeRoom, type RoomData } from './catalog'

export type SaveStatus = 'loading' | 'idle' | 'saving' | 'saved' | 'error'

const SAVE_DELAY = 900

/** 내 방(=광장) 불러오기 + 바뀌면 자동 저장 */
export function useRoom(userId: string) {
  const [data, setData] = useState<RoomData | null>(null)
  const [status, setStatus] = useState<SaveStatus>('loading')
  const pending = useRef(false)
  const latest = useRef<RoomData | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: row, error } = await supabase.from('rooms').select('data').eq('user_id', userId).maybeSingle()
      if (!alive) return
      if (error) {
        console.error(error)
        setStatus('error')
      } else setStatus('idle')
      const room = row?.data ? sanitizeRoom(row.data) : structuredClone(DEFAULT_ROOM)
      latest.current = room
      setData(room)
    })()
    return () => {
      alive = false
    }
  }, [userId])

  const save = useCallback(async () => {
    if (!latest.current) return
    pending.current = false
    setStatus('saving')
    const { error } = await supabase
      .from('rooms')
      .upsert({ user_id: userId, data: latest.current, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) {
      console.error(error)
      setStatus('error')
    } else if (!pending.current) setStatus('saved')
  }, [userId])

  const update = useCallback(
    (fn: (d: RoomData) => RoomData) => {
      setData((d) => {
        if (!d) return d
        const next = fn(d)
        latest.current = next
        return next
      })
      pending.current = true
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(save, SAVE_DELAY)
    },
    [save],
  )

  // 화면을 떠날 때 저장 안 된 변경이 있으면 바로 저장
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      if (pending.current) save()
    },
    [save],
  )

  return { data, status, update, save }
}
