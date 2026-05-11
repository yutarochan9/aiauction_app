import { createClient } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ArtworkCard from '@/components/ArtworkCard'

type Tab = 'bidding' | 'selling' | 'won' | 'liked' | 'following' | 'approvals'

const TABS: { key: Tab; label: string }[] = [
  { key: 'bidding',   label: 'Bidding' },
  { key: 'selling',   label: 'Selling' },
  { key: 'won',       label: 'Won' },
  { key: 'liked',     label: 'Liked' },
  { key: 'following', label: 'Following' },
  { key: 'approvals', label: 'Approvals' },
]

const EMPTY: Record<Tab, string> = {
  bidding:   "You're not bidding on anything right now",
  selling:   'No listings yet',
  won:       'No won items yet',
  liked:     'No liked artworks yet',
  following: "Follow artists to see their new listings here",
  approvals: 'No avatars pending your approval',
}

export default async function MyPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab: tabParam } = await searchParams
  const tab = (TABS.find(t => t.key === tabParam)?.key ?? 'bidding') as Tab

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const locale = await getLocale()
  const now = new Date().toISOString()

  // アナリティクスデータ取得
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const [
    { data: salesData },
    { data: myArtworks },
    { count: totalBidsReceived },
  ] = await Promise.all([
    supabase.from('purchases').select('amount, created_at').eq('seller_id', user.id),
    supabase.from('artworks').select('status, end_at, view_count').eq('user_id', user.id),
    supabase.from('bids').select('*', { count: 'exact', head: true }).in(
      'artwork_id',
      await supabase.from('artworks').select('id').eq('user_id', user.id).then(r => r.data?.map(a => a.id) ?? [])
    ),
  ])

  const totalRevenue = salesData?.reduce((s, p) => s + (p.amount ?? 0), 0) ?? 0
  const totalSales = salesData?.length ?? 0
  const avgSalePrice = totalSales > 0 ? totalRevenue / totalSales : 0
  const activeListings = myArtworks?.filter(a => a.status === 'active' && new Date(a.end_at) > new Date()).length ?? 0
  const totalViews = myArtworks?.reduce((s, a) => s + (a.view_count ?? 0), 0) ?? 0

  // 30日間の日別売上
  const dailyRevenue: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000)
    dailyRevenue[d.toISOString().slice(0, 10)] = 0
  }
  salesData?.forEach(p => {
    const day = p.created_at?.slice(0, 10)
    if (day && day in dailyRevenue) dailyRevenue[day] += p.amount ?? 0
  })
  const chartDays = Object.entries(dailyRevenue)
  const maxRevenue = Math.max(...chartDays.map(([, v]) => v), 1)

  let artworks: any[] = []

  if (tab === 'bidding') {
    // 自分が入札中のアクティブなオークション
    const { data: myBids } = await supabase
      .from('bids')
      .select('artwork_id')
      .eq('user_id', user.id)
    const artworkIds = [...new Set(myBids?.map(b => b.artwork_id) ?? [])]
    if (artworkIds.length > 0) {
      const { data } = await supabase
        .from('artworks')
        .select('*, bids(count), likes(count)')
        .in('id', artworkIds)
        .eq('status', 'active')
        .gt('end_at', now)
        .order('end_at', { ascending: true })
      artworks = data ?? []
    }

  } else if (tab === 'selling') {
    const { data } = await supabase
      .from('artworks')
      .select('*, bids(count), likes(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    artworks = data ?? []

  } else if (tab === 'won') {
    const { data: purchases } = await supabase
      .from('purchases')
      .select('artwork_id, artworks(*, bids(count), likes(count))')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
    artworks = purchases?.map(p => p.artworks).filter(Boolean) ?? []

  } else if (tab === 'liked') {
    const { data: likes } = await supabase
      .from('likes')
      .select('artwork_id, artworks(*, bids(count), likes(count))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    artworks = likes?.map(l => l.artworks).filter(Boolean) ?? []

  } else if (tab === 'following') {
    const { data: followList } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
    const sellerIds = followList?.map(f => f.following_id) ?? []
    if (sellerIds.length > 0) {
      const { data } = await supabase
        .from('artworks')
        .select('*, bids(count), likes(count)')
        .in('user_id', sellerIds)
        .in('status', ['active', 'scheduled'])
        .order('created_at', { ascending: false })
      artworks = data ?? []
    }
  } else if (tab === 'approvals') {
    // 自分がIdentity Holderで承認待ちのアバター
    const { data } = await supabase
      .from('artworks')
      .select('*, bids(count), likes(count)')
      .eq('identity_holder_id', user.id)
      .eq('agreement_status', 'pending')
      .neq('creator_id', user.id)
      .order('created_at', { ascending: false })
    artworks = data ?? []
  }

  // ハートボタン表示用のいいね済みIDセット
  const { data: myLikes } = await supabase
    .from('likes')
    .select('artwork_id')
    .eq('user_id', user.id)
  const likedIds = new Set(myLikes?.map(l => l.artwork_id) ?? [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Page</h1>
        <Link href="/settings" className="text-xs text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </Link>
      </div>

      {/* アナリティクス */}
      <div className="mb-8 space-y-4">
        {/* 統計カード */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, gold: true },
            { label: 'Sales', value: totalSales.toString() },
            { label: 'Avg Sale Price', value: totalSales > 0 ? `$${avgSalePrice.toFixed(0)}` : '—' },
            { label: 'Active Listings', value: activeListings.toString() },
            { label: 'Total Views', value: totalViews.toLocaleString() },
          ].map(({ label, value, gold }) => (
            <div key={label} className="bg-white rounded-xl border border-stone-200 p-4">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className={`text-xl font-bold ${gold ? 'text-[#B8902A]' : 'text-gray-900'}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* 売上グラフ（30日間） */}
        {totalSales > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <p className="text-xs text-gray-400 mb-4">Revenue — Last 30 days</p>
            <div className="flex items-end gap-px h-16">
              {chartDays.map(([day, val]) => (
                <div
                  key={day}
                  className="flex-1 transition-all"
                  style={{
                    height: `${Math.max((val / maxRevenue) * 100, val > 0 ? 8 : 2)}%`,
                    background: val > 0 ? '#B8902A' : '#e7e5e4',
                    opacity: val > 0 ? 1 : 0.4,
                  }}
                  title={`${day}: $${val}`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-300">{chartDays[0]?.[0]?.slice(5)}</span>
              <span className="text-[10px] text-gray-300">{chartDays[chartDays.length - 1]?.[0]?.slice(5)}</span>
            </div>
          </div>
        )}
      </div>

      {/* タブ */}
      <div className="flex gap-0 mb-8 border-b border-stone-200">
        {TABS.map(({ key, label }) => (
          <Link
            key={key}
            href={`/mypage?tab=${key}`}
            className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              tab === key
                ? 'border-[#B8902A] text-[#B8902A]'
                : 'border-transparent text-gray-400 hover:text-gray-900'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* コンテンツ */}
      {artworks.length === 0 ? (
        <div className="text-center py-24 text-gray-400">{EMPTY[tab]}</div>
      ) : tab === 'approvals' ? (
        <div className="space-y-3">
          {artworks.map((artwork) => (
            <Link
              key={artwork.id}
              href={`/agreement/${artwork.id}`}
              className="flex items-center gap-4 bg-white border border-stone-200 hover:border-[#B8902A] rounded-xl p-4 transition-colors"
            >
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                {artwork.image_url
                  ? <img src={artwork.image_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No img</div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{artwork.title_en}</p>
                <p className="text-xs text-gray-400 mt-0.5">Starting at ${artwork.starting_price}</p>
              </div>
              <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-semibold shrink-0">
                Pending Approval
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {artworks.map((artwork) => (
            <ArtworkCard
              key={artwork.id}
              artwork={artwork}
              locale={locale}
              isLiked={likedIds.has(artwork.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

