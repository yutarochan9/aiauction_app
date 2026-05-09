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
}: {
  artwork: Artwork
  bids: Bid[]
  currentUser: User | null
  isBlacklisted?: boolean
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

  const isEnded = artwork.status !== 'active' || new Date(artwork.end_at) <= new Date()
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

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return (setMessage('Please log in'), setBidding(false))

    // 入札を登録
    const { error } = await supabase.from('bids').insert({
      artwork_id: artwork.id,
      user_id: user.id,
      amount,
    })

    if (error) {
      setMessage('Bid failed')
    } else {
      await supabase.from('artworks').update({ current_price: amount }).eq('id', artwork.id)
      setCurrentPrice(amount)
      setBidAmount('')
      setMessage('Bid placed!')
    }
    setBidding(false)
  }

  return (
    <div className="space-y-6">
      {/* 現在価格・残り時間 */}
      <div className="bg-white rounded-xl p-5 border border-stone-200 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-1">{t('currentPrice')}</p>
          <p className="text-3xl font-bold text-[#B8902A]">${currentPrice.toLocaleString()}</p>
          <p className="text-xs text-gray-300 mt-1">{bids.length} {t('bidCount')}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-1">{t('timeLeft')}</p>
          <p className={`text-2xl font-bold ${isEnded ? 'text-gray-400' : 'text-[#B8902A]'}`}>
            {isEnded ? t('ended') : timeLeft}
          </p>
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
        <div className="bg-[#FBF6EC] border border-[#B8902A] rounded-xl p-5 space-y-3">
          <p className="text-[#B8902A] font-semibold">🎉 Congratulations! You won!</p>
          <p className="text-gray-400 text-sm">
            Winning bid: <span className="text-gray-900 font-bold">${(bids[0]?.amount ?? currentPrice).toLocaleString()}</span>
          </p>
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <span className="text-amber-500 text-sm">⏰</span>
            <div>
              <p className="text-xs text-amber-700 font-medium">Payment deadline</p>
              <p className="text-xs text-amber-600">
                {deadlineCountdown === 'Ended' ? 'Deadline passed' : `${deadlineCountdown} remaining`}
              </p>
            </div>
          </div>
          <button
            onClick={handlePurchase}
            disabled={checkoutLoading}
            className="w-full bg-[#2C2C2C] hover:bg-[#3C3C3C] disabled:bg-stone-200 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {checkoutLoading ? 'Processing...' : 'Pay with Card'}
          </button>
          {message && (
            <p className="text-red-400 text-sm">{message}</p>
          )}
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
                  {i === 0 && <span className="text-xs text-[#B8902A]">Top Bid</span>}
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
