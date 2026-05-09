import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.STRIPE_SECRET_KEY ?? ''

  // Stripe APIに直接リクエストしてキーが有効か確認
  const res = await fetch('https://api.stripe.com/v1/balance', {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  })

  const data = await res.json()

  return NextResponse.json({
    prefix: key.substring(0, 12),
    suffix: key.substring(key.length - 6),
    length: key.length,
    stripeStatus: res.status,
    stripeResponse: data,
  })
}
