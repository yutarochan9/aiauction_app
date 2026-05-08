'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const DURATIONS = [
  { value: 1/60, label: '1分（テスト用）' },
  { value: 1,    label: '1時間 / 1 hour' },
  { value: 6,    label: '6時間 / 6 hours' },
  { value: 24,   label: '24時間 / 24 hours' },
  { value: 72,   label: '3日間 / 3 days' },
  { value: 168,  label: '7日間 / 7 days' },
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!file) return setError('画像を選択してください')
    if (!agreed) return setError('同意チェックが必要です')
    if (!title) return setError('タイトルを入力してください')
    if (!startingPrice || Number(startingPrice) <= 0) return setError('開始価格を入力してください')

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
      if (!user) throw new Error('ログインが必要です')

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
        })
        .select()
        .single()

      if (dbErr) throw dbErr
      router.push(`/auction/${data.id}`)
    } catch (err: any) {
      setError(err.message ?? 'エラーが発生しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">出品する / List Artwork</h1>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* 画像アップロード */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">作品画像 / Artwork Image</label>
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
                <p className="text-4xl mb-3">🖼️</p>
                <p className="text-sm">クリックまたはドラッグ＆ドロップ</p>
                <p className="text-xs text-gray-300 mt-1">JPG · PNG · WebP · 最大10MB</p>
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
          <label className="block text-sm font-medium text-gray-600 mb-1">タイトル / Title</label>
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
          <label className="block text-sm font-medium text-gray-600 mb-1">説明文 / Description <span className="text-gray-300 font-normal">（任意）</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="作品の説明を入力してください..."
            className="w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#B8902A] transition-colors resize-none"
          />
        </div>

        {/* 価格・期間 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">開始価格 / Starting Price</label>
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
            <label className="block text-sm font-medium text-gray-600 mb-1">オークション期間</label>
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
            この作品は他サービスで未公開の、私が作成したAIアート作品であることに同意します
          </span>
        </label>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#2C2C2C] hover:bg-[#3C3C3C] disabled:bg-stone-200 text-white font-semibold py-4 rounded-xl transition-colors text-sm tracking-wide"
        >
          {submitting ? '出品中...' : '出品する / List Artwork'}
        </button>
      </form>
    </div>
  )
}
