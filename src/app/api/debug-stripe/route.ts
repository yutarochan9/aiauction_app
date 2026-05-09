import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.STRIPE_SECRET_KEY ?? ''
  return NextResponse.json({
    prefix: key.substring(0, 12),
    suffix: key.substring(key.length - 6),
    length: key.length,
    hasKey: key.length > 0,
  })
}
