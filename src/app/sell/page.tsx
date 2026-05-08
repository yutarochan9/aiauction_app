'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const DURATIONS = [
  { value: 1/60, label: '1 min (test)' },
  { value: 1,    label: '1 hour' },
  { value: 6,    label: '6 hours' },
  { value: 24,   label: '24 hours' },
  { value: 72,   label: '3 days' },
  { value: 168,  label: '7 days' },
]

export default function SellPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startingPrice, setStartingPrice] = useState('')
  const [duration, setDuration] = useState(24)
  const [agreed, setAgreed] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const addTag = (val: string) => {
    const t = val.trim().toLowerCase().replace(/\s+/g, '-')
    if (t && !tags.includes(t) && tags.length < 5) {
      setTags([...tags, t])
    }
    setTagInput('')
  }

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!file) return setError('Please select an image')
    if (!agreed) return setError('Please agree to the terms')
    if (!title) return setError('Please enter a title')
    if (!startingPrice || Number(startingPrice) <= 0) return setError('Please enter a starting price')

    setSubmitting(true)

    try {
      const uploadData = new FormData()
      uploadData.append('file', file)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadData })
      const uploadJson = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadJson.error)

      const endAt = new Date(Date.now() + duration * 3600 * 1000).toISOString()

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Please log in')

      const price = Number(startingPrice)
      const { data, error: dbErr } = await supabase
        .from('artworks')
        .insert({
          user_id: user.id,
          title_ja: title,
          title_en: title,
          description_ja: description,
          description_en: description,
          image_url: uploadJson.imageUrl,
          original_storage_path: uploadJson.originalPath,
          starting_price: price,
          current_price: price,
          end_at: endAt,
          status: 'active',
          tags,
        })
        .select()
        .single()

      if (dbErr) throw dbErr
      router.push(`/auction/${data.id}`)
    } catch (err: any) {
      setError(err.message ?? 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">List Artwork</h1>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* 画像アップロード */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">Artwork Image</label>
          <div
            className="border-2 border-dashed border-stone-300 rounded-xl p-8 text-center cursor-pointer hover:border-[#B8902A] transition-colors bg-white"
            onClick={() => fileRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {preview ? (
              <img src={preview} alt="preview" className="max-h-64 mx-auto rounded-lg object-contain" />
            ) : (
              <div className="text-gray-400">
                <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">Click or drag & drop to upload</p>
                <p className="text-xs text-gray-300 mt-1">JPG · PNG · WebP · Max 10MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFile}
          />
        </div>

        {/* タイトル */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: Neon Genesis No.7"
            className="w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#B8902A] transition-colors"
            required
          />
        </div>

        {/* 説明文 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Description <span className="text-gray-300 font-normal">(optional)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Describe your artwork..."
            className="w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#B8902A] transition-colors resize-none"
          />
        </div>

        {/* タグ */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Tags <span className="text-gray-300 font-normal">(up to 5)</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((t) => (
              <span key={t} className="flex items-center gap-1 bg-stone-100 text-gray-600 text-xs px-3 py-1.5 rounded-full">
                #{t}
                <button type="button" onClick={() => removeTag(t)} className="text-gray-400 hover:text-gray-600 leading-none">×</button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addTag(tagInput)
              }
            }}
            onBlur={() => { if (tagInput) addTag(tagInput) }}
            placeholder="Type a tag and press Enter (e.g. abstract, cyberpunk)"
            disabled={tags.length >= 5}
            className="w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#B8902A] transition-colors text-sm disabled:bg-stone-50"
          />
        </div>

        {/* 価格・期間 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Starting Price (USD)</label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={startingPrice}
                onChange={(e) => setStartingPrice(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white border border-stone-300 rounded-xl pl-8 pr-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#B8902A] transition-colors"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Auction Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-[#B8902A] transition-colors"
            >
              {DURATIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 同意 */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#B8902A]"
          />
          <span className="text-sm text-gray-500 leading-relaxed">
            I agree that this is an original AI-generated artwork not published elsewhere
          </span>
        </label>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#2C2C2C] hover:bg-[#3C3C3C] disabled:bg-stone-200 text-white font-semibold py-4 rounded-xl transition-colors text-sm tracking-wide"
        >
          {submitting ? 'Listing...' : 'List Artwork'}
        </button>
      </form>
    </div>
  )
}
