'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type VerificationStatus = 'none' | 'pending' | 'in_review' | 'verified' | 'rejected'

type VerificationRecord = {
  status: VerificationStatus
  full_name: string | null
  submitted_at: string | null
  note: string | null
}

const DOCUMENT_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'national_id', label: 'National ID' },
]

export default function VerifyPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [verification, setVerification] = useState<VerificationRecord | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // Form state
  const [fullName, setFullName] = useState('')
  const [documentType, setDocumentType] = useState('passport')
  const [frontFile, setFrontFile] = useState<File | null>(null)
  const [backFile, setBackFile] = useState<File | null>(null)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const frontRef = useRef<HTMLInputElement>(null)
  const backRef = useRef<HTMLInputElement>(null)
  const selfieRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/auth/login')
        return
      }
      // Fetch existing verification record
      supabase
        .from('identity_verifications')
        .select('status, full_name, submitted_at, note')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          setVerification(data as VerificationRecord | null)
          setAuthChecked(true)
        })
    })
  }, [router])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

      const res = await fetch('/api/verify/submit', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Submission failed. Please try again.')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-[#B8902A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Verified
  if (verification?.status === 'verified') {
    return <StatusCard icon="✓" color="green" title="Identity Verified" message="Your identity has been successfully verified. You have full access to all platform features." />
  }

  // Pending / In Review
  if (!submitted && (verification?.status === 'pending' || verification?.status === 'in_review')) {
    return (
      <StatusCard
        icon="⏳"
        color="gold"
        title="Under Review"
        message="Your identity documents have been submitted and are currently being reviewed. This typically takes 1–3 business days. We'll notify you once the review is complete."
        sub={verification.submitted_at ? `Submitted: ${new Date(verification.submitted_at).toLocaleDateString()}` : undefined}
      />
    )
  }

  // Submitted just now
  if (submitted) {
    return <StatusCard icon="📋" color="gold" title="Submission Received" message="Thank you! Your documents are now under review. This typically takes 1–3 business days. We'll notify you once the review is complete." />
  }

  // Rejected — allow resubmission
  const isRejected = verification?.status === 'rejected'

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#B8902A] to-[#d4a843] px-8 py-6">
            <h1 className="text-2xl font-bold text-white">Identity Verification</h1>
            <p className="text-white/80 text-sm mt-1">
              Please submit a government-issued ID to verify your identity.
            </p>
          </div>

          {isRejected && (
            <div className="mx-8 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 font-medium text-sm">Your previous submission was not approved.</p>
              {verification?.note && (
                <p className="text-red-600 text-sm mt-1">{verification.note}</p>
              )}
              <p className="text-red-600 text-sm mt-1">Please resubmit with correct documents.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-6">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="As shown on your ID document"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#B8902A] focus:ring-1 focus:ring-[#B8902A]"
              />
            </div>

            {/* Document Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Document Type <span className="text-red-500">*</span>
              </label>
              <select
                value={documentType}
                onChange={e => setDocumentType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#B8902A] focus:ring-1 focus:ring-[#B8902A] bg-white"
              >
                {DOCUMENT_TYPES.map(dt => (
                  <option key={dt.value} value={dt.value}>{dt.label}</option>
                ))}
              </select>
            </div>

            {/* Document Front */}
            <FileUploadField
              label="Document Front"
              required
              description="Clear photo of the front side of your ID"
              file={frontFile}
              inputRef={frontRef}
              onChange={e => handleFileChange(e, setFrontFile)}
              onClear={() => { setFrontFile(null); if (frontRef.current) frontRef.current.value = '' }}
            />

            {/* Document Back */}
            <FileUploadField
              label="Document Back"
              required={false}
              description="Back side of your ID (optional for passports)"
              file={backFile}
              inputRef={backRef}
              onChange={e => handleFileChange(e, setBackFile)}
              onClear={() => { setBackFile(null); if (backRef.current) backRef.current.value = '' }}
            />

            {/* Selfie */}
            <FileUploadField
              label="Selfie with Document"
              required
              description="Photo of yourself holding your ID next to your face"
              file={selfieFile}
              inputRef={selfieRef}
              onChange={e => handleFileChange(e, setSelfieFile)}
              onClear={() => { setSelfieFile(null); if (selfieRef.current) selfieRef.current.value = '' }}
            />

            {/* Agreement */}
            <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-4">
              <input
                id="agree"
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#B8902A] cursor-pointer flex-shrink-0"
              />
              <label htmlFor="agree" className="text-sm text-gray-700 cursor-pointer leading-snug">
                I confirm this is a real government-issued ID and the face shown is my own.
              </label>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#B8902A] hover:bg-[#a07820] disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading…
                </span>
              ) : (
                'Submit for Verification'
              )}
            </button>

            <p className="text-xs text-gray-400 text-center">
              Your documents are stored securely and only reviewed by authorized staff.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

// ---- Sub-components ----

function FileUploadField({
  label,
  required,
  description,
  file,
  inputRef,
  onChange,
  onClear,
}: {
  label: string
  required: boolean
  description: string
  file: File | null
  inputRef: React.RefObject<HTMLInputElement | null>
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
        {!required && <span className="text-gray-400 font-normal"> (optional)</span>}
      </label>
      <p className="text-xs text-gray-500 mb-2">{description}</p>
      {file ? (
        <div className="flex items-center gap-3 border border-[#B8902A] bg-amber-50 rounded-lg px-4 py-2.5">
          <svg className="w-4 h-4 text-[#B8902A] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
          <button
            type="button"
            onClick={onClear}
            className="text-gray-400 hover:text-red-500 transition-colors text-xs flex-shrink-0"
          >
            Remove
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-[#B8902A] rounded-lg px-4 py-6 cursor-pointer transition-colors group">
          <svg className="w-8 h-8 text-gray-300 group-hover:text-[#B8902A] mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-sm text-gray-500 group-hover:text-[#B8902A] transition-colors">Click to upload</span>
          <span className="text-xs text-gray-400 mt-1">JPG or PNG, max 10MB</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={onChange}
            className="hidden"
          />
        </label>
      )}
    </div>
  )
}

function StatusCard({
  icon,
  color,
  title,
  message,
  sub,
}: {
  icon: string
  color: 'green' | 'gold'
  title: string
  message: string
  sub?: string
}) {
  const ringColor = color === 'green' ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
  const iconBg = color === 'green' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-[#B8902A]'
  const titleColor = color === 'green' ? 'text-green-800' : 'text-[#B8902A]'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className={`max-w-md w-full bg-white border-2 ${ringColor} rounded-2xl shadow-lg p-8 text-center`}>
        <div className={`w-16 h-16 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-4 text-2xl`}>
          {icon}
        </div>
        <h2 className={`text-xl font-bold ${titleColor} mb-3`}>{title}</h2>
        <p className="text-gray-600 text-sm leading-relaxed">{message}</p>
        {sub && <p className="text-gray-400 text-xs mt-3">{sub}</p>}
      </div>
    </div>
  )
}
