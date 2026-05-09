import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { artworkId } = await request.json()

  // 出品者確認・オークション終了確認
  const { data: artwork } = await supabase
    .from('artworks')
    .select('user_id, status, end_at, starting_price')
    .eq('id', artworkId)
    .single()

  if (!artwork || artwork.user_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (artwork.status === 'sold')
    return NextResponse.json({ error: 'Already sold' }, { status: 400 })
  if (new Date(artwork.end_at) > new Date())
    return NextResponse.json({ error: 'Auction still running' }, { status: 400 })

  // 既存のpending offerがないか確認
  const { data: existingOffer } = await supabase
    .from('second_chance_offers')
    .select('id, status')
    .eq('artwork_id', artworkId)
    .eq('status', 'pending')
    .single()

  if (existingOffer)
    return NextResponse.json({ error: 'Offer already exists' }, { status: 400 })

  // 入札を高い順に取得
  const { data: bids } = await supabase
    .from('bids')
    .select('user_id, amount')
    .eq('artwork_id', artworkId)
    .order('amount', { ascending: false })
    .limit(10)

  if (!bids || bids.length === 0)
    return NextResponse.json({ error: 'No bids found' }, { status: 400 })

  const originalWinnerId = bids[0].user_id

  // 次点入札者（違うユーザー）を探す
  const secondBid = bids.find(b => b.user_id !== originalWinnerId)
  if (!secondBid)
    return NextResponse.json({ noSecondBidder: true, message: 'No second bidder. You can re-list the artwork.' })

  // セカンドチャンスオファー作成（48時間有効）
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString()
  const { data: offer, error } = await supabase
    .from('second_chance_offers')
    .insert({
      artwork_id: artworkId,
      original_winner_id: originalWinnerId,
      offered_to_id: secondBid.user_id,
      amount: secondBid.amount,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error)
    return NextResponse.json({ error: 'Failed to create offer' }, { status: 500 })

  return NextResponse.json({ success: true, offer })
}
