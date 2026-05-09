import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bidId, artworkId } = await request.json()

  // 出品者本人かチェック
  const { data: artwork } = await supabase
    .from('artworks')
    .select('user_id, status')
    .eq('id', artworkId)
    .single()

  if (!artwork || artwork.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (artwork.status !== 'active') {
    return NextResponse.json({ error: 'Auction already ended' }, { status: 400 })
  }

  // 入札を削除
  const { error: deleteErr } = await supabase
    .from('bids')
    .delete()
    .eq('id', bidId)
    .eq('artwork_id', artworkId)

  if (deleteErr) {
    return NextResponse.json({ error: 'Failed to cancel bid' }, { status: 500 })
  }

  // 残りの最高入札額を取得して current_price を更新
  const { data: topBid } = await supabase
    .from('bids')
    .select('amount')
    .eq('artwork_id', artworkId)
    .order('amount', { ascending: false })
    .limit(1)
    .single()

  const { data: artworkFull } = await supabase
    .from('artworks')
    .select('starting_price')
    .eq('id', artworkId)
    .single()

  const newPrice = topBid?.amount ?? artworkFull?.starting_price ?? 0
  await supabase
    .from('artworks')
    .update({ current_price: newPrice })
    .eq('id', artworkId)

  return NextResponse.json({ success: true, newPrice })
}
