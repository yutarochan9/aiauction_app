import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function RequestMarketPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: requests } = await supabase
    .from('requests')
    .select('*, users!requests_identity_holder_id_fkey(display_name, avatar_url)')
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: false })

  const STATUS_STYLES: Record<string, string> = {
    open:        'bg-green-100 text-green-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed:   'bg-stone-100 text-stone-500',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Request Market</h1>
          <p className="text-sm text-gray-400 mt-1">Identity holders post requests · Creators apply with portfolios</p>
        </div>
        {user && (
          <Link
            href="/market/request/new"
            className="bg-[#2C2C2C] hover:bg-[#3C3C3C] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            + Post Request
          </Link>
        )}
      </div>

      {!requests || requests.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <p className="text-lg mb-2">No requests yet</p>
          <p className="text-sm">Be the first to post an avatar creation request</p>
          {user && (
            <Link href="/market/request/new" className="inline-block mt-4 text-[#B8902A] hover:underline text-sm">
              Post a Request →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const holder = req.users as any
            return (
              <Link
                key={req.id}
                href={`/market/request/${req.id}`}
                className="block bg-white border border-stone-200 hover:border-[#B8902A] rounded-2xl p-5 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${STATUS_STYLES[req.status] ?? 'bg-stone-100 text-stone-500'}`}>
                        {req.status === 'open' ? 'Open' : req.status === 'in_progress' ? 'In Progress' : req.status}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-gray-900 truncate">{req.title}</h2>
                    {req.description && (
                      <p className="text-sm text-gray-400 mt-1 line-clamp-2">{req.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 flex-wrap">
                      {req.budget && (
                        <span className="flex items-center gap-1">
                          <span className="text-gray-600 font-semibold">${req.budget.toLocaleString()}</span> budget
                        </span>
                      )}
                      {req.deadline && (
                        <span>Deadline: <span className="text-gray-600">{new Date(req.deadline).toLocaleDateString()}</span></span>
                      )}
                      <span>{new Date(req.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {holder?.avatar_url ? (
                      <img src={holder.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-gray-500">
                        {holder?.display_name?.[0]}
                      </div>
                    )}
                    <span className="text-xs text-gray-500 hidden sm:block">{holder?.display_name}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
