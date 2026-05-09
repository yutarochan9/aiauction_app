import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { sendPaymentReceivedEmail, sendWonAuctionEmail } from '@/lib/email'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Supabase admin client (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret || webhookSecret === 'whsec_your_webhook_secret') {
    // 開発環境でwebhook secretが未設定の場合は署名検証をスキップ
    console.warn('Webhook secret not configured, skipping signature verification')
    const event = JSON.parse(body) as Stripe.Event
    return handleEvent(event)
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig!, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  return handleEvent(event)
}

async function handleEvent(event: Stripe.Event) {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { artwork_id, buyer_id, seller_id } = session.metadata ?? {}

    if (!artwork_id || !buyer_id) {
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    const amountPaid = (session.amount_total ?? 0) / 100

    // 作品を落札済みに更新
    await supabaseAdmin
      .from('artworks')
      .update({ status: 'sold' })
      .eq('id', artwork_id)

    // 既存purchaseがあれば作成しない
    const { data: existing } = await supabaseAdmin
      .from('purchases')
      .select('id')
      .eq('artwork_id', artwork_id)
      .single()

    if (existing) {
      return NextResponse.json({ received: true })
    }

    // purchasesレコード作成
    const { error } = await supabaseAdmin
      .from('purchases')
      .insert({
        artwork_id,
        buyer_id,
        seller_id: seller_id ?? '',
        amount: amountPaid,
        stripe_payment_id: session.id,
      })

    if (error) {
      console.error('Failed to create purchase record:', error)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    // 作品タイトル取得してメール送信
    const { data: artwork } = await supabaseAdmin
      .from('artworks')
      .select('title_en, title_ja')
      .eq('id', artwork_id)
      .single()
    const title = artwork?.title_en || artwork?.title_ja || 'Artwork'

    const [{ data: sellerData }, { data: buyerData }] = await Promise.all([
      seller_id ? supabaseAdmin.auth.admin.getUserById(seller_id) : Promise.resolve({ data: null }),
      supabaseAdmin.auth.admin.getUserById(buyer_id),
    ])
    if (sellerData?.user?.email) {
      sendPaymentReceivedEmail(sellerData.user.email, title, amountPaid, artwork_id).catch(() => {})
    }
    if (buyerData?.user?.email) {
      sendWonAuctionEmail(buyerData.user.email, title, amountPaid, artwork_id).catch(() => {})
    }
  }

  return NextResponse.json({ received: true })
}
