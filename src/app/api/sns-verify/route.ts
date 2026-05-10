import { NextRequest, NextResponse } from 'next/server'

// SNS投稿URLに確認コードが含まれているか検証
// MVPのため、OGP/HTMLから確認コードを検索する簡易実装
export async function POST(request: NextRequest) {
  const { url, code } = await request.json()

  if (!url || !code) {
    return NextResponse.json({ verified: false, error: 'Missing params' })
  }

  try {
    // 投稿URLのHTMLを取得してコードを検索
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIAuctionBot/1.0)' },
      signal: AbortSignal.timeout(5000),
    })
    const html = await res.text()

    const verified = html.includes(code)
    return NextResponse.json({ verified })
  } catch {
    return NextResponse.json({ verified: false, error: 'Failed to fetch URL' })
  }
}
