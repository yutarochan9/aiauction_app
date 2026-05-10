'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

type Artwork = {
  id: string
  current_price: number
  starting_price: number
  end_at: string
  status: string
  user_id: string
  [key: string]: any
}

type Bid = {
  id: string
  user_id: string
  amount: number
  created_at: string
  users: { display_name: string; avatar_url: string | null }
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

export default function BidSection({
  artwork,
  bids: initialBids,
  currentUser,
  isBlacklisted = false,
  isLiked: initialIsLiked = false,
  initialLikesCount = 0,
}: {
  artwork: Artwork
  bids: Bid[]
  currentUser: User | null
  isBlacklisted?: boolean
  isLiked?: boolean
  initialLikesCount?: number
}) {
  const t = useTranslations('auction')
  const timeLeft = useCountdown(artwork.end_at)
  const [bids, setBids] = useState<Bid[]>(initialBids)
  const [currentPrice, setCurrentPrice] = useState(
    Math.max(artwork.current_price, initialBids[0]?.amount ?? 0)
  )
  const [bidAmount, setBidAmount] = useState('')
  const [bidding, setBidding] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [liked, setLiked] = useState(initialIsLiked)
  const [likesCount, setLikesCount] = useState(initialLikesCount)

  const handleLike = async () => {
    const next = !liked
    setLiked(next)
    setLikesCount(prev => next ? prev + 1 : prev - 1)
    try {
      const res = await fetch('/api/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artworkId: artwork.id }),
      })
      if (res.status === 401) {
        setLiked(!next)
        setLikesCount(prev => next ? prev - 1 : prev + 1)
      }
    } catch {
      setLiked(!next)
      setLikesCount(prev => next ? prev - 1 : prev + 1)
    }
  }

  const isScheduled = artwork.status === 'scheduled'
  const isEnded = !isScheduled && (artwork.status !== 'active' || new Date(artwork.end_at) <= new Date())
  const isOwner = currentUser?.id === artwork.user_id
  const isSold = artwork.status === 'sold'
  const topBidder = bids[0]
  const isWinner = isEnded && !isOwner && currentUser?.id === topBidder?.user_id
  const minBid = currentPrice + 0.01
  const paymentDeadlineIso = new Date(new Date(artwork.end_at).getTime() + 72 * 3600 * 1000).toISOString()
  const deadlineCountdown = useCountdown(paymentDeadlineIso)

  // Supabase Realtimeでリアルタイム入札更新
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`artwork-${artwork.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bids', filter: `artwork_id=eq.${artwork.id}` },
        async (payload) => {
          // 新しい入札が来たら入札履歴と現在価格を更新
          const { data } = await supabase
            .from('bids')
            .select('*, users(display_name, avatar_url)')
            .eq('artwork_id', artwork.id)
            .order('amount', { ascending: false })
            .limit(20)
          if (data) setBids(data as any)

          setCurrentPrice(payload.new.amount)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [artwork.id])

  const handlePurchase = async () => {
    setCheckoutLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artworkId: artwork.id }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setMessage(data.error ?? 'Failed to start checkout')
      }
    } catch (e: any) {
      setMessage(e?.message ?? 'Network error')
    }
    setCheckoutLoading(false)
  }

  const handleBid = async () => {
    const amount = Number(bidAmount)
    if (isNaN(amount) || amount < minBid) {
      return setMessage(`$${minBid.toFixed(2)} or more required`)
    }
    setBidding(true)
    setMessage('')
    try {
      const res = await fetch('/api/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artworkId: artwork.id, amount }),
      })
      const data = await res.json()
      if (data.success) {
        setCurrentPrice(amount)
        setBidAmount('')
        setMessage('Bid placed!')
      } else {
        setMessage(data.error ?? 'Bid failed')
      }
    } catch {
      setMessage('Network error')
    }
    setBidding(false)
  }

  return (
    <div className="space-y-6">
      {/* 現在価格・残り時間 */}
      <div className="bg-white rounded-xl p-5 border border-stone-200">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">{t('currentPrice')}</p>
            <p className="text-3xl font-bold text-[#B8902A]">${currentPrice.toLocaleString()}</p>
            <p className="text-xs text-gray-300 mt-1">
              Starting ${artwork.starting_price.toLocaleString()} · {bids.length} {t('bidCount')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-1">{isScheduled ? 'Starts' : t('timeLeft')}</p>
            <p className={`text-2xl font-bold ${isEnded ? 'text-gray-400' : isScheduled ? 'text-blue-400' : 'text-[#B8902A]'}`}>
              {isScheduled ? new Date(artwork.start_at).toLocaleDateString() : isEnded ? t('ended') : timeLeft}
            </p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-sm transition-colors ${
              liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
            }`}
          >
            <svg className="w-5 h-5" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {liked ? 'Liked' : 'Like'}
            {likesCount > 0 && <span className="text-xs text-gray-400">{likesCount}</span>}
          </button>
        </div>
      </div>

      {/* 入札フォーム */}
      {!isEnded && !isOwner && currentUser && !isBlacklisted && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-3 text-gray-400">$</span>
              <input
                type="number"
                step="0.01"
                min={minBid}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={`${minBid.toFixed(2)} or more`}
                className="w-full bg-stone-100 border border-stone-300 rounded-lg pl-8 pr-4 py-3 text-gray-900 focus:outline-none focus:border-[#B8902A]"
              />
            </div>
            <button
              onClick={handleBid}
              disabled={bidding}
              className="bg-[#2C2C2C] hover:bg-[#3C3C3C] disabled:bg-stone-200 text-white font-semibold px-6 rounded-lg transition-colors"
            >
              {bidding ? '...' : t('placeBid')}
            </button>
          </div>
          {message && (
            <p className={`text-sm ${message.includes('失敗') || message.includes('必要') ? 'text-red-400' : 'text-green-400'}`}>
              {message}
            </p>
          )}
        </div>
      )}

      {isBlacklisted && !isEnded && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-500">
          You are not allowed to bid on this auction.
        </div>
      )}

      {!currentUser && !isEnded && (
        <a href="/auth/login" className="block w-full text-center bg-stone-100 hover:bg-stone-200 text-gray-900 py-3 rounded-xl transition-colors">
          Login to Bid
        </a>
      )}

      {/* 落札者向け購入ボタン */}
      {isWinner && !isSold && (
        <div className="relative overflow-hidden rounded-2xl border border-[#C9A84C] p-6 space-y-4"
          style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2218 100%)' }}>
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />
          <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #C9A84C44, transparent)' }} />

          {/* YOU WON */}
          <div className="text-center py-1">
            <p className="text-[10px] tracking-[0.35em] text-[#C9A84C] uppercase font-medium mb-1">Auction Result</p>
            <p className="text-4xl font-black tracking-widest uppercase"
              style={{ background: 'linear-gradient(90deg, #C9A84C, #f0dc82, #C9A84C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              You Won
            </p>
            <p className="text-white/50 text-xs tracking-wide mt-1">Congratulations on your winning bid</p>
          </div>

          {/* 落札金額 */}
          <div className="flex items-baseline gap-2 border-t border-white/10 pt-4">
            <span className="text-xs text-gray-500 tracking-wider uppercase">Winning Bid</span>
            <span className="text-2xl font-bold text-white ml-auto">${(bids[0]?.amount ?? currentPrice).toLocaleString()}</span>
          </div>

          {/* 支払期限 */}
          <div className="flex items-center justify-between rounded-lg px-4 py-3"
            style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)' }}>
            <div>
              <p className="text-[10px] tracking-[0.2em] text-[#C9A84C] uppercase">Payment Deadline</p>
              <p className="text-sm text-white/70 mt-0.5">
                {deadlineCountdown === 'Ended' ? 'Deadline has passed' : `${deadlineCountdown} remaining`}
              </p>
            </div>
            <svg className="w-5 h-5 text-[#C9A84C] opacity-70" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 7v5l3 3" />
            </svg>
          </div>

          <button
            onClick={handlePurchase}
            disabled={checkoutLoading}
            className="w-full disabled:opacity-40 text-[#1a1a1a] font-bold py-3 rounded-xl tracking-widest uppercase transition-opacity text-sm"
            style={{ background: 'linear-gradient(90deg, #C9A84C, #e8c96a, #C9A84C)' }}
          >
            {checkoutLoading ? 'Processing…' : 'Complete Purchase'}
          </button>
          {message && <p className="text-red-400 text-xs">{message}</p>}
        </div>
      )}

      {isSold && isEnded && (
        <div className="bg-stone-100 rounded-xl p-4 text-center">
          <p className="text-gray-400 text-sm">This artwork has been sold</p>
        </div>
      )}

      {/* 入札履歴 */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3">{t('bidHistory')}</h3>
        {bids.length === 0 ? (
          <p className="text-gray-300 text-sm">{t('noBids')}</p>
        ) : (
          <div className="space-y-2">
            {bids.map((bid, i) => (
              <div key={bid.id} className={`flex items-center justify-between p-3 rounded-lg ${i === 0 ? 'bg-[#FBF6EC] border border-[#e5d5a8]' : 'bg-white'}`}>
                <div className="flex items-center gap-2">
                  {bid.users?.avatar_url ? (
                    <img src={bid.users.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-stone-200 text-xs flex items-center justify-center">
                      {bid.users?.display_name?.[0]}
                    </div>
                  )}
                  <span className="text-sm text-gray-300">{bid.users?.display_name ?? 'Anonymous'}</span>
                  {i === 0 && <span className="text-[10px] tracking-wider text-[#B8902A] uppercase">Top</span>}
                </div>
                <span className="font-semibold text-gray-900">${bid.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
