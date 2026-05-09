import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    console.error('[checkout] STRIPE_SECRET_KEY is not set')
    return NextResponse.json({ error: 'Stripe key not configured' }, { status: 500 })
  }

  console.log('[checkout] key prefix:', key.substring(0, 12), 'len:', key.length)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { artworkId } = await request.json()
  console.log('[checkout] artworkId:', artworkId, 'userId:', user.id)

  const { data: artwork } = await supabase
    .from('artworks')
    .select('*')
    .eq('id', artworkId)
    .single()

  if (!artwork) {
    return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
  }

  if (artwork.status === 'sold') {
    return NextResponse.json({ error: 'Already sold' }, { status: 400 })
  }

  if (new Date(artwork.end_at) > new Date()) {
    return NextResponse.json({ error: 'Auction still running' }, { status: 400 })
  }

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
  const productName = artwork.title_en ?? artwork.title_ja ?? 'Artwork'

  console.log('[checkout] amount cents:', amountCents, 'appUrl:', appUrl)

  const params = new URLSearchParams()
  params.append('mode', 'payment')
  params.append('payment_method_types[0]', 'card')
  params.append('line_items[0][price_data][currency]', 'usd')
  params.append('line_items[0][price_data][unit_amount]', String(amountCents))
  params.append('line_items[0][price_data][product_data][name]', productName)
  params.append('line_items[0][quantity]', '1')
  params.append('success_url', `${appUrl}/dashboard?payment=success&artwork=${artworkId}`)
  params.append('cancel_url', `${appUrl}/auction/${artworkId}`)
  params.append('metadata[artwork_id]', artworkId)
  params.append('metadata[buyer_id]', user.id)
  params.append('metadata[seller_id]', artwork.user_id)

  try {
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const stripeData = await stripeRes.json()
    console.log('[checkout] stripe status:', stripeRes.status, 'url:', stripeData?.url ?? stripeData?.error?.message)

    if (!stripeRes.ok) {
      console.error('[checkout] stripe error body:', JSON.stringify(stripeData))
      return NextResponse.json({ error: stripeData?.error?.message ?? 'Stripe error' }, { status: 500 })
    }

    return NextResponse.json({ url: stripeData.url })
  } catch (e: any) {
    console.error('[checkout] fetch error:', e?.message)
    return NextResponse.json({ error: e?.message ?? 'Network error' }, { status: 500 })
  }
}
