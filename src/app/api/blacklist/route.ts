import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ブラックリストに追加
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { blockedUserId } = await request.json()
  if (blockedUserId === user.id)
    return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 })

  const { error } = await supabase.from('blacklists').insert({
    seller_id: user.id,
    blocked_user_id: blockedUserId,
  })

  if (error?.code === '23505') // unique violation
    return NextResponse.json({ success: true, alreadyBlocked: true })
  if (error)
    return NextResponse.json({ error: 'Failed to block' }, { status: 500 })

  return NextResponse.json({ success: true })
}

// ブラックリストから削除
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { blockedUserId } = await request.json()

  const { error } = await supabase
    .from('blacklists')
    .delete()
    .eq('seller_id', user.id)
    .eq('blocked_user_id', blockedUserId)

  if (error) return NextResponse.json({ error: 'Failed to unblock' }, { status: 500 })
  return NextResponse.json({ success: true })
}
