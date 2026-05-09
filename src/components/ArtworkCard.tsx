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
  tags: string[] | null
  bids: { count: number }[]
}

function useCountdown(endAt: string) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endAt).getTime() - Date.now()
      if (diff <= 0) return setTimeLeft('Ended')
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
  const isEnded = artwork.status !== 'active' || new Date(artwork.end_at) <= new Date()
  const isSold = artwork.status === 'sold'

  return (
    <Link href={`/auction/${artwork.id}`} className="group block">
      <div className="bg-white rounded-xl overflow-hidden border border-stone-200 hover:border-[#B8902A] transition-colors">
        {/* 画像（右クリック・長押し禁止） */}
        <div
          className="aspect-square relative overflow-hidden bg-stone-100"
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
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
              No Image
            </div>
          )}
          {isEnded && (
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden"
              style={{ background: isSold ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.55)' }}
            >
              {isSold ? (
                <div className="rotate-[-22deg] select-none px-7 py-2.5 text-center"
                  style={{
                    background: 'linear-gradient(135deg, #B8902A, #e6b84a)',
                    boxShadow: '0 4px 24px rgba(184,144,42,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
                    letterSpacing: '0.3em',
                  }}
                >
                  <span className="font-black text-white text-xl" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                    SOLD
                  </span>
                </div>
              ) : (
                <div className="rotate-[-22deg] select-none px-7 py-2.5 text-center"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '2px solid rgba(255,255,255,0.5)',
                    backdropFilter: 'blur(4px)',
                    letterSpacing: '0.3em',
                  }}
                >
                  <span className="font-bold text-white/80 text-xl" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                    ENDED
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 情報 */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 truncate mb-3">{title}</h3>
          <p className="text-lg font-bold text-[#B8902A] mb-1">
            ${artwork.current_price.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mb-3">
            {bidCount} {t('bidCount')} · {isEnded ? (artwork.status === 'sold' ? t('sold') : t('ended')) : timeLeft}
          </p>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            isSold
              ? 'bg-[#FBF6EC] text-[#B8902A]'
              : isEnded
              ? 'bg-stone-100 text-stone-500'
              : 'bg-[#F0F7F0] text-[#3D7A4D]'
          }`}>
            {isSold ? 'Sold' : isEnded ? 'Closed' : 'Live'}
          </span>
          {artwork.tags && artwork.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {artwork.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="text-[10px] text-gray-400 bg-stone-50 border border-stone-200 px-2 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
