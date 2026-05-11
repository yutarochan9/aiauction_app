import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { agreementId, artworkId, comment } = await request.json()

  const { data: agreement } = await supabase
    .from('agreements')
    .select('identity_holder_id, creator_id, revision_count')
    .eq('id', agreementId)
    .single()

  if (!agreement || agreement.identity_holder_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const newCount = (agreement.revision_count ?? 0) + 1

  if (newCount > 3) {
    return NextResponse.json({ error: 'Maximum revisions reached' }, { status: 400 })
  }

  await supabase
    .from('agreements')
    .update({ status: 'rejected', holder_comment: comment, revision_count: newCount })
    .eq('id', agreementId)

  await supabase
    .from('artworks')
    .update({ agreement_status: 'rejected' })
    .eq('id', artworkId)

  // クリエイターに通知
  await supabase.from('notifications').insert({
    user_id: agreement.creator_id,
    type: 'agreement_rejected',
    title: 'Changes requested',
    body: `The identity holder has requested changes (${newCount}/3).`,
    url: `/agreement/${artworkId}`,
  })

  return NextResponse.json({ success: true })
}
