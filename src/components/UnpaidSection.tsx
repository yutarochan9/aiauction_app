'use client'

import { useState } from 'react'
import Link from 'next/link'

type Artwork = {
  id: string
  title_ja: string
  title_en: string
  image_url: string | null
  end_at: string
  bids: { user_id: string; amount: number; users: { display_name: string } }[]
}

export default function UnpaidSection({
  artworks,
  locale,
}: {
  artworks: Artwork[]
  locale: string
}) {
  const [loading, setLoading] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, string>>({})

  const setMsg = (id: string, msg: string) =>
    setMessages((prev) => ({ ...prev, [id]: msg }))

  const handleReport = async (artwork: Artwork) => {
    setLoading(artwork.id)
    setMsg(artwork.id, '')
    try {
      const res = await fetch('/api/report-nonpayment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artworkId: artwork.id }),
      })
      const data = await res.json()
      if (data.noSecondBidder) {
        setMsg(artwork.id, 'No second bidder. Use re-list to start a new auction.')
      } else if (data.success) {
        setMsg(artwork.id, '✓ Second chance offer sent to the next highest bidder (expires in 48h).')
      } else {
        setMsg(artwork.id, data.error ?? 'Failed')
      }
    } catch {
      setMsg(artwork.id, 'Network error')
    }
    setLoading(null)
  }

  const handleRelist = async (artwork: Artwork) => {
    setLoading(artwork.id + '-relist')
    // 24時間で再出品
    const endAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    try {
      const res = await fetch('/api/relist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artworkId: artwork.id, endAt }),
      })
      const data = await res.json()
      if (data.success) {
        window.location.reload()
      } else {
        setMsg(artwork.id, data.error ?? 'Failed to re-list')
      }
    } catch {
      setMsg(artwork.id, 'Network error')
    }
    setLoading(null)
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Awaiting Payment</h2>
      <p className="text-xs text-gray-400 mb-4">These auctions ended without payment. Report non-payment to offer to the next bidder, or re-list.</p>
      <div className="space-y-4">
        {artworks.map((artwork) => {
          const title = locale === 'ja' ? artwork.title_ja : artwork.title_en
          const topBid = artwork.bids?.sort((a, b) => b.amount - a.amount)[0]
          const endedHoursAgo = Math.floor((Date.now() - new Date(artwork.end_at).getTime()) / 3600000)
          const canReport = endedHoursAgo >= 72

          return (
            <div key={artwork.id} className="bg-white rounded-xl p-4 border border-amber-200">
              <div className="flex items-center gap-4 mb-3">
                {artwork.image_url && (
                  <img src={artwork.image_url} alt={title} className="w-12 h-12 rounded-lg object-cover pointer-events-none" draggable={false} />
                )}
                <div className="flex-1">
                  <Link href={`/auction/${artwork.id}`} className="text-sm font-medium text-gray-900 hover:text-[#B8902A]">{title}</Link>
                  {topBid && (
                    <p className="text-xs text-gray-400">
                      Top bid: ${topBid.amount.toLocaleString()} by {topBid.users?.display_name ?? 'Unknown'}
                    </p>
                  )}
                  <p className="text-xs text-gray-300">Ended {endedHoursAgo}h ago</p>
                </div>
              </div>

              {!canReport && (
                <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  Payment deadline: {72 - endedHoursAgo}h remaining. You can report non-payment after 72h.
                </p>
              )}

              {canReport && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleReport(artwork)}
                    disabled={loading === artwork.id}
                    className="text-xs bg-[#2C2C2C] hover:bg-[#3C3C3C] disabled:bg-stone-200 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    {loading === artwork.id ? 'Processing...' : 'Report Non-Payment'}
                  </button>
                  <button
                    onClick={() => handleRelist(artwork)}
                    disabled={loading === artwork.id + '-relist'}
                    className="text-xs bg-stone-100 hover:bg-stone-200 text-gray-700 px-4 py-2 rounded-lg transition-colors"
                  >
                    {loading === artwork.id + '-relist' ? '...' : 'Re-list (24h)'}
                  </button>
                </div>
              )}

              {messages[artwork.id] && (
                <p className={`text-xs mt-2 ${messages[artwork.id].startsWith('✓') ? 'text-green-500' : 'text-amber-600'}`}>
                  {messages[artwork.id]}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
