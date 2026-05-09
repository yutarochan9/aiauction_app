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
  bids: initialBids,
  blockedUserIds: initialBlocked = [],
}: {
  artworkId: string
  bids: Bid[]
  blockedUserIds?: string[]
}) {
  const [bids] = useState(initialBids)
  const [blocked, setBlocked] = useState<Set<string>>(new Set(initialBlocked))
  const [blocking, setBlocking] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const topBidPerUser = Object.values(
    bids.reduce<Record<string, Bid>>((acc, bid) => {
      if (!acc[bid.user_id] || bid.amount > acc[bid.user_id].amount) {
        acc[bid.user_id] = bid
      }
      return acc
    }, {})
  ).sort((a, b) => b.amount - a.amount)

  const handleBlock = async (userId: string, name: string) => {
    setBlocking(userId)
    try {
      const isBlocked = blocked.has(userId)
      const res = await fetch('/api/blacklist', {
        method: isBlocked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockedUserId: userId }),
      })
      const data = await res.json()
      if (data.success) {
        setBlocked((prev) => {
          const next = new Set(prev)
          isBlocked ? next.delete(userId) : next.add(userId)
          return next
        })
        setMessage(isBlocked ? `Unblocked ${name}` : `Blocked ${name} from future auctions`)
      } else {
        setMessage(data.error ?? 'Failed')
      }
    } catch {
      setMessage('Network error')
    }
    setBlocking(null)
  }

  if (topBidPerUser.length === 0) {
    return (
      <div className="bg-white rounded-xl p-5 border border-stone-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Bidders</h3>
        <p className="text-gray-300 text-sm">No bidders yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl p-5 border border-stone-200 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">
        Bidders
        <span className="ml-2 text-gray-400 font-normal">({topBidPerUser.length})</span>
      </h3>
      <p className="text-xs text-gray-400">
        Block a user to hide your future listings from them.
      </p>

      <div className="space-y-2">
        {topBidPerUser.map((bid, i) => {
          const isBlocked = blocked.has(bid.user_id)
          return (
            <div key={bid.user_id} className={`flex items-center gap-3 p-3 rounded-lg ${i === 0 ? 'bg-[#FBF6EC]' : 'bg-stone-50'}`}>
              {bid.users?.avatar_url ? (
                <img src={bid.users.avatar_url} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-gray-500">
                  {bid.users?.display_name?.[0] ?? '?'}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <Link
                  href={`/profile/${bid.user_id}`}
                  className="text-sm font-medium text-gray-900 hover:text-[#B8902A] transition-colors"
                  target="_blank"
                >
                  {bid.users?.display_name ?? 'Anonymous'}
                  {i === 0 && <span className="ml-1 text-xs text-[#B8902A]">Top bidder</span>}
                  {isBlocked && <span className="ml-1 text-xs text-red-400">Blocked</span>}
                </Link>
                <p className="text-xs text-gray-400">${bid.amount.toLocaleString()}</p>
              </div>

              <button
                onClick={() => handleBlock(bid.user_id, bid.users?.display_name ?? 'user')}
                disabled={blocking === bid.user_id}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  isBlocked
                    ? 'bg-red-50 text-red-500 hover:bg-red-100 border border-red-200'
                    : 'bg-stone-100 text-gray-500 hover:bg-stone-200'
                }`}
              >
                {blocking === bid.user_id ? '...' : isBlocked ? 'Unblock' : 'Block'}
              </button>
            </div>
          )
        })}
      </div>

      {message && (
        <p className={`text-xs ${message.includes('Blocked') || message.includes('Unblocked') ? 'text-green-500' : 'text-red-400'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
