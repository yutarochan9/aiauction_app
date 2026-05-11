import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { requestId, message, price } = await request.json()

  // 重複応募チェック
  const { data: existing } = await supabase
    .from('applications')
    .select('id')
    .eq('request_id', requestId)
    .eq('creator_id', user.id)
    .single()

  if (existing) return NextResponse.json({ error: 'Already applied' }, { status: 400 })

  const { data, error } = await supabase
    .from('applications')
    .insert({ request_id: requestId, creator_id: user.id, message, price })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 依頼主に通知
  const { data: req } = await supabase.from('requests').select('identity_holder_id, title').eq('id', requestId).single()
  if (req) {
    await supabase.from('notifications').insert({
      user_id: req.identity_holder_id,
      type: 'new_application',
      title: 'New application',
      body: `A creator applied to your request "${req.title}"`,
      url: `/market/request/${requestId}`,
    })
  }

  return NextResponse.json({ id: data.id })
}
