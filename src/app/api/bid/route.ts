import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendOutbidEmail, sendNewBidEmail } from '@/lib/email'
import { sendPushToUser } from '@/lib/push'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aia2-aiartauction.vercel.app'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { artworkId, amount } = await request.json()
  const numAmount = Number(amount)

  const { data: artwork } = await supabase
    .from('artworks')
    .select('user_id, status, end_at, current_price, starting_price, title_en, title_ja')
    .eq('id', artworkId)
    .single()

  if (!artwork) return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
  if (artwork.user_id === user.id) return NextResponse.json({ error: 'Cannot bid on own artwork' }, { status: 400 })
  if (artwork.status !== 'active') return NextResponse.json({ error: 'Auction not active' }, { status: 400 })
  if (new Date(artwork.end_at) <= new Date()) return NextResponse.json({ error: 'Auction ended' }, { status: 400 })

  const minBid = Math.max(artwork.current_price, artwork.starting_price) + 0.01
  if (numAmount < minBid) return NextResponse.json({ error: `Minimum bid is $${minBid.toFixed(2)}` }, { status: 400 })

  const { data: blocked } = await supabase
    .from('blacklists')
    .select('id')
    .eq('seller_id', artwork.user_id)
    .eq('blocked_user_id', user.id)
    .single()
  if (blocked) return NextResponse.json({ error: 'You are blocked from this auction' }, { status: 403 })

  // 上書きされる入札者（通知用）
  const { data: topBid } = await supabase
    .from('bids')
    .select('user_id')
    .eq('artwork_id', artworkId)
    .order('amount', { ascending: false })
    .limit(1)
    .single()
  const previousTopBidderId = topBid?.user_id !== user.id ? topBid?.user_id : null

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error: bidError } = await admin.from('bids').insert({
    artwork_id: artworkId,
    user_id: user.id,
    amount: numAmount,
  })
  if (bidError) return NextResponse.json({ error: 'Bid failed' }, { status: 500 })

  await admin.from('artworks').update({ current_price: numAmount }).eq('id', artworkId)

  const title = artwork.title_en || artwork.title_ja || 'an artwork'

  // 上書き通知（アプリ内 + メール）
  if (previousTopBidderId) {
    await admin.from('notifications').insert({
      user_id: previousTopBidderId,
      type: 'outbid',
      message: `You've been outbid on "${title}"`,
      artwork_id: artworkId,
    })
    // outbidメール
    const { data: outbidUser } = await admin.auth.admin.getUserById(previousTopBidderId)
    if (outbidUser?.user?.email) {
      sendOutbidEmail(outbidUser.user.email, title, numAmount, artworkId).catch(() => {})
    }
    sendPushToUser(previousTopBidderId, 'You\'ve been outbid', `Someone bid $${numAmount.toLocaleString()} on "${title}"`, `${BASE_URL}/auction/${artworkId}`).catch(() => {})
  }

  // 出品者へ新規入札メール
  const { data: sellerUser } = await admin.auth.admin.getUserById(artwork.user_id)
  const { data: bidderProfile } = await admin.from('users').select('display_name').eq('id', user.id).single()
  if (sellerUser?.user?.email) {
    sendNewBidEmail(
      sellerUser.user.email,
      title,
      numAmount,
      (bidderProfile as any)?.display_name ?? 'Someone',
      artworkId
    ).catch(() => {})
  }

  return NextResponse.json({ success: true, newPrice: numAmount })
}
