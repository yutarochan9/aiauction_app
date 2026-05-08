import { createClient } from '@/lib/supabase/server'
import { getTranslations, getLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import SnsVerifySection from './SnsVerifySection'

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getTranslations('profile')
  const locale = await getLocale()
  const supabase = await createClient()

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

  // ログイン中のユーザー（自分のプロフィールかどうか）
  const { data: { user } } = await supabase.auth.getUser()
  const isOwn = user?.id === id

  return (
    <div className="max-w-4xl mx-auto">
      {/* プロフィールヘッダー */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-8">
        <div className="flex items-start gap-5">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-violet-700 flex items-center justify-center text-2xl font-bold">
              {profile.display_name?.[0] ?? '?'}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-white">{profile.display_name}</h1>
              {profile.sns_verified && (
                <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                  ✓ {t('snsVerified')}
                </span>
              )}
            </div>
            {profile.sns_verified && (
              <p className="text-xs text-gray-600 mb-2">{t('snsVerifyBadgeNote')}</p>
            )}
            {profile.bio && <p className="text-gray-400 text-sm">{profile.bio}</p>}

            {/* 実績 */}
            <div className="flex gap-6 mt-3 text-sm">
              <span className="text-gray-500">
                <span className="text-white font-semibold">{artworks?.length ?? 0}</span> 点出品
              </span>
              <span className="text-gray-500">
                <span className="text-white font-semibold">{soldCount}</span> 点落札済み
              </span>
            </div>
          </div>

          {/* 自分のプロフィールならSNS認証ボタン */}
          {isOwn && !profile.sns_verified && (
            <SnsVerifySection userId={id} />
          )}
        </div>
      </div>

      {/* 出品作品一覧 */}
      <h2 className="text-lg font-bold text-white mb-4">{t('listings')}</h2>
      {!artworks || artworks.length === 0 ? (
        <p className="text-gray-600">出品作品はありません</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {artworks.map((artwork) => {
            const title = locale === 'ja' ? artwork.title_ja : artwork.title_en
            const purchase = artwork.purchases?.[0]
            return (
              <Link key={artwork.id} href={`/auction/${artwork.id}`} className="group block">
                <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-violet-500 transition-colors">
                  <div className="aspect-square overflow-hidden bg-gray-800">
                    {artwork.image_url ? (
                      <img
                        src={artwork.image_url}
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none select-none"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">No Image</div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm text-white truncate">{title}</p>
                    {artwork.status === 'sold' && purchase && (
                      <p className="text-xs text-violet-400 mt-1">
                        落札 ${purchase.amount?.toLocaleString()}
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
