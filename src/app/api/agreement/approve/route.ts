import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { agreementId, artworkId } = await request.json()

  // 操作者がidentity_holderであることを確認
  const { data: agreement } = await supabase
    .from('agreements')
    .select('identity_holder_id, creator_id')
    .eq('id', agreementId)
    .single()

  if (!agreement || agreement.identity_holder_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 合意レコードを承認状態に更新
  await supabase
    .from('agreements')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', agreementId)

  // artworkをactiveに変更
  await supabase
    .from('artworks')
    .update({ agreement_status: 'approved', status: 'active' })
    .eq('id', artworkId)

  // クリエイターに通知
  await supabase.from('notifications').insert({
    user_id: agreement.creator_id,
    type: 'agreement_approved',
    title: 'Avatar approved',
    body: 'Your avatar has been approved and is now live at auction.',
    url: `/auction/${artworkId}`,
  })

  return NextResponse.json({ success: true })
}
