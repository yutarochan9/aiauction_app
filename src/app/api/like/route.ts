import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { artworkId } = await request.json()

  const { data: existing } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('artwork_id', artworkId)
    .single()

  if (existing) {
    await supabase.from('likes').delete().eq('id', existing.id)
    return NextResponse.json({ liked: false })
  } else {
    await supabase.from('likes').insert({ user_id: user.id, artwork_id: artworkId })
    return NextResponse.json({ liked: true })
  }
}
