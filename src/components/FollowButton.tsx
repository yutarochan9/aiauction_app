'use client'

import { useState } from 'react'

export default function FollowButton({
  targetUserId,
  initialFollowing,
  initialCount,
}: {
  targetUserId: string
  initialFollowing: boolean
  initialCount: number
}) {
  const [following, setFollowing] = useState(initialFollowing)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    const next = !following
    setFollowing(next)
    setCount(prev => next ? prev + 1 : prev - 1)
    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followingId: targetUserId }),
      })
      if (res.status === 401) {
        setFollowing(!next)
        setCount(prev => next ? prev - 1 : prev + 1)
        window.location.href = '/auth/login'
      }
    } catch {
      setFollowing(!next)
      setCount(prev => next ? prev - 1 : prev + 1)
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-400">
        <span className="text-gray-900 font-semibold">{count}</span> followers
      </span>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`text-sm px-4 py-1.5 rounded-full font-semibold transition-colors ${
          following
            ? 'bg-stone-100 text-gray-600 hover:bg-stone-200'
            : 'bg-[#2C2C2C] text-white hover:bg-[#3C3C3C]'
        }`}
      >
        {loading ? '...' : following ? 'Following' : 'Follow'}
      </button>
    </div>
  )
}
