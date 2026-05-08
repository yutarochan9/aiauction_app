import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient as createServerClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Stripeからのwebhookを受信して決済完了処理を行う
export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const { artwork_id, buyer_id, seller_id } = session.metadata!

  // サービスロールキーを使って認証をバイパス（webhook処理のため）
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 購入者固有ID生成
  const buyerUniqueId = `${buyer_id.slice(0, 8)}-${artwork_id.slice(0, 8)}-${Date.now()}`

  // ダウンロードURL（24時間有効な署名付きURL）
  const { data: signedUrl } = await supabase.storage
    .from('artwork-originals')
    .createSignedUrl(`${buyer_id}/${artwork_id}/original.webp`, 60 * 60 * 24)

  // 高解像度画像に購入者固有IDを透かしとして埋め込む
  const { data: origData } = await supabase.storage
    .from('artwork-originals')
    .download(`${buyer_id}/${artwork_id}/original.webp`)

  if (origData) {
    const origBuffer = Buffer.from(await origData.arrayBuffer())
    const watermarked = await sharp(origBuffer)
      .composite([
        {
          input: Buffer.from(
            `<svg width="1200" height="1200">
              <text x="50%" y="50%"
                font-family="Arial" font-size="20" fill="white" fill-opacity="0.3"
                text-anchor="middle" dominant-baseline="middle"
                transform="rotate(-30, 600, 600)"
              >${buyerUniqueId}</text>
            </svg>`
          ),
          blend: 'over',
        },
      ])
      .webp({ quality: 95 })
      .toBuffer()

    // 透かし入り高解像度を保存（購入者専用パス）
    await supabase.storage
      .from('artwork-originals')
      .upload(`purchases/${buyer_id}/${artwork_id}.webp`, watermarked, {
        contentType: 'image/webp',
        upsert: true,
      })
  }

  // purchasesテーブルに記録
  await supabase.from('purchases').insert({
    artwork_id,
    buyer_id,
    seller_id,
    amount: (session.amount_total ?? 0) / 100,
    stripe_payment_id: session.payment_intent as string,
    buyer_unique_id: buyerUniqueId,
    download_url: signedUrl?.signedUrl,
    download_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  })

  // artworksのステータスをsoldに更新
  await supabase
    .from('artworks')
    .update({ status: 'sold' })
    .eq('id', artwork_id)

  return NextResponse.json({ received: true })
}
