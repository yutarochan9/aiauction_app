'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function ApplyButton({
  requestId,
  existingApplication,
}: {
  requestId: string
  existingApplication: any
}) {
  const router = useRouter()
  const submittingRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (existingApplication) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4">
        <p className="text-sm font-semibold text-green-800">Application submitted ✓</p>
        <p className="text-xs text-green-600 mt-1">The identity holder will review your application.</p>
        {existingApplication.status === 'accepted' && (
          <p className="text-sm font-semibold text-[#B8902A] mt-2">🎉 You were selected!</p>
        )}
      </div>
    )
  }

  const handleApply = async () => {
    if (submittingRef.current) return
    setError('')
    submittingRef.current = true
    setLoading(true)
    try {
      const res = await fetch('/api/requests/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, message, price: price ? Number(price) : null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      router.refresh()
    } catch (err: any) {
      setError(err.message ?? 'An error occurred')
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Apply as Creator</h2>
      <p className="text-xs text-gray-400 mb-4">Submit your application with a message and optional price quote.</p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full bg-[#2C2C2C] hover:bg-[#3C3C3C] text-white font-semibold py-3 rounded-xl text-sm transition-colors"
        >
          Apply for this Request
        </button>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Message to identity holder</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              placeholder="Introduce yourself, describe your approach, relevant tools (HeyGen, ElevenLabs), and past work..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#B8902A] resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Your price quote (USD) <span className="text-gray-300">optional</span></label>
            <div className="relative">
              <span className="absolute left-4 top-2.5 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="1"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#B8902A]"
              />
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleApply}
              disabled={loading}
              className="flex-1 bg-[#2C2C2C] hover:bg-[#3C3C3C] disabled:bg-stone-200 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
            <button
              onClick={() => setOpen(false)}
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
