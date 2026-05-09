import { createClient } from '@/lib/supabase/server'
import { getTranslations, getLocale } from 'next-intl/server'
import ArtworkCard from '@/components/ArtworkCard'
import SearchFilter from '@/components/SearchFilter'
import Link from 'next/link'

type SortKey = 'new' | 'ending' | 'price'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; q?: string; tag?: string }>
}) {
  const params = await searchParams
  const sort = (params.sort ?? 'new') as SortKey
  const q = params.q ?? ''
  const tag = params.tag ?? ''
  const t = await getTranslations('home')
  const locale = await getLocale()
  const supabase = await createClient()

  const orderMap: Record<SortKey, { column: string; ascending: boolean }> = {
    new: { column: 'created_at', ascending: false },
    ending: { column: 'end_at', ascending: true },
    price: { column: 'current_price', ascending: true },
  }
  const { column, ascending } = orderMap[sort] ?? orderMap.new

  let query = supabase
    .from('artworks')
    .select('*, bids(count)')
    .eq('status', 'active')
    .gt('end_at', new Date().toISOString())
    .order(column, { ascending })
    .limit(48)

  if (q) query = query.ilike('title_en', `%${q}%`)
  if (tag) query = query.contains('tags', [tag])

  const { data: artworks } = await query

  const sortLabels: Record<SortKey, string> = {
    new: t('sortNew'),
    ending: t('sortEndingSoon'),
    price: t('sortPrice'),
  }

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

      {/* ソートタブ */}
      <div className="flex gap-3 mb-8">
        {(Object.keys(sortLabels) as SortKey[]).map((key) => (
          <Link
            key={key}
            href={`/?sort=${key}${q ? `&q=${encodeURIComponent(q)}` : ''}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              sort === key
                ? 'bg-[#2C2C2C] text-white'
                : 'bg-stone-100 text-gray-400 hover:text-gray-900'
            }`}
          >
            {sortLabels[key]}
          </Link>
        ))}
      </div>

      {/* 作品一覧 */}
      {!artworks || artworks.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          {q || tag ? 'No artworks found' : t('noArtworks')}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {artworks.map((artwork) => (
            <ArtworkCard key={artwork.id} artwork={artwork as any} locale={locale} />
          ))}
        </div>
      )}
    </div>
  )
}
