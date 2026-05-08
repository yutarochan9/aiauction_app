import { createClient } from '@/lib/supabase/server'
import { getTranslations, getLocale } from 'next-intl/server'
import ArtworkCard from '@/components/ArtworkCard'
import Link from 'next/link'

type SortKey = 'new' | 'ending' | 'price'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>
}) {
  const params = await searchParams
  const sort = (params.sort ?? 'new') as SortKey
  const t = await getTranslations('home')
  const locale = await getLocale()
  const supabase = await createClient()

  // ソート条件
  const orderMap: Record<SortKey, { column: string; ascending: boolean }> = {
    new: { column: 'created_at', ascending: false },
    ending: { column: 'end_at', ascending: true },
    price: { column: 'current_price', ascending: true },
  }
  const { column, ascending } = orderMap[sort] ?? orderMap.new

  const { data: artworks } = await supabase
    .from('artworks')
    .select('*, bids(count)')
    .eq('status', 'active')
    .order(column, { ascending })
    .limit(48)

  const sortLabels: Record<SortKey, string> = {
    new: t('sortNew'),
    ending: t('sortEndingSoon'),
    price: t('sortPrice'),
  }

  return (
    <div>
      {/* ヒーローセクション */}
      <div className="text-center py-10 mb-10">
        <div className="bg-[#0a0a0a] rounded-2xl inline-block px-16 py-6 mb-6">
          <img
            src="/aiaii_logo.png"
            alt="AIAII"
            className="h-40 w-auto object-contain"
            draggable={false}
          />
        </div>
        <p className="text-gray-400 text-lg mb-8">{t('subtitle')}</p>
        <Link
          href="/sell"
          className="bg-[#2C2C2C] hover:bg-[#3C3C3C] text-white px-8 py-3 rounded-xl font-semibold transition-colors"
        >
          List Artwork
        </Link>
      </div>

      {/* ソートタブ */}
      <div className="flex gap-3 mb-8">
        {(Object.keys(sortLabels) as SortKey[]).map((key) => (
          <Link
            key={key}
            href={`/?sort=${key}`}
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
        <div className="text-center py-24 text-gray-400">{t('noArtworks')}</div>
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
