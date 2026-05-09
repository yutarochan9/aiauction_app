'use client'

import { useState } from 'react'
import Link from 'next/link'

type Bid = {
  id: string
  user_id: string
  amount: number
  created_at: string
  users: { display_name: string; avatar_url: string | null }
}

export default function BidderManagement({
  artworkId,
  bids: initialBids,
}: {
  artworkId: string
  bids: Bid[]
}) {
  const [bids, setBids] = useState(initialBids)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  // ユーザーごとの最高入札だけ表示
  const topBidPerUser = Object.values(
    bids.reduce<Record<string, Bid>>((acc, bid) => {
      if (!acc[bid.user_id] || bid.amount > acc[bid.user_id].amount) {
        acc[bid.user_id] = bid
      }
      return acc
    }, {})
  ).sort((a, b) => b.amount - a.amount)

  const handleCancel = async (bid: Bid) => {
    setCancelling(bid.id)
    setMessage('')
    try {
      const res = await fetch('/api/cancel-bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId: bid.id, artworkId }),
      })
      const data = await res.json()
      if (data.success) {
        setBids((prev) => prev.filter((b) => b.user_id !== bid.user_id))
        setMessage(`Cancelled bid by ${bid.users?.display_name ?? 'user'}`)
      } else {
        setMessage(data.error ?? 'Failed to cancel')
      }
    } catch {
      setMessage('Network error')
    }
    setCancelling(null)
    setConfirmId(null)
  }

  if (topBidPerUser.length === 0) {
    return (
      <div className="bg-white rounded-xl p-5 border border-stone-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Bidder Management</h3>
        <p className="text-gray-300 text-sm">No bidders yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl p-5 border border-stone-200 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">
        Bidder Management
        <span className="ml-2 text-gray-400 font-normal">({topBidPerUser.length} bidders)</span>
      </h3>
      <p className="text-xs text-gray-400">View bidder profiles before cancelling their bids.</p>

      <div className="space-y-2">
        {topBidPerUser.map((bid, i) => (
          <div key={bid.user_id} className={`flex items-center gap-3 p-3 rounded-lg ${i === 0 ? 'bg-[#FBF6EC]' : 'bg-stone-50'}`}>
            {/* アバター */}
            {bid.users?.avatar_url ? (
              <img src={bid.users.avatar_url} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-gray-500">
                {bid.users?.display_name?.[0] ?? '?'}
              </div>
            )}

            {/* 名前・金額 */}
            <div className="flex-1 min-w-0">
              <Link
                href={`/profile/${bid.user_id}`}
                className="text-sm font-medium text-gray-900 hover:text-[#B8902A] transition-colors"
                target="_blank"
              >
                {bid.users?.display_name ?? 'Anonymous'}
                {i === 0 && <span className="ml-1 text-xs text-[#B8902A]">Top bidder</span>}
              </Link>
              <p className="text-xs text-gray-400">${bid.amount.toLocaleString()}</p>
            </div>

            {/* キャンセルボタン */}
            {confirmId === bid.id ? (
              <div className="flex gap-2">
                <button
                  onClick={() => handleCancel(bid)}
                  disabled={cancelling === bid.id}
                  className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {cancelling === bid.id ? '...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmId(null)}
                  className="text-xs bg-stone-200 hover:bg-stone-300 text-gray-600 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmId(bid.id)}
                className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors"
              >
                Remove bid
              </button>
            )}
          </div>
        ))}
      </div>

      {message && (
        <p className={`text-xs ${message.includes('Cancelled') ? 'text-green-500' : 'text-red-400'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
