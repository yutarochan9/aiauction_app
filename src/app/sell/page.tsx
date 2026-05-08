'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const DURATIONS = [
  { value: 1/60, labelKey: 'duration1m' },
  { value: 1, labelKey: 'duration1h' },
  { value: 6, labelKey: 'duration6h' },
  { value: 24, labelKey: 'duration24h' },
  { value: 72, labelKey: 'duration3d' },
  { value: 168, labelKey: 'duration7d' },
]

export default function SellPage() {
  const t = useTranslations('sell')
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    title_ja: '',
    title_en: '',
    description_ja: '',
    description_en: '',
    starting_price: '',
    duration: 24,
    agreed: false,
  })
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!file) return setError('画像を選択してください')
    if (!form.agreed) return setError('同意チェックが必要です')
    if (!form.title_ja || !form.title_en) return setError('タイトルを入力してください')
    if (!form.starting_price || Number(form.starting_price) <= 0) return setError('開始価格を入力してください')

    setSubmitting(true)

    try {
      // 画像をアップロード
      const uploadData = new FormData()
      uploadData.append('file', file)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadData })
      const uploadJson = await uploadRes.json()

      if (!uploadRes.ok) throw new Error(uploadJson.error)

      // オークション終了時刻
      const endAt = new Date(Date.now() + form.duration * 3600 * 1000).toISOString()

      // artworksテーブルに登録
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('ログインが必要です')

      const price = Number(form.starting_price)
      const { data, error: dbErr } = await supabase
        .from('artworks')
        .insert({
          user_id: user.id,
          title_ja: form.title_ja,
          title_en: form.title_en,
          description_ja: form.description_ja,
          description_en: form.description_en,
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
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">{t('title')}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 画像アップロード */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">{t('image')}</label>
          <div
            className="border-2 border-dashed border-stone-300 rounded-xl p-8 text-center cursor-pointer hover:border-[#B8902A] transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {preview ? (
              <img src={preview} alt="preview" className="max-h-64 mx-auto rounded-lg object-contain" />
            ) : (
              <div className="text-gray-400">
                <p className="text-4xl mb-2">🖼️</p>
                <p className="text-sm">{t('imageHint')}</p>
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('titleJa')}</label>
            <input
              type="text"
              value={form.title_ja}
              onChange={(e) => setForm({ ...form, title_ja: e.target.value })}
              className="w-full bg-stone-100 border border-stone-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:border-[#B8902A]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('titleEn')}</label>
            <input
              type="text"
              value={form.title_en}
              onChange={(e) => setForm({ ...form, title_en: e.target.value })}
              className="w-full bg-stone-100 border border-stone-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:border-[#B8902A]"
              required
            />
          </div>
        </div>

        {/* 説明文 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('descJa')}</label>
            <textarea
              value={form.description_ja}
              onChange={(e) => setForm({ ...form, description_ja: e.target.value })}
              rows={4}
              className="w-full bg-stone-100 border border-stone-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:border-[#B8902A] resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('descEn')}</label>
            <textarea
              value={form.description_en}
              onChange={(e) => setForm({ ...form, description_en: e.target.value })}
              rows={4}
              className="w-full bg-stone-100 border border-stone-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:border-[#B8902A] resize-none"
            />
          </div>
        </div>

        {/* 開始価格・期間 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('startingPrice')}</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-400">$</span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={form.starting_price}
                onChange={(e) => setForm({ ...form, starting_price: e.target.value })}
                className="w-full bg-stone-100 border border-stone-300 rounded-lg pl-8 pr-4 py-2 text-gray-900 focus:outline-none focus:border-[#B8902A]"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('duration')}</label>
            <select
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
              className="w-full bg-stone-100 border border-stone-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:border-[#B8902A]"
            >
              {DURATIONS.map(({ value, labelKey }) => (
                <option key={value} value={value}>{t(labelKey as any)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 同意チェック */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.agreed}
            onChange={(e) => setForm({ ...form, agreed: e.target.checked })}
            className="mt-1 w-4 h-4 accent-amber-600"
          />
          <span className="text-sm text-gray-400">{t('agreeCheck')}</span>
        </label>

        {/* エラー表示 */}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* 送信ボタン */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#2C2C2C] hover:bg-[#3C3C3C] disabled:bg-stone-200 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {submitting ? t('submitting') : t('submit')}
        </button>
      </form>
    </div>
  )
}
