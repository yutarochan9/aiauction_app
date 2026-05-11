import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import AgreementActions from './AgreementActions'
import WatermarkOverlay from '@/components/WatermarkOverlay'
import Link from 'next/link'

export default async function AgreementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ submitted?: string }>
}) {
  const { id } = await params
  const { submitted } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // artwork + agreement + creator情報を取得
  const { data: artwork } = await supabase
    .from('artworks')
    .select('*, users!artworks_user_id_fkey(display_name, avatar_url)')
    .eq('id', id)
    .single()

  if (!artwork) notFound()

  const { data: agreement } = await supabase
    .from('agreements')
    .select('*')
    .eq('artwork_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // 閲覧できるのはcreatorかidentity_holderのみ
  const isHolder = user.id === artwork.identity_holder_id
  const isCreator = user.id === artwork.creator_id
  if (!isHolder && !isCreator) redirect('/')

  // 身元確認ステータス取得（holderのみ）
  let holderVerified = false
  if (isHolder) {
    const { data: holderUser } = await supabase
      .from('users')
      .select('identity_verified')
      .eq('id', user.id)
      .single()
    holderVerified = !!(holderUser as any)?.identity_verified
  }

  const creator = artwork.users as any
  const isSubmittedView = submitted === '1' && isCreator

  const FORMAT_LABELS: Record<string, string> = {
    image: 'Image', video: 'Video', audio: 'Audio', '3d': '3D Model',
  }

  return (
    <div className="max-w-2xl mx-auto py-4">
      {/* 身元確認未完了バナー（Identity Holder向け） */}
      {isHolder && !holderVerified && agreement?.status === 'pending' && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-800">🪪 Identity Verification Required</p>
              <p className="text-xs text-amber-700 mt-1">
                Please verify your identity before approving avatar agreements. This protects your rights and builds trust with creators.
              </p>
            </div>
            <a href="/verify" className="shrink-0 text-xs font-semibold bg-[#B8902A] hover:bg-[#9a7a24] text-white px-4 py-2 rounded-lg transition-colors">
              Verify →
            </a>
          </div>
        </div>
      )}

      {/* 提出完了バナー（クリエイター向け） */}
      {isSubmittedView && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
          <p className="text-sm font-semibold text-green-800">Submitted for approval</p>
          <p className="text-xs text-green-600 mt-1">
            The identity holder has been notified and needs to approve before this avatar goes live.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Avatar Approval</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {isHolder ? 'Review and approve this avatar before it goes to auction' : 'Waiting for identity holder approval'}
          </p>
        </div>
        <span className={`ml-auto text-xs px-3 py-1 rounded-full font-semibold ${
          agreement?.status === 'approved' ? 'bg-green-100 text-green-700' :
          agreement?.status === 'rejected' ? 'bg-red-100 text-red-700' :
          'bg-amber-100 text-amber-700'
        }`}>
          {agreement?.status === 'approved' ? 'Approved' :
           agreement?.status === 'rejected' ? 'Changes Requested' :
           'Pending Approval'}
        </span>
      </div>

      {/* アバタープレビュー */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden mb-6">
        <div className="relative aspect-square bg-stone-100 select-none">
          {artwork.image_url ? (
            <>
              <img
                src={artwork.image_url}
                alt={artwork.title_en}
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
              />
              <WatermarkOverlay />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">No Preview</div>
          )}
        </div>
        <div className="p-5 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900">{artwork.title_en}</h2>
            <span className="text-xs bg-stone-100 text-gray-500 px-2 py-1 rounded-full shrink-0">
              {FORMAT_LABELS[artwork.file_format] ?? artwork.file_format}
            </span>
          </div>
          {artwork.description_en && (
            <p className="text-sm text-gray-500">{artwork.description_en}</p>
          )}
          <div className="flex items-center gap-2 pt-1">
            {creator?.avatar_url ? (
              <img src={creator.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-stone-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                {creator?.display_name?.[0]}
              </div>
            )}
            <span className="text-xs text-gray-400">Created by <span className="text-gray-700 font-medium">{creator?.display_name}</span></span>
          </div>
          {/* 収益分配 */}
          <div className="flex gap-4 pt-2 border-t border-stone-100 text-xs text-gray-400">
            <span>Starting price: <span className="text-gray-700 font-semibold">${artwork.starting_price}</span></span>
            <span>Your cut: <span className="text-[#B8902A] font-semibold">{artwork.revenue_split_holder ?? 85}%</span></span>
            <span>Creator: <span className="text-gray-700 font-semibold">{artwork.revenue_split_creator ?? 10}%</span></span>
          </div>
        </div>
      </div>

      {/* 差し戻し履歴 */}
      {agreement?.holder_comment && agreement.status === 'rejected' && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-red-700 mb-1">Change Request ({agreement.revision_count}/3)</p>
          <p className="text-sm text-red-800">{agreement.holder_comment}</p>
        </div>
      )}

      {/* アクション（Identity Holder向け） */}
      {isHolder && agreement?.status === 'pending' && (
        <AgreementActions
          agreementId={agreement.id}
          artworkId={id}
          revisionCount={agreement.revision_count ?? 0}
        />
      )}

      {/* 承認済み */}
      {agreement?.status === 'approved' && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-center">
          <p className="text-sm font-semibold text-green-800">Approved ✓</p>
          <p className="text-xs text-green-600 mt-1">This avatar is live at auction.</p>
          <Link href={`/auction/${id}`} className="inline-block mt-3 text-xs text-[#B8902A] hover:underline">
            View Auction →
          </Link>
        </div>
      )}

      {/* クリエイター向け：待機メッセージ */}
      {isCreator && !isHolder && agreement?.status === 'pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-center">
          <p className="text-sm font-semibold text-amber-800">Waiting for approval</p>
          <p className="text-xs text-amber-700 mt-1">The identity holder will review and approve or request changes.</p>
        </div>
      )}
    </div>
  )
}
