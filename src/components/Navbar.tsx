'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import NotificationBell from './NotificationBell'

export default function Navbar() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLogout = async () => {
    setDropdownOpen(false)
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
              <NotificationBell user={user} />
              <div className="relative" ref={dropdownRef}>
                <button onClick={() => setDropdownOpen(v => !v)} className="focus:outline-none">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#B8902A] flex items-center justify-center text-xs font-bold text-white">
                      {user.email?.[0]?.toUpperCase()}
                    </div>
                  )}
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-44 bg-[#1a1a1a] border border-neutral-700 rounded-xl shadow-lg py-1 z-50">
                    <Link href={`/profile/${user.id}`} onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
                      My Page
                    </Link>
                    <Link href="/sell" onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
                      Sell
                    </Link>
                    <Link href="/settings" onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
                      Settings
                    </Link>
                    <div className="border-t border-neutral-700 my-1" />
                    <button onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors">
                      Logout
                    </button>
                  </div>
                )}
              </div>
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
