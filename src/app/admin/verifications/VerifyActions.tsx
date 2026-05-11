'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  verificationId: string
  userId: string
}

export default function VerifyActions({ verificationId, userId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 italic">
        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Action completed
      </div>
    )
  }

  const handleApprove = async () => {
    if (!confirm('Approve this identity verification?')) return
    setLoading('approve')
    setError('')
    try {
      const res = await fetch('/api/admin/verify/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationId, userId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to approve')
      } else {
        setDone(true)
        router.refresh()
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const handleReject = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for rejection.')
      return
    }
    if (!confirm('Reject this identity verification?')) return
    setLoading('reject')
    setError('')
    try {
      const res = await fetch('/api/admin/verify/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationId, userId, reason: reason.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to reject')
      } else {
        setDone(true)
        router.refresh()
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {showRejectForm ? (
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Rejection Reason
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Document image is blurry, ID does not match selfie…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={loading === 'reject'}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {loading === 'reject' ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              Confirm Reject
            </button>
            <button
              onClick={() => { setShowRejectForm(false); setReason(''); setError('') }}
              disabled={loading !== null}
              className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-600 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleApprove}
            disabled={loading !== null}
            className="flex items-center gap-1.5 px-5 py-2 bg-[#B8902A] hover:bg-[#a07820] disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading === 'approve' ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            Approve
          </button>
          <button
            onClick={() => { setShowRejectForm(true); setError('') }}
            disabled={loading !== null}
            className="flex items-center gap-1.5 px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Reject
          </button>
        </div>
      )}
    </div>
  )
}
