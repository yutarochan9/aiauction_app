import { createClient } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ArtworkCard from '@/components/ArtworkCard'

type Tab = 'bidding' | 'selling' | 'won' | 'liked' | 'following'

const TABS: { key: Tab; label: string }[] = [
  { key: 'bidding',   label: 'Bidding' },
  { key: 'selling',   label: 'Selling' },
  { key: 'won',       label: 'Won' },
  { key: 'liked',     label: 'Liked' },
  { key: 'following', label: 'Following' },
]

const EMPTY: Record<Tab, string> = {
  bidding:   "You're not bidding on anything right now",
  selling:   'No listings yet',
  won:       'No won items yet',
  liked:     'No liked artworks yet',
  following: "Follow artists to see their new listings here",
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
        <Link
          href="/dashboard"
          className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          Seller dashboard →
        </Link>
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
