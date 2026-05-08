'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

export default function Navbar() {
  const t = useTranslations('nav')
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [locale, setLocale] = useState('ja')

  useEffect(() => {
    // ユーザーセッション取得
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))

    // 現在の言語をcookieから取得
    const match = document.cookie.match(/locale=([^;]+)/)
    if (match) setLocale(match[1])
  }, [])

  // 言語切り替え
  const toggleLocale = () => {
    const next = locale === 'ja' ? 'en' : 'ja'
    document.cookie = `locale=${next}; path=/; max-age=31536000`
    setLocale(next)
    router.refresh()
  }

  // ログアウト
  const handleLogout = async () => {
    await fetch('/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="border-b border-gray-800 bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* ロゴ */}
        <Link href="/" className="text-xl font-bold text-white tracking-tight">
          AI<span className="text-violet-400">Auction</span>
        </Link>

        {/* ナビリンク */}
        <div className="flex items-center gap-6">
          <Link href="/" className="text-gray-300 hover:text-white transition-colors text-sm">
            {t('home')}
          </Link>

          {user && (
            <>
              <Link href="/sell" className="text-gray-300 hover:text-white transition-colors text-sm">
                {t('sell')}
              </Link>
              <Link href="/dashboard" className="text-gray-300 hover:text-white transition-colors text-sm">
                {t('dashboard')}
              </Link>
            </>
          )}

          {/* 言語切り替え */}
          <button
            onClick={toggleLocale}
            className="text-xs px-3 py-1 border border-gray-600 rounded-full text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
          >
            {locale === 'ja' ? 'EN' : '日本語'}
          </button>

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
                  <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold">
                    {user.email?.[0]?.toUpperCase()}
                  </div>
                )}
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {t('logout')}
              </button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              {t('login')}
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
