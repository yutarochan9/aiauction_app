import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  // Vercel Cronからのリクエストのみ許可
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('artworks')
    .update({ status: 'active' })
    .eq('status', 'scheduled')
    .lte('start_at', new Date().toISOString())
    .select('id, title_en')

  if (error) {
    console.error('cron error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`Activated ${data?.length ?? 0} auctions`)
  return NextResponse.json({ activated: data?.length ?? 0 })
}
