'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

type Artwork = {
  id: string
  title_ja: string
  title_en: string
  image_url: string | null
  current_price: number
  end_at: string
  status: string
  bids: { count: number }[]
}

function useCountdown(endAt: string) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endAt).getTime() - Date.now()
      if (diff <= 0) return setTimeLeft('終了')
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`)
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [endAt])

  return timeLeft
}

export default function ArtworkCard({ artwork, locale }: { artwork: Artwork; locale: string }) {
  const t = useTranslations('auction')
  const timeLeft = useCountdown(artwork.end_at)
  const title = locale === 'ja' ? artwork.title_ja : artwork.title_en
  const bidCount = artwork.bids?.[0]?.count ?? 0
  const isEnded = artwork.status !== 'active'

  return (
    <Link href={`/auction/${artwork.id}`} className="group block">
      <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-violet-500 transition-colors">
        {/* 画像（右クリック・長押し禁止） */}
        <div
          className="aspect-square relative overflow-hidden bg-gray-800"
          onContextMenu={(e) => e.preventDefault()}
        >
          {artwork.image_url ? (
            <img
              src={artwork.image_url}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none select-none"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
              No Image
            </div>
          )}
          {isEnded && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {artwork.status === 'sold' ? t('sold') : t('ended')}
              </span>
            </div>
          )}
        </div>

        {/* 情報 */}
        <div className="p-4">
          <h3 className="font-semibold text-white truncate mb-3">{title}</h3>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs text-gray-500 mb-1">{t('currentPrice')}</p>
              <p className="text-lg font-bold text-violet-400">
                ${artwork.current_price.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">{t('timeLeft')}</p>
              <p className={`text-sm font-medium ${isEnded ? 'text-gray-500' : 'text-amber-400'}`}>
                {isEnded ? (artwork.status === 'sold' ? t('sold') : t('ended')) : timeLeft}
              </p>
              <p className="text-xs text-gray-600 mt-1">{bidCount} {t('bidCount')}</p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
