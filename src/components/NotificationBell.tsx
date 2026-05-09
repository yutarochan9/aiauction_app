'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

type Notification = {
  id: string
  type: string
  message: string
  artwork_id: string | null
  read: boolean
  created_at: string
}

export default function NotificationBell({ user }: { user: User | null }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data }) => setNotifications(data ?? []))

    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => setNotifications(prev => [payload.new as Notification, ...prev.slice(0, 14)])
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  // 外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const handleOpen = async () => {
    const next = !open
    setOpen(next)
    if (next && unreadCount > 0 && user) {
      const supabase = createClient()
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }
  }

  if (!user) return null

  return (
    <div className="relative" ref={ref}>
      <button onClick={handleOpen} className="relative p-1 text-neutral-400 hover:text-white transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-80 bg-white rounded-xl shadow-2xl border border-stone-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            <button onClick={() => setOpen(false)} className="text-gray-300 hover:text-gray-500 text-sm">✕</button>
          </div>
          {notifications.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">No notifications yet</p>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-stone-50">
              {notifications.map(n => (
                <Link
                  key={n.id}
                  href={n.artwork_id ? `/auction/${n.artwork_id}` : '/mypage'}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-3 hover:bg-stone-50 transition-colors ${!n.read ? 'bg-blue-50/40' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base mt-0.5">
                      {n.type === 'outbid' ? '🔔' : n.type === 'won' ? '🎉' : n.type === 'second_chance' ? '✨' : '📢'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 leading-snug">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
