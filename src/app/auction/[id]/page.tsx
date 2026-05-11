import { createClient } from '@/lib/supabase/server'
import { getTranslations, getLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import BidSection from './BidSection'
import BidderManagement from '@/components/BidderManagement'
import ViewTracker from '@/components/ViewTracker'
import WatermarkOverlay from '@/components/WatermarkOverlay'
import Link from 'next/link'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data: artwork } = await supabase
    .from('artworks')
    .select('title_en, title_ja, description_en, description_ja, image_url, current_price')
    .eq('id', id)
    .single()
  if (!artwork) return { title: 'AIAII' }
  const title = artwork.title_en || artwork.title_ja || 'Avatar'
  const description = artwork.description_en || artwork.description_ja || `Current bid: $${artwork.current_price}`
  const image = artwork.image_url
  return {
    title: `${title} | AIAII`,
    description,
    openGraph: {
      title: `${title} | AIAII`,
      description,
      images: image ? [{ url: image, width: 1200, height: 1200 }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | AIAII`,
      description,
      images: image ? [image] : [],
    },
  }
}

export const dynamic = 'force-dynamic'

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getTranslations('auction')
  const locale = await getLocale()
  const supabase = await createClient()

  // 作品情報取得
  const { data: artwork } = await supabase
    .from('artworks')
    .select('*, users(display_name, avatar_url, sns_verified, sns_url)')
    .eq('id', id)
    .single()

  if (!artwork) notFound()

  // 承認待ちのアバターは未ログインユーザーから隠す
  if (artwork.status === 'pending_approval') {
    const { data: { user: viewer } } = await supabase.auth.getUser()
    const isRelated = viewer && (viewer.id === artwork.creator_id || viewer.id === artwork.identity_holder_id)
    if (!isRelated) notFound()
  }

  // 予定時間を過ぎたscheduledオークションを自動でactiveに
  if (artwork.status === 'scheduled' && new Date(artwork.start_at) <= new Date()) {
    await supabase.from('artworks').update({ status: 'active' }).eq('id', id)
    artwork.status = 'active'
  }

  // 入札履歴取得（新しい順）
  const { data: bids } = await supabase
    .from('bids')
    .select('*, users(display_name, avatar_url)')
    .eq('artwork_id', id)
    .order('amount', { ascending: false })
    .limit(20)

  // ログイン中のユーザー
  const { data: { user } } = await supabase.auth.getUser()

  // いいね状態・数確認
  let isLiked = false
  const { count: likesCount } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('artwork_id', id)
  if (user) {
    const { data: likeCheck } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', user.id)
      .eq('artwork_id', id)
      .single()
    isLiked = !!likeCheck
  }

  // 出品者・購入者判定
  const isSeller = !!user && user.id === artwork.user_id
  let isBuyer = false
  if (user && !isSeller) {
    const { data: purchaseCheck } = await supabase
      .from('purchases')
      .select('id')
      .eq('buyer_id', user.id)
      .eq('artwork_id', id)
      .single()
    isBuyer = !!purchaseCheck
  }

  // ブラックリスト確認（出品者が現ユーザーをブロックしているか）
  let isBlacklisted = false
  let blockedUserIds: string[] = []
  if (user) {
    const { data: blacklistCheck } = await supabase
      .from('blacklists')
      .select('id')
      .eq('seller_id', artwork.user_id)
      .eq('blocked_user_id', user.id)
      .single()
    isBlacklisted = !!blacklistCheck

    // 出品者の場合：自分のブラックリストを取得
    if (user.id === artwork.user_id) {
      const { data: myBlacklist } = await supabase
        .from('blacklists')
        .select('blocked_user_id')
        .eq('seller_id', user.id)
      blockedUserIds = myBlacklist?.map(b => b.blocked_user_id) ?? []
    }
  }

  const title = locale === 'ja' ? artwork.title_ja : artwork.title_en
  const description = locale === 'ja' ? artwork.description_ja : artwork.description_en
  const seller = artwork.users as any
  const isEnded = artwork.status !== 'active'

  return (
    <div className="max-w-5xl mx-auto">
      <ViewTracker artworkId={id} />
      <Link href="/" className="text-gray-400 hover:text-gray-900 text-sm mb-6 inline-block">
        ← Back to listings
      </Link>

      <div className="grid md:grid-cols-2 gap-10">
        {/* 左：メディア */}
        <div>
          <div className="rounded-2xl overflow-hidden bg-white border border-stone-200 relative">
            {artwork.file_format === 'video' ? (
              <div className="relative aspect-square bg-black flex items-center justify-center">
                {artwork.image_url && (
                  <video
                    src={isBuyer || isSeller ? undefined : undefined}
                    poster={artwork.image_url}
                    controls={isBuyer || isSeller}
                    className="w-full h-full object-contain"
                    controlsList="nodownload"
                    onContextMenu={e => e.preventDefault()}
                  >
                    Your browser does not support video.
                  </video>
                )}
                {!isBuyer && !isSeller && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="text-center text-white">
                      <p className="text-4xl mb-2">🎬</p>
                      <p className="text-sm font-semibold">Video Preview</p>
                      <p className="text-xs text-white/60 mt-1">Full video unlocked after purchase</p>
                    </div>
                  </div>
                )}
                {!isBuyer && !isSeller && <WatermarkOverlay dense />}
              </div>
            ) : artwork.file_format === 'audio' ? (
              <div className="aspect-square flex flex-col items-center justify-center bg-gradient-to-b from-stone-900 to-stone-800 p-8">
                <div className="w-24 h-24 rounded-full bg-stone-700 flex items-center justify-center mb-6">
                  {artwork.image_url
                    ? <img src={artwork.image_url} alt="" className="w-full h-full object-cover rounded-full" />
                    : <span className="text-4xl">🎵</span>
                  }
                </div>
                <p className="text-white font-semibold text-center mb-4">{title}</p>
                {isBuyer || isSeller ? (
                  <p className="text-xs text-stone-400">Full audio available for download after purchase</p>
                ) : (
                  <div className="text-center">
                    <p className="text-xs text-stone-400 mb-3">30-second preview</p>
                    <audio controls controlsList="nodownload" className="w-full max-w-xs">
                      <source src={artwork.image_url ?? ''} />
                    </audio>
                    <p className="text-xs text-stone-500 mt-2">Full audio unlocked after purchase</p>
                  </div>
                )}
              </div>
            ) : artwork.file_format === '3d' ? (
              <div className="aspect-square flex flex-col items-center justify-center bg-stone-100 gap-4">
                {artwork.image_url && (
                  <img src={artwork.image_url} alt={title} className="w-full h-full object-contain pointer-events-none select-none" draggable={false} />
                )}
                <div className="absolute bottom-4 left-0 right-0 text-center">
                  <span className="text-xs bg-black/60 text-white px-3 py-1 rounded-full">🧊 3D Model</span>
                </div>
                {!isBuyer && !isSeller && <WatermarkOverlay dense />}
              </div>
            ) : (
              // 通常画像
              <>
                {artwork.image_url ? (
                  <img
                    src={artwork.image_url}
                    alt={title}
                    className="w-full object-contain pointer-events-none select-none"
                    draggable={false}
                  />
                ) : (
                  <div className="aspect-square flex items-center justify-center text-gray-300">No Image</div>
                )}
                {!isBuyer && !isSeller && <WatermarkOverlay dense />}
              </>
            )}
          </div>
          {!isBuyer && !isSeller && artwork.file_format === 'image' && (
            <p className="text-xs text-gray-300 mt-3 text-center">{t('protectedNotice')}</p>
          )}
        </div>

        {/* 右：情報・入札 */}
        <div className="space-y-6">
          {/* 出品者 */}
          <div className="flex items-center gap-3">
            {seller?.avatar_url ? (
              <img src={seller.avatar_url} alt="" className="w-10 h-10 rounded-full" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-sm font-bold">
                {seller?.display_name?.[0] ?? '?'}
              </div>
            )}
            <div>
              <Link href={`/profile/${artwork.user_id}`} className="font-medium text-gray-900 hover:text-[#B8902A]">
                {seller?.display_name ?? 'Unknown'}
              </Link>
              {seller?.sns_verified && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">✓ SNS認証済み</span>
              )}
            </div>
          </div>

          {/* タイトル */}
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>

          {description && (
            <p className="text-gray-400 leading-relaxed">{description}</p>
          )}

          {/* 入札セクション（クライアントコンポーネント） */}
          <BidSection
            artwork={artwork as any}
            bids={(bids ?? []) as any}
            currentUser={user}
            isBlacklisted={isBlacklisted}
            isLiked={isLiked}
            initialLikesCount={likesCount ?? 0}
          />

          {/* 出品者向け：入札者管理（進行中のみ表示） */}
          {user?.id === artwork.user_id && !isEnded && (
            <BidderManagement
              artworkId={artwork.id}
              bids={(bids ?? []) as any}
              blockedUserIds={blockedUserIds}
            />
          )}
        </div>
      </div>
    </div>
  )
}
