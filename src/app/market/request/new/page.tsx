'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NewRequestPage() {
  const router = useRouter()
  const submittingRef = useRef(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [budget, setBudget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 参照画像
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string>('')
  const imageRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/auth/login')
      else setUserId(data.user.id)
    })
  }, [router])

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, or WebP files are accepted.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB.')
      return
    }
    setError('')
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setUploading(true)
    const supabase = createClient()
    const path = `${userId}/request_ref_${Date.now()}.${file.name.split('.').pop()}`
    const { error: upErr } = await supabase.storage
      .from('artwork-previews')
      .upload(path, file, { contentType: file.type, upsert: true })
    if (!upErr) {
      const { data } = supabase.storage.from('artwork-previews').getPublicUrl(path)
      setImageUrl(data.publicUrl)
    }
    setUploading(false)
  }

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
        body: JSON.stringify({
          title,
          description,
          budget: budget ? Number(budget) : null,
          deadline: deadline || null,
          reference_image_url: imageUrl || null,
        }),
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
            rows={4}
            placeholder="Describe your face/voice/character, intended use, and any requirements..."
            className="w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#B8902A] transition-colors resize-none"
          />
        </div>

        {/* 参照画像アップロード */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Your Reference Photo <span className="text-gray-300 font-normal">(optional)</span>
          </label>
          <p className="text-xs text-gray-400 mb-2">Upload a photo of yourself so creators know what to base the avatar on.</p>
          {imagePreview ? (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
              <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
              {uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <button
                type="button"
                onClick={() => { setImageFile(null); setImagePreview(null); setImageUrl(''); if (imageRef.current) imageRef.current.value = '' }}
                className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs transition-colors"
              >
                ✕
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-stone-300 hover:border-[#B8902A] rounded-xl px-4 py-8 cursor-pointer transition-colors group">
              <svg className="w-9 h-9 text-gray-300 group-hover:text-[#B8902A] mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-gray-500 group-hover:text-[#B8902A] transition-colors">Click to upload photo</span>
              <span className="text-xs text-gray-400 mt-1">JPG, PNG, WebP · max 10MB</span>
              <input ref={imageRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="hidden" />
            </label>
          )}
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
          disabled={submitting || uploading}
          className="w-full bg-[#2C2C2C] hover:bg-[#3C3C3C] disabled:bg-stone-200 text-white font-semibold py-4 rounded-xl transition-colors text-sm"
        >
          {submitting ? 'Posting...' : 'Post Request'}
        </button>
      </form>
    </div>
  )
}
