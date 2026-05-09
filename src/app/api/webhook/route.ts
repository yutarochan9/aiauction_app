import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

function verifySignature(body: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')))
  const timestamp = parts['t']
  const sig = parts['v1']
  if (!timestamp || !sig) return false
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature') ?? ''
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  if (!verifySignature(body, sig, secret)) {
    console.error('[webhook] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(body)
  console.log('[webhook] event type:', event.type)

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const { artwork_id, buyer_id, seller_id } = session.metadata ?? {}

    if (!artwork_id || !buyer_id) {
      console.error('[webhook] missing metadata', session.metadata)
      return NextResponse.json({ received: true })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // アートワークをsoldに更新
    const { error: artErr } = await supabase
      .from('artworks')
      .update({ status: 'sold' })
      .eq('id', artwork_id)

    if (artErr) console.error('[webhook] artwork update error:', artErr)
    else console.log('[webhook] artwork', artwork_id, 'marked as sold')

    // 購入履歴を記録
    const { error: purchaseErr } = await supabase.from('purchases').insert({
      artwork_id,
      buyer_id,
      seller_id: seller_id ?? null,
      amount: (session.amount_total ?? 0) / 100,
      stripe_payment_id: session.payment_intent ?? session.id,
    })

    if (purchaseErr) console.error('[webhook] purchase insert error:', purchaseErr.message)
    else console.log('[webhook] purchase recorded')

    // セカンドチャンスオファーの場合はステータスを更新
    const secondChanceOfferId = session.metadata?.second_chance_offer_id
    if (secondChanceOfferId) {
      await supabase
        .from('second_chance_offers')
        .update({ status: 'accepted' })
        .eq('id', secondChanceOfferId)
      console.log('[webhook] second chance offer', secondChanceOfferId, 'accepted')
    }
  }

  return NextResponse.json({ received: true })
}
