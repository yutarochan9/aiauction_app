import { notFound } from 'next/navigation'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import VerifyActions from './VerifyActions'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type VerificationRow = {
  id: string
  user_id: string
  status: string
  full_name: string | null
  document_type: string | null
  submitted_at: string | null
  document_front_path: string | null
  document_back_path: string | null
  selfie_path: string | null
  // Supabase の join は配列で返るため配列として定義
  users: {
    display_name: string | null
    email: string | null
    avatar_url: string | null
  }[] | null
}

async function getSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  const { data } = await supabaseAdmin.storage
    .from('identity-docs')
    .createSignedUrl(path, 1800)
  return data?.signedUrl ?? null
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  passport: 'Passport',
  drivers_license: "Driver's License",
  national_id: 'National ID',
}

export default async function AdminVerificationsPage() {
  // 管理者チェック
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean)

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !adminEmails.includes(user.email ?? '')) {
    notFound()
  }

  // pending / in_review のレコードを取得
  const { data: verifications, error } = await supabaseAdmin
    .from('identity_verifications')
    .select(`
      id,
      user_id,
      status,
      full_name,
      document_type,
      submitted_at,
      document_front_path,
      document_back_path,
      selfie_path,
      users (
        display_name,
        email,
        avatar_url
      )
    `)
    .in('status', ['pending', 'in_review'])
    .order('submitted_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch verifications:', error)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (verifications ?? []) as unknown as VerificationRow[]

  // 署名付きURLをまとめて生成
  const signedUrlsMap = await Promise.all(
    rows.map(async row => ({
      id: row.id,
      front: await getSignedUrl(row.document_front_path),
      back: await getSignedUrl(row.document_back_path),
      selfie: await getSignedUrl(row.selfie_path),
    }))
  )
  const signedUrls = Object.fromEntries(signedUrlsMap.map(u => [u.id, u]))

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#B8902A] rounded-full" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Admin</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Identity Verification Queue</h1>
          <span className="ml-auto inline-flex items-center justify-center min-w-[2rem] h-6 px-2 bg-[#B8902A] text-white text-xs font-bold rounded-full">
            {rows.length}
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {rows.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">No pending verifications</p>
            <p className="text-gray-400 text-sm mt-1">All submissions have been reviewed.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {rows.map(row => {
              const urls = signedUrls[row.id]
              const docLabel = row.document_type
                ? (DOCUMENT_TYPE_LABELS[row.document_type] ?? row.document_type)
                : '—'
              const submittedDate = row.submitted_at
                ? new Date(row.submitted_at).toLocaleString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })
                : '—'
              const statusColor =
                row.status === 'in_review'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-amber-100 text-amber-700'

              return (
                <div key={row.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Card header */}
                  <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 bg-gray-50">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                      {row.users?.[0]?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.users?.[0]?.avatar_url ?? ''}
                          alt={row.users?.[0]?.display_name ?? 'User'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-bold">
                          {(row.users?.[0]?.display_name ?? row.users?.[0]?.email ?? '?')[0].toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {row.users?.[0]?.display_name ?? '(No display name)'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{row.users?.[0]?.email ?? '—'}</p>
                    </div>

                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>
                      {row.status === 'in_review' ? 'In Review' : 'Pending'}
                    </span>
                  </div>

                  {/* Card body */}
                  <div className="px-6 py-5 space-y-5">
                    {/* Meta info */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Submitted</p>
                        <p className="text-sm text-gray-700">{submittedDate}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Document Type</p>
                        <p className="text-sm text-gray-700">{docLabel}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Full Name on ID</p>
                        <p className="text-sm text-gray-700">{row.full_name ?? '—'}</p>
                      </div>
                    </div>

                    {/* Document images */}
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">Document Images</p>
                      <div className="flex flex-wrap gap-3">
                        {urls?.front ? (
                          <a
                            href={urls.front}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-xs text-gray-700 font-medium transition-colors"
                          >
                            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Front
                            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1.5 bg-gray-50 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400">
                            Front — not uploaded
                          </span>
                        )}

                        {urls?.back ? (
                          <a
                            href={urls.back}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-xs text-gray-700 font-medium transition-colors"
                          >
                            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Back
                            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1.5 bg-gray-50 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400">
                            Back — not uploaded
                          </span>
                        )}

                        {urls?.selfie ? (
                          <a
                            href={urls.selfie}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-xs text-gray-700 font-medium transition-colors"
                          >
                            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Selfie
                            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1.5 bg-gray-50 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400">
                            Selfie — not uploaded
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-100" />

                    {/* Actions */}
                    <VerifyActions verificationId={row.id} userId={row.user_id} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
