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
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const match = document.cookie.match(/locale=([^;]+)/)
    if (match) setLocale(match[1])
  }, [])

  const toggleLocale = () => {
    const next = locale === 'ja' ? 'en' : 'ja'
    document.cookie = `locale=${next}; path=/; max-age=31536000`
    setLocale(next)
    router.refresh()
  }

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
            className="h-9 w-auto object-contain"
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
              <Link href="/dashboard" className="text-neutral-400 hover:text-white transition-colors text-sm">
                {t('dashboard')}
              </Link>
            </>
          )}

          {/* 言語切り替え */}
          <button
            onClick={toggleLocale}
            className="text-xs px-3 py-1 border border-neutral-700 rounded-full text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
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
                  <div className="w-8 h-8 rounded-full bg-amber-700 flex items-center justify-center text-xs font-bold text-white">
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
              className="bg-amber-700 hover:bg-amber-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              {t('login')}
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
