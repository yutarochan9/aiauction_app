'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import WatermarkOverlay from './WatermarkOverlay'

type Artwork = {
  id: string
  title_ja: string
  title_en: string
  image_url: string | null
  current_price: number
  starting_price: number
  start_at: string | null
  end_at: string
  status: string
  tags: string[] | null
  bids: { count: number }[]
  likes: { count: number }[]
  view_count?: number
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="w-4 h-4" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  )
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

export default function ArtworkCard({
  artwork,
  locale,
  isLiked: initialIsLiked = false,
}: {
  artwork: Artwork
  locale: string
  isLiked?: boolean
}) {
  const t = useTranslations('auction')
  const timeLeft = useCountdown(artwork.end_at)
  const title = locale === 'ja' ? artwork.title_ja : artwork.title_en
  const bidCount = artwork.bids?.[0]?.count ?? 0
  const isScheduled = artwork.status === 'scheduled'
  const isEnded = !isScheduled && (artwork.status !== 'active' || new Date(artwork.end_at) <= new Date())
  const isSold = artwork.status === 'sold'
  const isHold = artwork.status === 'active' && new Date(artwork.end_at) <= new Date()

  const [liked, setLiked] = useState(initialIsLiked)
  const [likeCount, setLikeCount] = useState(artwork.likes?.[0]?.count ?? 0)

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const next = !liked
    setLiked(next)
    setLikeCount(prev => next ? prev + 1 : prev - 1)
    try {
      const res = await fetch('/api/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artworkId: artwork.id }),
      })
      if (res.status === 401) {
        setLiked(!next)
        setLikeCount(prev => next ? prev - 1 : prev + 1)
        window.location.href = '/auth/login'
      }
    } catch {
      setLiked(!next)
      setLikeCount(prev => next ? prev - 1 : prev + 1)
    }
  }

  return (
    <Link href={`/auction/${artwork.id}`} className="group block cursor-pointer">
      <div className="bg-white rounded-xl overflow-hidden border border-stone-200 hover:border-[#B8902A] hover:shadow-sm transition-all">
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

          <WatermarkOverlay />

          {isEnded && (
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden"
              style={{ background: isSold ? 'rgba(0,0,0,0.45)' : isHold ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0.55)' }}
            >
              <div className="rotate-[-22deg] select-none text-center"
                style={{
                  padding: '10px 52px',
                  background: isSold
                    ? 'rgba(180,30,30,0.18)'
                    : isHold
                    ? 'rgba(160,110,0,0.22)'
                    : 'rgba(255,255,255,0.08)',
                  border: isSold
                    ? '2px solid rgba(220,60,60,0.7)'
                    : isHold
                    ? '2px solid rgba(210,160,20,0.75)'
                    : '2px solid rgba(255,255,255,0.5)',
                  backdropFilter: 'blur(4px)',
                  letterSpacing: '0.38em',
                }}
              >
                <span
                  className="font-bold text-2xl"
                  style={{
                    color: isSold
                      ? 'rgba(255,100,100,0.95)'
                      : isHold
                      ? 'rgba(255,195,50,0.97)'
                      : 'rgba(255,255,255,0.8)',
                    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                  }}
                >
                  {isSold ? 'SOLD' : isHold ? 'HOLD' : 'ENDED'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 情報 */}
        <div className="p-3">
          <h3 className="font-semibold text-gray-900 truncate mb-2 text-sm">{title}</h3>
          <p className="text-base font-bold text-[#B8902A]">
            ${artwork.current_price.toLocaleString()}
          </p>
          <p className="text-xs text-gray-300 mb-0.5">
            Starting ${artwork.starting_price.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mb-2">
            {bidCount} {t('bidCount')} · {isEnded ? (isSold ? t('sold') : isHold ? 'On hold' : t('ended')) : timeLeft}
            {(artwork.view_count ?? 0) > 0 && <span className="text-gray-300"> · 👁 {artwork.view_count}</span>}
          </p>
          <div className="flex items-center justify-between">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              isSold
                ? 'bg-[#FBF6EC] text-[#B8902A]'
                : isHold
                ? 'bg-amber-50 text-amber-600'
                : isEnded
                ? 'bg-stone-100 text-stone-500'
                : isScheduled
                ? 'bg-blue-50 text-blue-500'
                : 'bg-[#F0F7F0] text-[#3D7A4D]'
            }`}>
              {isSold ? 'Sold' : isHold ? 'Hold' : isEnded ? 'Closed' : isScheduled ? 'Scheduled' : 'Live'}
            </span>
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 text-xs transition-colors ${
                liked ? 'text-red-500' : 'text-gray-300 hover:text-red-400'
              }`}
            >
              <HeartIcon filled={liked} />
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>
          </div>
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
