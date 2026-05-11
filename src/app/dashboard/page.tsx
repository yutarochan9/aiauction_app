import { createClient } from '@/lib/supabase/server'
import { getTranslations, getLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ReviewForm from '@/components/ReviewForm'
import UnpaidSection from '@/components/UnpaidSection'
import SecondChanceSection from '@/components/SecondChanceSection'

export default async function DashboardPage() {
  const t = await getTranslations('dashboard')
  const locale = await getLocale()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const now = new Date().toISOString()

  // 自分の出品作品
  const { data: myArtworks } = await supabase
    .from('artworks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // 未払い（終了済みだが未売却）の出品作品
  const { data: unpaidArtworks } = await supabase
    .from('artworks')
    .select('*, bids(user_id, amount, users(display_name))')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .lt('end_at', now)

  // 自分が入札中のオークション
  const { data: myBids } = await supabase
    .from('bids')
    .select('*, artworks(id, title_ja, title_en, image_url, current_price, end_at, status)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const uniqueBidArtworks = myBids
    ? Array.from(new Map(myBids.map((b) => [(b.artworks as any)?.id, b])).values())
    : []

  // 自分の落札作品（ダウンロードURL込み）
  const { data: myPurchases } = await supabase
    .from('purchases')
    .select('*, artworks(id, title_ja, title_en, image_url, user_id, file_format)')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })

  // 売上（自分が出品して購入された作品）
  const { data: mySales } = await supabase
    .from('purchases')
    .select('*, artworks(id, title_ja, title_en, image_url)')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })
  const totalRevenue = mySales?.reduce((sum, s) => sum + (s.amount ?? 0), 0) ?? 0

  // 自分が書いたレビューのpurchase_idリスト
  const { data: myReviews } = await supabase
    .from('reviews')
    .select('purchase_id')
    .eq('reviewer_id', user.id)

  const reviewedPurchaseIds = new Set(myReviews?.map((r) => r.purchase_id) ?? [])

  // 自分へのセカンドチャンスオファー（pending かつ期限内）
  const { data: secondChanceOffers } = await supabase
    .from('second_chance_offers')
    .select('*, artworks(id, title_ja, title_en, image_url)')
    .eq('offered_to_id', user.id)
    .eq('status', 'pending')
    .gt('expires_at', now)

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>

      {/* セカンドチャンスオファー */}
      {secondChanceOffers && secondChanceOffers.length > 0 && (
        <SecondChanceSection offers={secondChanceOffers as any} locale={locale} />
      )}

      {/* 未払い報告セクション */}
      {unpaidArtworks && unpaidArtworks.length > 0 && (
        <UnpaidSection artworks={unpaidArtworks as any} locale={locale} />
      )}

      {/* 自分の出品作品 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('myListings')}</h2>
          <Link href="/sell" className="text-sm text-[#B8902A]">+ List Avatar</Link>
        </div>
        {!myArtworks?.length ? (
          <p className="text-gray-300 text-sm">No listings yet</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {myArtworks.map((a) => {
              const title = locale === 'ja' ? a.title_ja : a.title_en
              return (
                <Link key={a.id} href={`/auction/${a.id}`} className="group block">
                  <div className="bg-white rounded-xl overflow-hidden border border-stone-200 hover:border-[#B8902A] transition-colors">
                    <div className="aspect-square overflow-hidden bg-stone-100">
                      {a.image_url && (
                        <img src={a.image_url} alt={title} className="w-full h-full object-cover pointer-events-none select-none" draggable={false} />
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-gray-900 truncate">{title}</p>
                      <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded-full ${
                        a.status === 'active' && new Date(a.end_at) > new Date() ? 'bg-[#F0F7F0] text-[#3D7A4D]' :
                        a.status === 'sold' ? 'bg-[#FBF6EC] text-[#B8902A]' :
                        'bg-stone-100 text-stone-500'
                      }`}>
                        {a.status === 'sold' ? 'Sold' : new Date(a.end_at) > new Date() ? 'Live' : 'Closed'}
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('myBids')}</h2>
        {!uniqueBidArtworks.length ? (
          <p className="text-gray-300 text-sm">No active bids</p>
        ) : (
          <div className="space-y-3">
            {uniqueBidArtworks.map((bid) => {
              const artwork = bid.artworks as any
              if (!artwork) return null
              const title = locale === 'ja' ? artwork.title_ja : artwork.title_en
              return (
                <Link key={artwork.id} href={`/auction/${artwork.id}`}
                  className="flex items-center gap-4 bg-white rounded-xl p-4 border border-stone-200 hover:border-[#B8902A] transition-colors"
                >
                  {artwork.image_url && (
                    <img src={artwork.image_url} alt={title} className="w-12 h-12 rounded-lg object-cover pointer-events-none" draggable={false} />
                  )}
                  <div className="flex-1">
                    <p className="text-gray-900 text-sm font-medium">{title}</p>
                    <p className="text-gray-400 text-xs">Current bid: ${artwork.current_price?.toLocaleString()}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    artwork.status === 'active' && new Date(artwork.end_at) > new Date()
                      ? 'bg-[#F0F7F0] text-[#3D7A4D]'
                      : 'bg-stone-100 text-stone-500'
                  }`}>
                    {artwork.status === 'active' && new Date(artwork.end_at) > new Date() ? 'Live' : 'Closed'}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* 売上管理 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('mySales')}</h2>
          {totalRevenue > 0 && (
            <span className="text-sm font-semibold text-[#B8902A]">
              Total: ${totalRevenue.toLocaleString()}
            </span>
          )}
        </div>
        {!mySales?.length ? (
          <p className="text-gray-300 text-sm">No sales yet</p>
        ) : (
          <div className="space-y-3">
            {mySales.map((s) => {
              const artwork = s.artworks as any
              const title = artwork ? (locale === 'ja' ? artwork.title_ja : artwork.title_en) : 'Unknown'
              return (
                <div key={s.id} className="flex items-center gap-4 bg-white rounded-xl p-4 border border-stone-200">
                  {artwork?.image_url && (
                    <img src={artwork.image_url} alt={title} className="w-12 h-12 rounded-lg object-cover pointer-events-none" draggable={false} />
                  )}
                  <div className="flex-1">
                    <p className="text-gray-900 text-sm font-medium">{title}</p>
                    <p className="text-gray-400 text-xs">{new Date(s.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-semibold text-[#B8902A]">${s.amount?.toLocaleString()}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 落札済み作品 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('myPurchases')}</h2>
        {!myPurchases?.length ? (
          <p className="text-gray-300 text-sm">No purchases yet</p>
        ) : (
          <div className="space-y-4">
            {myPurchases.map((p) => {
              const artwork = p.artworks as any
              const title = artwork ? (locale === 'ja' ? artwork.title_ja : artwork.title_en) : 'Unknown'
              const alreadyReviewed = reviewedPurchaseIds.has(p.id)
              return (
                <div key={p.id} className="bg-white rounded-xl p-4 border border-stone-200">
                  <div className="flex items-center gap-4">
                    {artwork?.image_url && (
                      <img src={artwork.image_url} alt={title} className="w-12 h-12 rounded-lg object-cover pointer-events-none" draggable={false} />
                    )}
                    <div className="flex-1">
                      <p className="text-gray-900 text-sm font-medium">{title}</p>
                      <p className="text-gray-400 text-xs">Winning bid: ${p.amount?.toLocaleString()}</p>
                    </div>
                    {artwork?.user_id && (
                      <Link href={`/profile/${artwork.user_id}`} className="text-xs text-[#B8902A] hover:underline">
                        View seller
                      </Link>
                    )}
                  </div>
                  {/* ダウンロードボタン */}
                  {p.download_url && (
                    <div className="mt-3 pt-3 border-t border-stone-100">
                      {new Date(p.download_expires_at) > new Date() ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold text-gray-700">Your file is ready</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Expires {new Date(p.download_expires_at).toLocaleString()}
                            </p>
                          </div>
                          <a
                            href={p.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 bg-[#2C2C2C] hover:bg-[#3C3C3C] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </a>
                        </div>
                      ) : (
                        <p className="text-xs text-red-400">Download link expired. Contact support.</p>
                      )}
                    </div>
                  )}
                  {!alreadyReviewed && artwork?.user_id && (
                    <ReviewForm
                      purchaseId={p.id}
                      revieweeId={artwork.user_id}
                      artworkId={artwork.id}
                    />
                  )}
                  {alreadyReviewed && (
                    <p className="mt-3 text-xs text-gray-400">✓ You reviewed this purchase</p>
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
