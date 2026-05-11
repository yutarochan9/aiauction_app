'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import NotificationBell from './NotificationBell'

export default function Navbar() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user)
      if (data.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('avatar_url')
          .eq('id', data.user.id)
          .single()
        setAvatarUrl(profile?.avatar_url ?? data.user.user_metadata?.avatar_url ?? null)
      }
    })
  }, [])

  const handleLogout = async () => {
    await fetch('/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="border-b border-neutral-800 bg-black">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/">
          <img src="/aiaii_logo.png" alt="AIAII" className="h-[72px] w-auto object-contain" draggable={false} />
        </Link>

        <div className="flex items-center gap-6">
          <Link href="/" className="text-neutral-400 hover:text-white transition-colors text-sm">Market</Link>
          <Link href="/market/request" className="text-neutral-400 hover:text-white transition-colors text-sm">Requests</Link>

          {user ? (
            <>
              <Link href={`/profile/${user.id}`} className="text-neutral-400 hover:text-white transition-colors text-sm">My Page</Link>
              <Link href="/settings" className="text-neutral-400 hover:text-white transition-colors text-sm">Settings</Link>
              <NotificationBell user={user} />
              <Link href={`/profile/${user.id}`}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#B8902A] flex items-center justify-center text-xs font-bold text-white">
                    {user.email?.[0]?.toUpperCase()}
                  </div>
                )}
              </Link>
              <button onClick={handleLogout} className="text-sm text-neutral-400 hover:text-white transition-colors">
                Logout
              </button>
            </>
          ) : (
            <Link href="/auth/login"
              className="bg-[#2C2C2C] hover:bg-[#3C3C3C] text-white text-sm px-4 py-2 rounded-lg transition-colors">
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
