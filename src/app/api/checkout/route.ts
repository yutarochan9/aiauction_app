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
    .select('*, users(email)')
    .eq('id', artworkId)
    .single()

  if (!artwork || artwork.status !== 'ended') {
    return NextResponse.json({ error: 'Artwork not available' }, { status: 400 })
  }

  // 落札者確認（最高入札者）
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
  // 手数料5%をプラットフォームが受け取る
  const platformFee = Math.round(amountCents * 0.05)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  // Stripeチェックアウトセッション作成
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: artwork.title_en,
            description: artwork.description_en ?? '',
            images: artwork.image_url ? [artwork.image_url] : [],
          },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      // アプリケーションフィー（5%）
      application_fee_amount: platformFee,
    },
    success_url: `${appUrl}/dashboard?payment=success&artwork=${artworkId}`,
    cancel_url: `${appUrl}/auction/${artworkId}`,
    metadata: {
      artwork_id: artworkId,
      buyer_id: user.id,
      seller_id: artwork.user_id,
    },
  })

  return NextResponse.json({ url: session.url })
}
