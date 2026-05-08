import { createClient } from '@/lib/supabase/server'
import { getTranslations, getLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const t = await getTranslations('dashboard')
  const locale = await getLocale()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // 自分の出品作品
  const { data: myArtworks } = await supabase
    .from('artworks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // 自分が入札中のオークション
  const { data: myBids } = await supabase
    .from('bids')
    .select('*, artworks(id, title_ja, title_en, image_url, current_price, end_at, status)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // 重複排除（同一作品の最新入札のみ）
  const uniqueBidArtworks = myBids
    ? Array.from(
        new Map(myBids.map((b) => [(b.artworks as any)?.id, b])).values()
      )
    : []

  // 自分の落札作品
  const { data: myPurchases } = await supabase
    .from('purchases')
    .select('*, artworks(id, title_ja, title_en, image_url)')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <h1 className="text-2xl font-bold text-white">{t('title')}</h1>

      {/* 自分の出品作品 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{t('myListings')}</h2>
          <Link href="/sell" className="text-sm text-violet-400 hover:text-violet-300">+ 出品する</Link>
        </div>
        {!myArtworks?.length ? (
          <p className="text-gray-600 text-sm">出品中の作品はありません</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {myArtworks.map((a) => {
              const title = locale === 'ja' ? a.title_ja : a.title_en
              return (
                <Link key={a.id} href={`/auction/${a.id}`} className="group block">
                  <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-violet-500 transition-colors">
                    <div className="aspect-square overflow-hidden bg-gray-800">
                      {a.image_url && (
                        <img
                          src={a.image_url}
                          alt={title}
                          className="w-full h-full object-cover pointer-events-none select-none"
                          draggable={false}
                        />
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-white truncate">{title}</p>
                      <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded-full ${
                        a.status === 'active' ? 'bg-green-900 text-green-400' :
                        a.status === 'sold' ? 'bg-violet-900 text-violet-400' :
                        'bg-gray-800 text-gray-500'
                      }`}>
                        {a.status === 'active' ? '出品中' : a.status === 'sold' ? '落札済み' : '終了'}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* 参加中のオークション */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">{t('myBids')}</h2>
        {!uniqueBidArtworks.length ? (
          <p className="text-gray-600 text-sm">参加中のオークションはありません</p>
        ) : (
          <div className="space-y-3">
            {uniqueBidArtworks.map((bid) => {
              const artwork = bid.artworks as any
              if (!artwork) return null
              const title = locale === 'ja' ? artwork.title_ja : artwork.title_en
              return (
                <Link key={artwork.id} href={`/auction/${artwork.id}`}
                  className="flex items-center gap-4 bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-violet-500 transition-colors"
                >
                  {artwork.image_url && (
                    <img src={artwork.image_url} alt={title} className="w-12 h-12 rounded-lg object-cover pointer-events-none" draggable={false} />
                  )}
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{title}</p>
                    <p className="text-gray-500 text-xs">
                      現在の最高入札: ${artwork.current_price?.toLocaleString()}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    artwork.status === 'active' ? 'bg-green-900 text-green-400' : 'bg-gray-800 text-gray-500'
                  }`}>
                    {artwork.status === 'active' ? '進行中' : '終了'}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* 落札済み作品 */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">{t('myPurchases')}</h2>
        {!myPurchases?.length ? (
          <p className="text-gray-600 text-sm">落札済み作品はありません</p>
        ) : (
          <div className="space-y-3">
            {myPurchases.map((p) => {
              const artwork = p.artworks as any
              const title = artwork ? (locale === 'ja' ? artwork.title_ja : artwork.title_en) : '不明'
              return (
                <div key={p.id} className="flex items-center gap-4 bg-gray-900 rounded-xl p-4 border border-gray-800">
                  {artwork?.image_url && (
                    <img src={artwork.image_url} alt={title} className="w-12 h-12 rounded-lg object-cover pointer-events-none" draggable={false} />
                  )}
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{title}</p>
                    <p className="text-gray-500 text-xs">落札額: ${p.amount?.toLocaleString()}</p>
                  </div>
                  {p.download_url && new Date(p.download_expires_at) > new Date() && (
                    <a
                      href={p.download_url}
                      className="text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      ダウンロード
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
