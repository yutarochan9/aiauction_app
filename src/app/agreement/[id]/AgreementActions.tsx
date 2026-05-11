'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AgreementActions({
  agreementId,
  artworkId,
  revisionCount,
}: {
  agreementId: string
  artworkId: string
  revisionCount: number
}) {
  const router = useRouter()
  const [comment, setComment] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleApprove = async () => {
    setLoading(true)
    setError('')
    const res = await fetch('/api/agreement/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agreementId, artworkId }),
    })
    if (!res.ok) { setError('Failed to approve'); setLoading(false); return }
    router.refresh()
    setLoading(false)
  }

  const handleReject = async () => {
    if (!comment.trim()) { setError('Please add a comment explaining what changes are needed'); return }
    setLoading(true)
    setError('')
    const res = await fetch('/api/agreement/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agreementId, artworkId, comment }),
    })
    if (!res.ok) { setError('Failed to submit'); setLoading(false); return }
    router.refresh()
    setLoading(false)
  }

  const revisionsLeft = 3 - revisionCount

  return (
    <div className="space-y-4">
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {!showReject ? (
        <div className="flex gap-3">
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 bg-[#2C2C2C] hover:bg-[#3C3C3C] disabled:bg-stone-200 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            {loading ? 'Processing...' : 'Approve & Go Live'}
          </button>
          {revisionsLeft > 0 && (
            <button
              onClick={() => setShowReject(true)}
              disabled={loading}
              className="flex-1 bg-white border border-stone-300 hover:border-stone-400 text-gray-700 font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Request Changes ({revisionsLeft} left)
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Request Changes</p>
            <p className="text-xs text-gray-400">Revision {revisionCount + 1} of 3. The creator will see your feedback.</p>
          </div>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={4}
            placeholder="Describe what needs to be changed..."
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#B8902A] resize-none"
          />
          <div className="flex gap-3">
            <button
              onClick={handleReject}
              disabled={loading || !comment.trim()}
              className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-stone-200 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              {loading ? 'Sending...' : 'Send Feedback'}
            </button>
            <button
              onClick={() => { setShowReject(false); setComment('') }}
              disabled={loading}
              className="px-5 bg-white border border-stone-300 text-gray-600 font-semibold py-3 rounded-xl text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
