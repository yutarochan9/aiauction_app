import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { artworkId, endAt } = await request.json()

  const { data: artwork } = await supabase
    .from('artworks')
    .select('user_id, status, starting_price')
    .eq('id', artworkId)
    .single()

  if (!artwork || artwork.user_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (artwork.status === 'sold')
    return NextResponse.json({ error: 'Already sold' }, { status: 400 })

  const { error } = await supabase
    .from('artworks')
    .update({
      status: 'active',
      end_at: endAt,
      current_price: artwork.starting_price,
    })
    .eq('id', artworkId)

  if (error) return NextResponse.json({ error: 'Failed to re-list' }, { status: 500 })

  // 古い入札を削除して再スタート
  await supabase.from('bids').delete().eq('artwork_id', artworkId)

  return NextResponse.json({ success: true })
}
