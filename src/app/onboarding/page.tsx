'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DOCUMENT_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'national_id', label: 'National ID' },
]

type Step = 1 | 2

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [userId, setUserId] = useState<string | null>(null)

  // Step 1 - Profile
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string>('')
  const avatarRef = useRef<HTMLInputElement>(null)

  // Step 2 - Identity
  const [fullName, setFullName] = useState('')
  const [documentType, setDocumentType] = useState('passport')
  const [frontFile, setFrontFile] = useState<File | null>(null)
  const [backFile, setBackFile] = useState<File | null>(null)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [agreed, setAgreed] = useState(false)
  const frontRef = useRef<HTMLInputElement>(null)
  const backRef = useRef<HTMLInputElement>(null)
  const selfieRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/auth/login'); return }
      // 既にオンボーディング済みならホームへ
      const { data: vr } = await supabase
        .from('identity_verifications')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle()
      if (vr) { router.replace('/'); return }
      setUserId(data.user.id)
    })
  }, [router])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setUploadingAvatar(true)
    const supabase = createClient()
    const path = `${userId}/avatar_${Date.now()}.webp`
    const { error } = await supabase.storage.from('artwork-previews').upload(path, file, { contentType: file.type, upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('artwork-previews').getPublicUrl(path)
      setUploadedAvatarUrl(data.publicUrl)
    }
    setUploadingAvatar(false)
  }

  const handleStep1Next = async () => {
    setError('')
    if (!displayName.trim()) { setError('Please enter your display name.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName.trim(),
          bio,
          avatar_url: uploadedAvatarUrl,
          sns_url: '',
          portfolio_url: '',
        }),
      })
      if (!res.ok) throw new Error('Failed to save profile')
      setStep(2)
    } catch {
      setError('Failed to save profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (f: File | null) => void
  ) => {
    const file = e.target.files?.[0] ?? null
    if (file) {
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        setError('Only JPG and PNG files are accepted.')
        e.target.value = ''
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be under 10MB.')
        e.target.value = ''
        return
      }
      setError('')
    }
    setter(file)
  }

  const handleStep2Submit = async () => {
    setError('')
    if (!fullName.trim()) { setError('Full name is required.'); return }
    if (!frontFile) { setError('Front image of your document is required.'); return }
    if (!selfieFile) { setError('Selfie photo is required.'); return }
    if (!agreed) { setError('Please confirm the declaration.'); return }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('full_name', fullName.trim())
      formData.append('document_type', documentType)
      formData.append('front', frontFile)
      if (backFile) formData.append('back', backFile)
      formData.append('selfie', selfieFile)

      const res = await fetch('/api/verify/submit', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Submission failed')
      router.push('/?onboarded=1')
    } catch (err: any) {
      setError(err.message ?? 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#B8902A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* ステップインジケーター */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors ${
                step === s ? 'bg-[#B8902A] text-white' :
                step > s ? 'bg-green-500 text-white' :
                'bg-stone-200 text-gray-400'
              }`}>
                {step > s ? '✓' : s}
              </div>
              <span className={`text-sm font-medium ${step === s ? 'text-gray-900' : 'text-gray-400'}`}>
                {s === 1 ? 'Profile' : 'Identity'}
              </span>
              {s < 2 && <div className="w-8 h-px bg-stone-300" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-[#B8902A] to-[#d4a843] px-8 py-6">
            <h1 className="text-2xl font-bold text-white">
              {step === 1 ? 'Set Up Your Profile' : 'Verify Your Identity'}
            </h1>
            <p className="text-white/80 text-sm mt-1">
              {step === 1
                ? 'Tell others who you are on AIAII.'
                : 'Submit a government-issued ID to complete registration.'}
            </p>
          </div>

          <div className="px-8 py-6 space-y-5">
            {step === 1 ? (
              <>
                {/* アバター */}
                <div className="flex flex-col items-center gap-3">
                  <div
                    onClick={() => avatarRef.current?.click()}
                    className="w-20 h-20 rounded-full overflow-hidden bg-stone-100 border-2 border-dashed border-stone-300 hover:border-[#B8902A] cursor-pointer flex items-center justify-center transition-colors"
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                  <button type="button" onClick={() => avatarRef.current?.click()} className="text-xs text-[#B8902A] hover:underline">
                    {uploadingAvatar ? 'Uploading...' : avatarPreview ? 'Change photo' : 'Add profile photo'}
                  </button>
                  <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>

                {/* 表示名 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Display Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Your name or username"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#B8902A] focus:ring-1 focus:ring-[#B8902A]"
                  />
                </div>

                {/* 自己紹介 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Bio <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    rows={3}
                    placeholder="Tell people about yourself..."
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#B8902A] focus:ring-1 focus:ring-[#B8902A] resize-none"
                  />
                </div>
              </>
            ) : (
              <>
                {/* 氏名 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Full Name on ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="As shown on your ID document"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#B8902A] focus:ring-1 focus:ring-[#B8902A]"
                  />
                </div>

                {/* 書類種別 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Document Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={documentType}
                    onChange={e => setDocumentType(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#B8902A] bg-white"
                  >
                    {DOCUMENT_TYPES.map(dt => (
                      <option key={dt.value} value={dt.value}>{dt.label}</option>
                    ))}
                  </select>
                </div>

                {/* 書類画像 */}
                <FileField label="Document Front" required file={frontFile} inputRef={frontRef}
                  onChange={e => handleFileChange(e, setFrontFile)}
                  onClear={() => { setFrontFile(null); if (frontRef.current) frontRef.current.value = '' }} />
                <FileField label="Document Back" required={false} file={backFile} inputRef={backRef}
                  onChange={e => handleFileChange(e, setBackFile)}
                  onClear={() => { setBackFile(null); if (backRef.current) backRef.current.value = '' }} />
                <FileField label="Selfie with Document" required file={selfieFile} inputRef={selfieRef}
                  onChange={e => handleFileChange(e, setSelfieFile)}
                  onClear={() => { setSelfieFile(null); if (selfieRef.current) selfieRef.current.value = '' }} />

                {/* 同意 */}
                <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-4">
                  <input id="agree" type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#B8902A] cursor-pointer flex-shrink-0" />
                  <label htmlFor="agree" className="text-sm text-gray-700 cursor-pointer leading-snug">
                    I confirm this is a real government-issued ID and the face shown is my own.
                  </label>
                </div>
              </>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <button
              onClick={step === 1 ? handleStep1Next : handleStep2Submit}
              disabled={loading || uploadingAvatar}
              className="w-full bg-[#B8902A] hover:bg-[#9a7a24] disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {step === 1 ? 'Saving...' : 'Submitting...'}
                </span>
              ) : step === 1 ? 'Next →' : 'Submit for Verification'}
            </button>

            {step === 2 && (
              <p className="text-xs text-gray-400 text-center">
                Your documents are stored securely and only reviewed by authorized staff.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FileField({
  label, required, file, inputRef, onChange, onClear,
}: {
  label: string; required: boolean; file: File | null
  inputRef: React.RefObject<HTMLInputElement | null>
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label} {required ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(optional)</span>}
      </label>
      {file ? (
        <div className="flex items-center gap-3 border border-[#B8902A] bg-amber-50 rounded-lg px-4 py-2.5">
          <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
          <button type="button" onClick={onClear} className="text-xs text-gray-400 hover:text-red-500">Remove</button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-[#B8902A] rounded-lg px-4 py-5 cursor-pointer transition-colors group">
          <svg className="w-7 h-7 text-gray-300 group-hover:text-[#B8902A] mb-1 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-sm text-gray-500 group-hover:text-[#B8902A] transition-colors">Click to upload</span>
          <span className="text-xs text-gray-400 mt-0.5">JPG or PNG, max 10MB</span>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png" onChange={onChange} className="hidden" />
        </label>
      )}
    </div>
  )
}
