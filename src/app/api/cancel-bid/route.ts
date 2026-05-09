import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bidId, artworkId } = await request.json()

  // 出品者本人かチェック
  const { data: artwork } = await supabase
    .from('artworks')
    .select('user_id, status, starting_price')
    .eq('id', artworkId)
    .single()

  if (!artwork || artwork.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (artwork.status !== 'active') {
    return NextResponse.json({ error: 'Auction already ended' }, { status: 400 })
  }

  // サービスロールキーでRLSをバイパスして入札を削除
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 対象入札のuser_idを取得してそのユーザーの全入札を削除
  const { data: targetBid } = await admin
    .from('bids')
    .select('user_id')
    .eq('id', bidId)
    .eq('artwork_id', artworkId)
    .single()

  if (!targetBid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 })

  const { error: deleteErr } = await admin
    .from('bids')
    .delete()
    .eq('user_id', targetBid.user_id)
    .eq('artwork_id', artworkId)

  if (deleteErr) {
    return NextResponse.json({ error: 'Failed to cancel bid' }, { status: 500 })
  }

  // 残りの最高入札額を取得して current_price を更新
  const { data: topBid } = await admin
    .from('bids')
    .select('amount')
    .eq('artwork_id', artworkId)
    .order('amount', { ascending: false })
    .limit(1)
    .single()

  const newPrice = topBid?.amount ?? artwork.starting_price ?? 0
  await admin
    .from('artworks')
    .update({ current_price: newPrice })
    .eq('id', artworkId)

  return NextResponse.json({ success: true, newPrice })
}
