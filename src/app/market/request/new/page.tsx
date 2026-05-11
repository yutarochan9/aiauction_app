'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NewRequestPage() {
  const router = useRouter()
  const submittingRef = useRef(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [budget, setBudget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/auth/login')
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current) return
    setError('')
    if (!title.trim()) return setError('Please enter a title')

    submittingRef.current = true
    setSubmitting(true)
    try {
      const res = await fetch('/api/requests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, budget: budget ? Number(budget) : null, deadline: deadline || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      router.push(`/market/request/${json.id}`)
    } catch (err: any) {
      setError(err.message ?? 'An error occurred')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Post a Request</h1>
      <p className="text-sm text-gray-400 mb-8">Describe the AI avatar you need. Creators will apply with their portfolio.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Title <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Realistic talking avatar for YouTube channel"
            className="w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#B8902A] transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={5}
            placeholder="Describe your face/voice/character, the AI tools you'd like used (HeyGen, ElevenLabs, etc.), intended use, and any other requirements..."
            className="w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#B8902A] transition-colors resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Budget (USD) <span className="text-gray-300 font-normal">optional</span></label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="1"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="0"
                className="w-full bg-white border border-stone-300 rounded-xl pl-8 pr-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#B8902A] transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Deadline <span className="text-gray-300 font-normal">optional</span></label>
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-[#B8902A] transition-colors"
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#2C2C2C] hover:bg-[#3C3C3C] disabled:bg-stone-200 text-white font-semibold py-4 rounded-xl transition-colors text-sm"
        >
          {submitting ? 'Posting...' : 'Post Request'}
        </button>
      </form>
    </div>
  )
}
