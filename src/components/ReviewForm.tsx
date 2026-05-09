'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ReviewForm({
  purchaseId,
  revieweeId,
  artworkId,
  onDone,
}: {
  purchaseId: string
  revieweeId: string
  artworkId: string
  onDone?: () => void
}) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (rating === 0) return setError('Please select a rating')
    setSubmitting(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: err } = await supabase.from('reviews').insert({
      purchase_id: purchaseId,
      artwork_id: artworkId,
      reviewer_id: user.id,
      reviewee_id: revieweeId,
      rating,
      comment: comment.trim() || null,
      role: 'buyer',
    })

    if (err) {
      setError('Failed to submit. Please try again.')
    } else {
      setDone(true)
      onDone?.()
    }
    setSubmitting(false)
  }

  if (done) {
    return (
      <div className="mt-3 p-3 bg-[#F0F7F0] rounded-xl text-xs text-[#3D7A4D] font-medium">
        ✓ Review submitted — thank you!
      </div>
    )
  }

  return (
    <div className="mt-3 p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
      <p className="text-xs font-semibold text-gray-600">Rate the seller</p>

      {/* 星 */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            onClick={() => setRating(s)}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            className="text-2xl transition-colors leading-none"
            style={{ color: s <= (hovered || rating) ? '#B8902A' : '#d1d5db' }}
          >
            ★
          </button>
        ))}
        {rating > 0 && (
          <span className="text-xs text-gray-400 self-center ml-1">
            {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]}
          </span>
        )}
      </div>

      {/* コメント */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Leave a comment (optional)"
        rows={2}
        maxLength={300}
        className="w-full text-xs bg-white border border-stone-300 rounded-lg px-3 py-2 resize-none text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#B8902A] transition-colors"
      />

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting || rating === 0}
        className="w-full bg-[#2C2C2C] hover:bg-[#3C3C3C] disabled:bg-stone-200 disabled:text-gray-400 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors"
      >
        {submitting ? 'Submitting...' : 'Submit Review'}
      </button>
    </div>
  )
}
