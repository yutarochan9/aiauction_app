import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// オークション落札後のStripe決済セッション作成
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { artworkId } = await request.json()

  // 作品情報取得
  const { data: artwork } = await supabase
    .from('artworks')
    .select('*')
    .eq('id', artworkId)
    .single()

  if (!artwork) {
    return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
  }

  // 既に落札済みなら拒否
  if (artwork.status === 'sold') {
    return NextResponse.json({ error: 'Already sold' }, { status: 400 })
  }

  // オークション終了前なら拒否
  if (new Date(artwork.end_at) > new Date()) {
    return NextResponse.json({ error: 'Auction still running' }, { status: 400 })
  }

  // 落札者確認（Top Bid者）
  const { data: topBid } = await supabase
    .from('bids')
    .select('user_id, amount')
    .eq('artwork_id', artworkId)
    .order('amount', { ascending: false })
    .limit(1)
    .single()

  if (!topBid || topBid.user_id !== user.id) {
    return NextResponse.json({ error: 'Not the winner' }, { status: 403 })
  }

  const amountCents = Math.round(topBid.amount * 100)
  const origin = new URL(request.url).origin
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin

  // Stripeチェックアウトセッション作成
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: artwork.title_en ?? artwork.title_ja,
              description: artwork.description_en ?? artwork.description_ja ?? '',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard?payment=success&artwork=${artworkId}`,
      cancel_url: `${appUrl}/auction/${artworkId}`,
      metadata: {
        artwork_id: artworkId,
        buyer_id: user.id,
        seller_id: artwork.user_id,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    console.error('Stripe error:', e)
    return NextResponse.json({ error: e?.message ?? 'Stripe error' }, { status: 500 })
  }
}
