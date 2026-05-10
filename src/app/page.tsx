import { createClient } from '@/lib/supabase/server'
import { getTranslations, getLocale } from 'next-intl/server'
import ArtworkCard from '@/components/ArtworkCard'
import SearchFilter from '@/components/SearchFilter'
import Link from 'next/link'

type SortKey = 'new' | 'ending' | 'price'
type StatusFilter = 'live' | 'closed' | 'upcoming'

// ステータスタブ定義（順序：Upcoming → Live → Closed）
const STATUS_TABS: { key: StatusFilter; label: string; dot: string }[] = [
  { key: 'upcoming', label: 'Upcoming',  dot: 'bg-gray-400' },
  { key: 'live',     label: 'Live',      dot: 'bg-green-400' },
  { key: 'closed',   label: 'Closed',    dot: 'bg-red-400' },
]

// ステータスごとに表示するソートオプション
const SORT_OPTIONS: Record<StatusFilter, { key: SortKey; label: string }[]> = {
  upcoming: [{ key: 'new', label: 'Newest' }],
  live:     [{ key: 'new', label: 'Newest' }, { key: 'ending', label: 'Ending Soon' }, { key: 'price', label: 'Price' }],
  closed:   [{ key: 'new', label: 'Newest' }, { key: 'price', label: 'Price' }],
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; q?: string; tag?: string; status?: string }>
}) {
  const params = await searchParams
  const q = params.q ?? ''
  const tag = params.tag ?? ''
  const statusFilter = (params.status ?? 'live') as StatusFilter
  const supabase = await createClient()
  const t = await getTranslations('home')
  const locale = await getLocale()
  const now = new Date().toISOString()

  // 有効なソートキーかチェック（ステータスが変わったとき無効なソートをリセット）
  const validSorts = SORT_OPTIONS[statusFilter].map(o => o.key)
  const sort = (validSorts.includes(params.sort as SortKey) ? params.sort : validSorts[0]) as SortKey

  const orderMap: Record<SortKey, { column: string; ascending: boolean }> = {
    new:    { column: 'created_at',    ascending: false },
    ending: { column: 'end_at',        ascending: true },
    price:  { column: 'current_price', ascending: true },
  }
  const { column, ascending } = orderMap[sort]

  // 時間が来たscheduledオークションを自動でactiveに
  await supabase
    .from('artworks')
    .update({ status: 'active' })
    .eq('status', 'scheduled')
    .lte('start_at', now)

  let query = supabase
    .from('artworks')
    .select('*, bids(count), likes(count)')
    .order(column, { ascending })
    .limit(48)

  if (statusFilter === 'live') {
    query = query.eq('status', 'active').gt('end_at', now)
  } else if (statusFilter === 'closed') {
    query = query.or(`status.eq.sold,and(status.eq.active,end_at.lte.${now})`)
  } else {
    query = query.eq('status', 'scheduled')
  }

  if (q) query = query.ilike('title_en', `%${q}%`)
  if (tag) query = query.contains('tags', [tag])

  const { data: artworks } = await query

  // ログインユーザー取得（ブラックリスト・いいね用）
  const { data: { user } } = await supabase.auth.getUser()
  let filteredArtworks = artworks ?? []
  let likedIds = new Set<string>()

  if (user && filteredArtworks.length > 0) {
    // ブラックリストフィルタリング
    const { data: blacklists } = await supabase
      .from('blacklists')
      .select('seller_id')
      .eq('blocked_user_id', user.id)
    const blockedSellerIds = new Set(blacklists?.map(b => b.seller_id) ?? [])

    if (blockedSellerIds.size > 0) {
      const { data: myBids } = await supabase
        .from('bids')
        .select('artwork_id')
        .eq('user_id', user.id)
      const myBidArtworkIds = new Set(myBids?.map(b => b.artwork_id) ?? [])
      filteredArtworks = filteredArtworks.filter(artwork =>
        !blockedSellerIds.has(artwork.user_id) || myBidArtworkIds.has(artwork.id)
      )
    }

    // いいね済みIDセット
    const { data: myLikes } = await supabase
      .from('likes')
      .select('artwork_id')
      .eq('user_id', user.id)
    likedIds = new Set(myLikes?.map(l => l.artwork_id) ?? [])
  }

  const buildUrl = (overrides: Record<string, string>) => {
    const p: Record<string, string> = { status: statusFilter, sort, ...overrides }
    if (q) p.q = q
    if (tag) p.tag = tag
    const qs = Object.entries(p).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return `/?${qs}`
  }

  const emptyMessage = statusFilter === 'upcoming'
    ? 'No upcoming auctions yet'
    : statusFilter === 'closed'
    ? 'No closed auctions'
    : t('noArtworks')

  return (
    <div>
      {/* ヒーローセクション */}
      <div className="text-center py-12 mb-10">
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-2">
          {t('title')}
        </h1>
        <p className="text-sm tracking-[0.35em] text-[#B8902A] uppercase font-semibold mb-6">AI Art Auction</p>
        <p className="text-gray-400 text-lg mb-8">{t('subtitle')}</p>
        <Link
          href="/sell"
          className="bg-[#2C2C2C] hover:bg-[#3C3C3C] text-white px-8 py-3 rounded-xl font-semibold transition-colors"
        >
          List Artwork
        </Link>
      </div>

      {/* 検索・タグフィルター */}
      <SearchFilter currentQ={q} currentTag={tag} currentSort={sort} />

      {/* ステータスタブ＋ソートを1行に */}
      <div className="flex items-center justify-between mb-8">
        {/* ステータスタブ */}
        <div className="flex gap-2">
          {STATUS_TABS.map(({ key, label, dot }) => (
            <Link
              key={key}
              href={buildUrl({ status: key })}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                statusFilter === key
                  ? 'bg-[#2C2C2C] text-white'
                  : 'bg-stone-100 text-gray-400 hover:text-gray-900'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${statusFilter === key ? dot : 'bg-gray-300'}`} />
              {label}
            </Link>
          ))}
        </div>

        {/* ソートオプション */}
        <div className="flex gap-2">
          {SORT_OPTIONS[statusFilter].map(({ key, label }) => (
            <Link
              key={key}
              href={buildUrl({ sort: key })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sort === key
                  ? 'bg-[#B8902A] text-white'
                  : 'bg-stone-100 text-gray-400 hover:text-gray-900'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* 作品一覧 */}
      {filteredArtworks.length === 0 ? (
        <div className="text-center py-24 text-gray-400">{emptyMessage}</div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredArtworks.map((artwork) => (
            <ArtworkCard key={artwork.id} artwork={artwork as any} locale={locale} isLiked={likedIds.has(artwork.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
