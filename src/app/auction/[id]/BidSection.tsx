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
      if (diff <= 0) return setTimeLeft('終了')
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(h > 0 ? `${h}時間 ${m}分` : `${m}分 ${s}秒`)
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
}: {
  artwork: Artwork
  bids: Bid[]
  currentUser: User | null
}) {
  const t = useTranslations('auction')
  const timeLeft = useCountdown(artwork.end_at)
  const [bids, setBids] = useState<Bid[]>(initialBids)
  const [currentPrice, setCurrentPrice] = useState(artwork.current_price)
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
        setMessage(data.error ?? '決済の開始に失敗しました')
      }
    } catch {
      setMessage('エラーが発生しました')
    }
    setCheckoutLoading(false)
  }

  const handleBid = async () => {
    const amount = Number(bidAmount)
    if (isNaN(amount) || amount < minBid) {
      return setMessage(`$${minBid.toFixed(2)} 以上の金額を入力してください`)
    }
    setBidding(true)
    setMessage('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return (setMessage('ログインが必要です'), setBidding(false))

    // 入札を登録
    const { error } = await supabase.from('bids').insert({
      artwork_id: artwork.id,
      user_id: user.id,
      amount,
    })

    if (error) {
      setMessage('入札に失敗しました')
    } else {
      // artworksの現在価格を更新
      await supabase.from('artworks').update({ current_price: amount }).eq('id', artwork.id)
      setBidAmount('')
      setMessage('入札しました！')
    }
    setBidding(false)
  }

  return (
    <div className="space-y-6">
      {/* 現在価格・残り時間 */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">{t('currentPrice')}</p>
          <p className="text-3xl font-bold text-violet-400">${currentPrice.toLocaleString()}</p>
          <p className="text-xs text-gray-600 mt-1">{bids.length} {t('bidCount')}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-1">{t('timeLeft')}</p>
          <p className={`text-2xl font-bold ${isEnded ? 'text-gray-500' : 'text-amber-400'}`}>
            {isEnded ? t('ended') : timeLeft}
          </p>
        </div>
      </div>

      {/* 入札フォーム */}
      {!isEnded && !isOwner && currentUser && (
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
                placeholder={`${minBid.toFixed(2)} 以上`}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-4 py-3 text-white focus:outline-none focus:border-violet-500"
              />
            </div>
            <button
              onClick={handleBid}
              disabled={bidding}
              className="bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 text-white font-semibold px-6 rounded-lg transition-colors"
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

      {!currentUser && !isEnded && (
        <a href="/auth/login" className="block w-full text-center bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition-colors">
          ログインして入札する / Login to Bid
        </a>
      )}

      {/* 落札者向け購入ボタン */}
      {isWinner && !isSold && (
        <div className="bg-violet-900/20 border border-violet-700 rounded-xl p-5 space-y-3">
          <p className="text-violet-300 font-semibold">🎉 おめでとうございます！落札しました</p>
          <p className="text-gray-400 text-sm">
            落札額: <span className="text-white font-bold">${currentPrice.toLocaleString()}</span>
          </p>
          <button
            onClick={handlePurchase}
            disabled={checkoutLoading}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {checkoutLoading ? '処理中...' : 'カードで支払う'}
          </button>
          {message && (
            <p className="text-red-400 text-sm">{message}</p>
          )}
        </div>
      )}

      {isSold && isEnded && (
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-400 text-sm">この作品は落札済みです</p>
        </div>
      )}

      {/* 入札履歴 */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3">{t('bidHistory')}</h3>
        {bids.length === 0 ? (
          <p className="text-gray-600 text-sm">{t('noBids')}</p>
        ) : (
          <div className="space-y-2">
            {bids.map((bid, i) => (
              <div key={bid.id} className={`flex items-center justify-between p-3 rounded-lg ${i === 0 ? 'bg-violet-900/30 border border-violet-800' : 'bg-gray-900'}`}>
                <div className="flex items-center gap-2">
                  {bid.users?.avatar_url ? (
                    <img src={bid.users.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-700 text-xs flex items-center justify-center">
                      {bid.users?.display_name?.[0]}
                    </div>
                  )}
                  <span className="text-sm text-gray-300">{bid.users?.display_name ?? 'Anonymous'}</span>
                  {i === 0 && <span className="text-xs text-violet-400">最高入札</span>}
                </div>
                <span className="font-semibold text-white">${bid.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
