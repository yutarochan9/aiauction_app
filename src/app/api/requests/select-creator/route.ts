import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { applicationId, requestId, creatorId } = await request.json()

  // 操作者が依頼主であることを確認
  const { data: req } = await supabase
    .from('requests')
    .select('identity_holder_id')
    .eq('id', requestId)
    .single()

  if (!req || req.identity_holder_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 選択された応募をacceptedに、他をrejectedに
  await supabase
    .from('applications')
    .update({ status: 'rejected' })
    .eq('request_id', requestId)
    .neq('id', applicationId)

  await supabase
    .from('applications')
    .update({ status: 'accepted' })
    .eq('id', applicationId)

  // requestをin_progressに更新
  await supabase
    .from('requests')
    .update({ status: 'in_progress', selected_creator_id: creatorId })
    .eq('id', requestId)

  // クリエイターに通知
  await supabase.from('notifications').insert({
    user_id: creatorId,
    type: 'application_accepted',
    title: 'You were selected!',
    body: 'The identity holder has selected you to create their avatar.',
    url: `/market/request/${requestId}`,
  })

  return NextResponse.json({ success: true })
}
