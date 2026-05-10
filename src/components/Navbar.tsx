'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import NotificationBell from './NotificationBell'

export default function Navbar() {
  const t = useTranslations('nav')
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const handleLogout = async () => {
    await fetch('/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="border-b border-neutral-800 bg-black">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* ロゴ画像 */}
        <Link href="/">
          <img
            src="/aiaii_logo.png"
            alt="AIAII"
            className="h-[72px] w-auto object-contain"
            draggable={false}
          />
        </Link>

        {/* ナビリンク */}
        <div className="flex items-center gap-6">
          <Link href="/" className="text-neutral-400 hover:text-white transition-colors text-sm">
            {t('home')}
          </Link>

          {user && (
            <>
              <Link href="/sell" className="text-neutral-400 hover:text-white transition-colors text-sm">
                {t('sell')}
              </Link>
              <Link href="/mypage" className="text-neutral-400 hover:text-white transition-colors text-sm">
                My Page
              </Link>
              <Link href="/settings" className="text-neutral-400 hover:text-white transition-colors text-sm">
                Settings
              </Link>
            </>
          )}

          {/* 通知ベル */}
          <NotificationBell user={user} />

          {/* ログイン・ログアウト */}
          {user ? (
            <div className="flex items-center gap-3">
              <Link href={`/profile/${user.id}`}>
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="avatar"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#B8902A] flex items-center justify-center text-xs font-bold text-white">
                    {user.email?.[0]?.toUpperCase()}
                  </div>
                )}
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-neutral-400 hover:text-white transition-colors"
              >
                {t('logout')}
              </button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="bg-[#2C2C2C] hover:bg-[#3C3C3C] text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              {t('login')}
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
