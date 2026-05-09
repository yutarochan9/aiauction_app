import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { offerId, accept } = await request.json()

  const { data: offer } = await supabase
    .from('second_chance_offers')
    .select('*')
    .eq('id', offerId)
    .single()

  if (!offer || offer.offered_to_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (offer.status !== 'pending')
    return NextResponse.json({ error: 'Offer already responded' }, { status: 400 })
  if (new Date(offer.expires_at) < new Date())
    return NextResponse.json({ error: 'Offer expired' }, { status: 400 })

  if (!accept) {
    await supabase
      .from('second_chance_offers')
      .update({ status: 'declined' })
      .eq('id', offerId)
    return NextResponse.json({ success: true, declined: true })
  }

  // 承諾 → Stripe Checkout セッション作成
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })

  const { data: artwork } = await supabase
    .from('artworks')
    .select('title_en, title_ja, user_id')
    .eq('id', offer.artwork_id)
    .single()

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aia2-aiartauction.vercel.app'
  const amountCents = Math.round(offer.amount * 100)
  const params = new URLSearchParams()
  params.append('mode', 'payment')
  params.append('payment_method_types[0]', 'card')
  params.append('line_items[0][price_data][currency]', 'usd')
  params.append('line_items[0][price_data][unit_amount]', String(amountCents))
  params.append('line_items[0][price_data][product_data][name]', artwork?.title_en ?? 'Artwork')
  params.append('line_items[0][quantity]', '1')
  params.append('success_url', `${origin}/dashboard?payment=success&artwork=${offer.artwork_id}`)
  params.append('cancel_url', `${origin}/dashboard`)
  params.append('metadata[artwork_id]', offer.artwork_id)
  params.append('metadata[buyer_id]', user.id)
  params.append('metadata[seller_id]', artwork?.user_id ?? '')
  params.append('metadata[second_chance_offer_id]', offerId)

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data?.error?.message }, { status: 500 })

  return NextResponse.json({ url: data.url })
}
