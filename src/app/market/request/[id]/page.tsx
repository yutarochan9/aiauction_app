import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ApplyButton from './ApplyButton'
import SelectCreatorButton from './SelectCreatorButton'

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: req } = await supabase
    .from('requests')
    .select('*, users!requests_identity_holder_id_fkey(display_name, avatar_url, id)')
    .eq('id', id)
    .single()

  if (!req) notFound()

  const holder = req.users as any
  const isHolder = user?.id === req.identity_holder_id

  // 応募一覧取得
  const { data: applications } = await supabase
    .from('applications')
    .select('*, users!applications_creator_id_fkey(display_name, avatar_url, portfolio_url)')
    .eq('request_id', id)
    .order('created_at', { ascending: false })

  // 自分が既に応募済みか
  const myApplication = user ? applications?.find(a => a.creator_id === user.id) : null

  const STATUS_STYLES: Record<string, string> = {
    open:        'bg-green-100 text-green-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed:   'bg-stone-100 text-stone-500',
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-400">
        <Link href="/market/request" className="hover:text-gray-700">Request Market</Link>
        <span>/</span>
        <span className="text-gray-700 truncate">{req.title}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 依頼詳細 */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <div className="flex items-start gap-3 mb-4">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold shrink-0 mt-0.5 ${STATUS_STYLES[req.status] ?? 'bg-stone-100 text-stone-500'}`}>
                {req.status === 'open' ? 'Open' : req.status === 'in_progress' ? 'In Progress' : req.status}
              </span>
              <h1 className="text-xl font-bold text-gray-900">{req.title}</h1>
            </div>

            {req.description && (
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{req.description}</p>
            )}

            <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-stone-100 text-sm">
              {req.budget && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Budget</p>
                  <p className="font-semibold text-gray-900">${req.budget.toLocaleString()}</p>
                </div>
              )}
              {req.deadline && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Deadline</p>
                  <p className="font-semibold text-gray-900">{new Date(req.deadline).toLocaleDateString()}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Posted</p>
                <p className="font-semibold text-gray-900">{new Date(req.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* 応募フォーム（クリエイター向け・open状態のみ） */}
          {user && !isHolder && req.status === 'open' && (
            <ApplyButton requestId={id} existingApplication={myApplication} />
          )}
        </div>

        {/* サイドバー */}
        <div className="space-y-4">
          {/* 依頼主 */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <p className="text-xs text-gray-400 mb-3">Posted by</p>
            <Link href={`/profile/${holder?.id}`} className="flex items-center gap-3 hover:opacity-80">
              {holder?.avatar_url ? (
                <img src={holder.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-sm font-bold text-gray-500">
                  {holder?.display_name?.[0]}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-gray-900">{holder?.display_name}</p>
                <p className="text-xs text-gray-400">Identity Holder</p>
              </div>
            </Link>
          </div>

          {/* 応募一覧（依頼主のみ全員見える） */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <p className="text-xs text-gray-400 mb-3">
              Applications <span className="font-semibold text-gray-700">{applications?.length ?? 0}</span>
            </p>
            {applications && applications.length > 0 ? (
              <div className="space-y-3">
                {applications.map((app) => {
                  const creator = app.users as any
                  const isAccepted = app.status === 'accepted'
                  return (
                    <div key={app.id} className={`rounded-xl p-3 border ${isAccepted ? 'border-[#B8902A] bg-amber-50' : 'border-stone-100'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {creator?.avatar_url ? (
                          <img src={creator.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-gray-500">
                            {creator?.display_name?.[0]}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{creator?.display_name}</p>
                          {app.price && <p className="text-xs text-gray-400">${app.price}</p>}
                        </div>
                        {isAccepted && <span className="text-xs text-[#B8902A] font-semibold">Selected</span>}
                      </div>
                      {app.message && <p className="text-xs text-gray-500 line-clamp-2">{app.message}</p>}
                      {creator?.portfolio_url && (
                        <a href={creator.portfolio_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-[#B8902A] hover:underline mt-1 inline-block">
                          Portfolio →
                        </a>
                      )}
                      {isHolder && app.status === 'pending' && req.status === 'open' && (
                        <SelectCreatorButton
                          applicationId={app.id}
                          requestId={id}
                          creatorId={app.creator_id}
                          creatorName={creator?.display_name}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No applications yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
