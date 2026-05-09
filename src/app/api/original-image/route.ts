import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const artworkId = request.nextUrl.searchParams.get('artworkId')
  if (!artworkId) {
    return NextResponse.json({ error: 'Missing artworkId' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 購入確認
  const { data: purchase } = await supabase
    .from('purchases')
    .select('id')
    .eq('buyer_id', user.id)
    .eq('artwork_id', artworkId)
    .single()

  if (!purchase) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 作品のオリジナルパスを取得
  const { data: artwork } = await supabase
    .from('artworks')
    .select('original_storage_path')
    .eq('id', artworkId)
    .single()

  if (!artwork?.original_storage_path) {
    return NextResponse.json({ error: 'Original not found' }, { status: 404 })
  }

  // admin clientでプライベートバケットからダウンロード
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await admin.storage
    .from('artwork-originals')
    .download(artwork.original_storage_path)

  if (error || !data) {
    console.error('download error:', error)
    return NextResponse.json({ error: 'Download failed' }, { status: 500 })
  }

  const arrayBuffer = await data.arrayBuffer()
  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
