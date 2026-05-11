import { createClient } from '@/lib/supabase/server'
import { getTranslations, getLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import SnsVerifySection from './SnsVerifySection'
import FollowButton from '@/components/FollowButton'

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getTranslations('profile')
  const locale = await getLocale()
  const supabase = await createClient()

  const ROLE_LABELS: Record<string, string> = {
    identity_holder: 'Identity Holder',
    creator: 'Creator',
    buyer: 'Buyer',
  }

  // ユーザー情報取得
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single()

  if (!profile) notFound()

  // 出品作品取得
  const { data: artworks } = await supabase
    .from('artworks')
    .select('*, purchases(amount, created_at)')
    .eq('user_id', id)
    .order('created_at', { ascending: false })

  // 落札数
  const soldCount = artworks?.filter(a => a.status === 'sold').length ?? 0

  // レビュー取得
  const { data: reviews } = await supabase
    .from('reviews')
    .select('*, users!reviewer_id(display_name, avatar_url)')
    .eq('reviewee_id', id)
    .order('created_at', { ascending: false })

  const ratingAvg = reviews?.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null

  // ログイン中のユーザー（自分のプロフィールかどうか）
  const { data: { user } } = await supabase.auth.getUser()
  const isOwn = user?.id === id

  // フォロワー数・フォロー状態
  const { count: followerCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', id)

  let isFollowing = false
  if (user && !isOwn) {
    const { data: followCheck } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', id)
      .single()
    isFollowing = !!followCheck
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* プロフィールヘッダー */}
      <div className="bg-white rounded-2xl p-6 border border-stone-200 mb-8">
        <div className="flex items-start gap-5">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#F5EAD0] flex items-center justify-center text-2xl font-bold">
              {profile.display_name?.[0] ?? '?'}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{profile.display_name}</h1>
              {(profile as any).identity_verified && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                  🪪 ID Verified
                </span>
              )}
              {profile.sns_verified && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  ✓ {t('snsVerified')}
                </span>
              )}
              {(profile.roles ?? []).map((role: string) => (
                <span key={role} className="text-xs bg-stone-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {ROLE_LABELS[role] ?? role}
                </span>
              ))}
            </div>
            {profile.sns_verified && (
              <p className="text-xs text-gray-300 mb-2">{t('snsVerifyBadgeNote')}</p>
            )}
            {profile.bio && <p className="text-gray-400 text-sm">{profile.bio}</p>}
            {profile.sns_url && (
              <a
                href={profile.sns_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#B8902A] hover:underline mt-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {profile.sns_url.replace(/^https?:\/\//, '')}
              </a>
            )}
            {profile.portfolio_url && (profile.roles ?? []).includes('creator') && (
              <a
                href={profile.portfolio_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:underline mt-1 ml-3"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Portfolio
              </a>
            )}

            {/* 実績 */}
            <div className="flex gap-6 mt-3 text-sm flex-wrap">
              <span className="text-gray-400">
                <span className="text-gray-900 font-semibold">{artworks?.length ?? 0}</span> listings
              </span>
              <span className="text-gray-400">
                <span className="text-gray-900 font-semibold">{soldCount}</span> sold
              </span>
              <span className="text-gray-400">
                <span className="text-gray-900 font-semibold">{followerCount ?? 0}</span> followers
              </span>
              {ratingAvg !== null && (
                <span className="text-gray-400 flex items-center gap-1">
                  <span className="text-[#B8902A]">★</span>
                  <span className="text-gray-900 font-semibold">{ratingAvg.toFixed(1)}</span>
                  <span>({reviews?.length} reviews)</span>
                </span>
              )}
            </div>
          </div>

          {/* 自分のプロフィールならSNS認証、他人ならフォローボタン */}
          {isOwn && !profile.sns_verified && <SnsVerifySection userId={id} />}
          {!isOwn && user && (
            <FollowButton
              targetUserId={id}
              initialFollowing={isFollowing}
              initialCount={followerCount ?? 0}
            />
          )}
        </div>
      </div>

      {/* レビュー一覧 */}
      {reviews && reviews.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Reviews
            <span className="ml-2 text-[#B8902A] text-base">★ {ratingAvg?.toFixed(1)}</span>
          </h2>
          <div className="space-y-3">
            {reviews.map((r) => {
              const reviewer = r.users as any
              return (
                <div key={r.id} className="bg-white rounded-xl p-4 border border-stone-200">
                  <div className="flex items-center gap-3 mb-2">
                    {reviewer?.avatar_url ? (
                      <img src={reviewer.avatar_url} alt="" className="w-7 h-7 rounded-full" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-gray-500">
                        {reviewer?.display_name?.[0] ?? '?'}
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-900">{reviewer?.display_name ?? 'Anonymous'}</span>
                    <span className="text-[#B8902A] text-sm">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                    <span className="text-xs text-gray-300 ml-auto">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  {r.comment && <p className="text-sm text-gray-600">{r.comment}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 出品作品一覧 */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">{t('listings')}</h2>
      {!artworks || artworks.length === 0 ? (
        <p className="text-gray-300">No avatars listed yet</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {artworks.map((artwork) => {
            const title = locale === 'ja' ? artwork.title_ja : artwork.title_en
            const purchase = artwork.purchases?.[0]
            return (
              <Link key={artwork.id} href={`/auction/${artwork.id}`} className="group block">
                <div className="bg-white rounded-xl overflow-hidden border border-stone-200 hover:border-[#B8902A] transition-colors">
                  <div className="aspect-square overflow-hidden bg-stone-100">
                    {artwork.image_url ? (
                      <img
                        src={artwork.image_url}
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none select-none"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">No Image</div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm text-gray-900 truncate">{title}</p>
                    {artwork.status === 'sold' && purchase && (
                      <p className="text-xs text-[#B8902A] mt-1">
                        Won ${purchase.amount?.toLocaleString()}
                      </p>
                    )}
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
