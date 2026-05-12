'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const DURATIONS = [
  { value: 1/60, label: '1 min (test)' },
  { value: 1,    label: '1 hour' },
  { value: 6,    label: '6 hours' },
  { value: 24,   label: '24 hours' },
  { value: 72,   label: '3 days' },
  { value: 168,  label: '7 days' },
]

const FILE_FORMATS = [
  { value: 'image', label: 'Image', desc: 'JPG · PNG · WebP', accept: 'image/jpeg,image/png,image/webp', icon: '🖼️' },
  { value: 'video', label: 'Video', desc: 'MP4 · WebM', accept: 'video/mp4,video/webm', icon: '🎬' },
  { value: 'audio', label: 'Audio', desc: 'MP3 · WAV', accept: 'audio/mpeg,audio/wav', icon: '🎵' },
  { value: '3d',    label: '3D Model', desc: 'GLB · GLTF', accept: '.glb,.gltf', icon: '🧊' },
]

type HolderResult = { id: string; display_name: string; avatar_url: string | null }

export default function SellPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const thumbRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)

  const [fileFormat, setFileFormat] = useState('image')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startingPrice, setStartingPrice] = useState('')
  const [duration, setDuration] = useState(24)
  const [agreed, setAgreed] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [thumbPreview, setThumbPreview] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [scheduled, setScheduled] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('12:00')

  // Identity Holder 検索
  const [holderQuery, setHolderQuery] = useState('')
  const [holderResults, setHolderResults] = useState<HolderResult[]>([])
  const [selectedHolder, setSelectedHolder] = useState<HolderResult | null>(null)
  const [holderSearching, setHolderSearching] = useState(false)
  const [isSelfHolder, setIsSelfHolder] = useState(false)

  // 収益分配
  const [splitCreator, setSplitCreator] = useState(10)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/auth/login'); return }
    })
  }, [])

  const searchHolder = async (q: string) => {
    setHolderQuery(q)
    if (q.length < 2) { setHolderResults([]); return }
    setHolderSearching(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .ilike('display_name', `%${q}%`)
      .limit(5)
    setHolderResults(data ?? [])
    setHolderSearching(false)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (fileFormat === 'image') {
      setPreview(URL.createObjectURL(f))
    } else {
      setPreview(null)
    }
  }

  const handleThumbnail = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setThumbnail(f)
    setThumbPreview(URL.createObjectURL(f))
  }

  const addTag = (val: string) => {
    const t = val.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, '-')
    if (t && !tags.includes(t) && tags.length < 5) setTags([...tags, t])
    setTagInput('')
  }

  const removeTag = (t: string) => setTags(tags.filter(x => x !== t))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current) return
    setError('')

    if (!file) return setError('Please select a file')
    if (fileFormat !== 'image' && !thumbnail) return setError('Please upload a thumbnail image for non-image files')
    if (!agreed) return setError('Please agree to the terms')
    if (!title) return setError('Please enter a title')
    if (!startingPrice || Number(startingPrice) <= 0) return setError('Please enter a starting price')
    if (scheduled && !startDate) return setError('Please set a start date/time')
    if (scheduled && new Date(`${startDate}T${startTime}`) <= new Date()) return setError('Start time must be in the future')
    if (!isSelfHolder && !selectedHolder) return setError('Please select an identity holder or mark yourself')


    submittingRef.current = true
    setSubmitting(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Please log in')

      // メインファイルアップロード
      const uploadData = new FormData()
      uploadData.append('file', file)
      if (fileFormat !== 'image' && thumbnail) uploadData.append('thumbnail', thumbnail)
      uploadData.append('fileFormat', fileFormat)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadData })
      const uploadJson = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadJson.error)

      const startDateTime = scheduled ? new Date(`${startDate}T${startTime}`) : new Date()
      const endAt = new Date(startDateTime.getTime() + duration * 3600 * 1000).toISOString()
      const holderId = isSelfHolder ? user.id : (selectedHolder?.id ?? user.id)
      const splitHolder = 95 - splitCreator
      // 自分がholderも兼ねる場合はcreator splitなし
      const effectiveSplitCreator = holderId === user.id ? 0 : splitCreator
      const effectiveSplitHolder = 100 - 5 - effectiveSplitCreator

      const price = Number(startingPrice)
      const { data, error: dbErr } = await supabase
        .from('artworks')
        .insert({
          user_id: user.id,
          creator_id: user.id,
          identity_holder_id: holderId,
          title_ja: title,
          title_en: title,
          description_ja: description,
          description_en: description,
          image_url: uploadJson.imageUrl,
          original_storage_path: uploadJson.originalPath,
          file_format: fileFormat,
          starting_price: price,
          current_price: price,
          start_at: startDateTime.toISOString(),
          end_at: endAt,
          status: scheduled ? 'scheduled' : (holderId === user.id ? 'active' : 'pending_approval'),
          tags,
          revenue_split_creator: effectiveSplitCreator,
          revenue_split_holder: effectiveSplitHolder,
          agreement_status: holderId === user.id ? 'approved' : 'pending',
        })
        .select()
        .single()

      if (dbErr) throw dbErr

      // Identity Holderが別人の場合は合意レコードを作成
      if (holderId !== user.id) {
        await supabase.from('agreements').insert({
          artwork_id: data.id,
          creator_id: user.id,
          identity_holder_id: holderId,
          status: 'pending',
        })
        // 身元確認者に通知
        await supabase.from('notifications').insert({
          user_id: holderId,
          type: 'agreement_requested',
          title: 'Avatar approval request',
          body: `A creator is requesting your approval for "${title}". Please review and approve or request changes.`,
          url: `/agreement/${data.id}`,
        })
        router.push(`/agreement/${data.id}?submitted=1`)
      } else {
        router.push(`/auction/${data.id}`)
      }
    } catch (err: any) {
      setError(err.message ?? 'An error occurred')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const selectedFormat = FILE_FORMATS.find(f => f.value === fileFormat)!

  return (
    <div className="max-w-xl mx-auto py-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">List Avatar</h1>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ファイル形式選択 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">Content Type</label>
          <div className="grid grid-cols-4 gap-2">
            {FILE_FORMATS.map(fmt => (
              <button
                key={fmt.value}
                type="button"
                onClick={() => { setFileFormat(fmt.value); setFile(null); setPreview(null) }}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-colors ${
                  fileFormat === fmt.value
                    ? 'border-[#B8902A] bg-amber-50'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <span className="text-xl">{fmt.icon}</span>
                <span className={`text-xs font-semibold ${fileFormat === fmt.value ? 'text-[#B8902A]' : 'text-gray-700'}`}>{fmt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ファイルアップロード */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">
            {selectedFormat.label} File
            <span className="text-gray-300 font-normal ml-1">({selectedFormat.desc})</span>
          </label>
          <div
            className="border-2 border-dashed border-stone-300 rounded-xl p-8 text-center cursor-pointer hover:border-[#B8902A] transition-colors bg-white"
            onClick={() => fileRef.current?.click()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) { setFile(f); fileFormat === 'image' && setPreview(URL.createObjectURL(f)) } }}
            onDragOver={e => e.preventDefault()}
          >
            {fileFormat === 'image' && preview ? (
              <img src={preview} alt="preview" className="max-h-64 mx-auto rounded-lg object-contain" />
            ) : file ? (
              <div className="text-gray-600">
                <p className="text-2xl mb-2">{selectedFormat.icon}</p>
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-gray-400 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            ) : (
              <div className="text-gray-400">
                <p className="text-3xl mb-3">{selectedFormat.icon}</p>
                <p className="text-sm">Click or drag & drop to upload</p>
                <p className="text-xs text-gray-300 mt-1">{selectedFormat.desc} · Max {fileFormat === 'image' ? '10MB' : '50MB'}</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept={selectedFormat.accept} className="hidden" onChange={handleFile} />
        </div>

        {/* 非画像の場合はサムネイル */}
        {fileFormat !== 'image' && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Thumbnail Image <span className="text-red-400">*</span></label>
            <div
              className="border-2 border-dashed border-stone-300 rounded-xl p-6 text-center cursor-pointer hover:border-[#B8902A] transition-colors bg-white"
              onClick={() => thumbRef.current?.click()}
            >
              {thumbPreview ? (
                <img src={thumbPreview} alt="thumbnail" className="max-h-32 mx-auto rounded-lg object-contain" />
              ) : (
                <div className="text-gray-400">
                  <p className="text-sm">Upload a preview image for your {selectedFormat.label}</p>
                  <p className="text-xs text-gray-300 mt-1">JPG · PNG · WebP</p>
                </div>
              )}
            </div>
            <input ref={thumbRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleThumbnail} />
          </div>
        )}

        {/* タイトル */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Cyberpunk Avatar Vol.1"
            className="w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#B8902A] transition-colors"
            required
          />
        </div>

        {/* 説明文 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Description <span className="text-gray-300 font-normal">(optional)</span></label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            placeholder="Describe your avatar, tools used, usage rights..."
            className="w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#B8902A] transition-colors resize-none"
          />
        </div>

        {/* タグ */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Tags <span className="text-gray-300 font-normal">(up to 5)</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map(t => (
              <span key={t} className="flex items-center gap-1 bg-stone-100 text-gray-600 text-xs px-3 py-1.5 rounded-full">
                #{t}
                <button type="button" onClick={() => removeTag(t)} className="text-gray-400 hover:text-gray-600">×</button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) } }}
            onBlur={() => { if (tagInput) addTag(tagInput) }}
            placeholder="e.g. heygen, voice, 3d"
            disabled={tags.length >= 5}
            className="w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#B8902A] transition-colors text-sm disabled:bg-stone-50"
          />
        </div>

        {/* Identity Holder */}
        <div className="border border-stone-200 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Identity Holder</p>
            <p className="text-xs text-gray-400 mt-0.5">The person whose face, voice, or character is featured in this avatar</p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isSelfHolder}
              onChange={e => { setIsSelfHolder(e.target.checked); setSelectedHolder(null); setHolderQuery(''); setHolderResults([]) }}
              className="w-4 h-4 accent-[#B8902A]"
            />
            <span className="text-sm text-gray-600">I am the identity holder (no approval needed)</span>
          </label>

          {!isSelfHolder && (
            <div className="relative">
              <input
                type="text"
                value={selectedHolder ? selectedHolder.display_name : holderQuery}
                onChange={e => { setSelectedHolder(null); searchHolder(e.target.value) }}
                placeholder="Search by display name..."
                className="w-full bg-white border border-stone-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#B8902A]"
              />
              {holderResults.length > 0 && !selectedHolder && (
                <div className="absolute z-10 mt-1 w-full bg-white rounded-xl border border-stone-200 shadow-lg overflow-hidden">
                  {holderResults.map(h => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => { setSelectedHolder(h); setHolderResults([]); setHolderQuery(h.display_name) }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 text-left"
                    >
                      {h.avatar_url ? (
                        <img src={h.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-gray-500">
                          {h.display_name?.[0]}
                        </div>
                      )}
                      <span className="text-sm text-gray-900">{h.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedHolder && (
                <div className="mt-2 flex items-center gap-2 bg-amber-50 border border-[#B8902A] rounded-xl px-4 py-2.5">
                  {selectedHolder.avatar_url ? (
                    <img src={selectedHolder.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-gray-500">
                      {selectedHolder.display_name?.[0]}
                    </div>
                  )}
                  <span className="text-sm text-[#B8902A] font-medium">{selectedHolder.display_name}</span>
                  <button type="button" onClick={() => { setSelectedHolder(null); setHolderQuery('') }} className="ml-auto text-gray-400 hover:text-gray-600 text-xs">✕ Change</button>
                </div>
              )}
            </div>
          )}

          {/* 収益分配（別人がholderの場合） */}
          {!isSelfHolder && selectedHolder && (
            <div className="pt-2 border-t border-stone-100">
              <p className="text-xs font-medium text-gray-600 mb-3">Revenue Split</p>
              <div className="space-y-2 text-xs text-gray-500">
                <div className="flex justify-between items-center">
                  <span>AIAII platform fee</span>
                  <span className="font-semibold text-gray-700">5%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Creator (you)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={5}
                      max={40}
                      step={5}
                      value={splitCreator}
                      onChange={e => setSplitCreator(Number(e.target.value))}
                      className="w-24 accent-[#B8902A]"
                    />
                    <span className="font-semibold text-gray-700 w-8 text-right">{splitCreator}%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span>Identity Holder ({selectedHolder.display_name})</span>
                  <span className="font-semibold text-[#B8902A]">{95 - splitCreator}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 価格・期間 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Start Price (USD)</label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={startingPrice}
                onChange={e => setStartingPrice(e.target.value)}
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
              onChange={e => setDuration(Number(e.target.value))}
              className="w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-[#B8902A] transition-colors"
            >
              {DURATIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 予約投稿 */}
        <div className="border border-stone-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Schedule Auction</p>
              <p className="text-xs text-gray-400 mt-0.5">Set a future date to start the auction</p>
            </div>
            <button
              type="button"
              onClick={() => setScheduled(!scheduled)}
              role="switch"
              aria-checked={scheduled}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${scheduled ? 'bg-[#B8902A]' : 'bg-stone-200'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${scheduled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {scheduled && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date <span className="text-gray-300">(YYYY-MM-DD)</span></label>
                <input
                  type="text"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  placeholder={new Date().toISOString().slice(0, 10)}
                  pattern="\d{4}-\d{2}-\d{2}"
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#B8902A] transition-colors text-sm"
                  required={scheduled}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Time <span className="text-gray-300">(HH:MM)</span></label>
                <input
                  type="text"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  placeholder="12:00"
                  pattern="\d{2}:\d{2}"
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#B8902A] transition-colors text-sm"
                  required={scheduled}
                />
              </div>
            </div>
          )}
        </div>

        {/* 同意 */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#B8902A]"
          />
          <span className="text-sm text-gray-500 leading-relaxed">
            I confirm I have the rights to sell this content and it has not been published elsewhere without permission
          </span>
        </label>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {!isSelfHolder && selectedHolder && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            After listing, <strong>{selectedHolder.display_name}</strong> will need to approve this avatar before it goes live at auction.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#2C2C2C] hover:bg-[#3C3C3C] disabled:bg-stone-200 text-white font-semibold py-4 rounded-xl transition-colors text-sm tracking-wide"
        >
          {submitting
            ? 'Submitting...'
            : !isSelfHolder && selectedHolder
            ? 'Submit for Approval'
            : scheduled
            ? 'Schedule Auction'
            : 'List Avatar'}
        </button>
      </form>
    </div>
  )
}
