import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Google OAuthのコールバック処理
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // 身元確認が未提出なら /verify へ
      const { data: vr } = await supabase
        .from('identity_verifications')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle()
      if (!vr) {
        return NextResponse.redirect(`${origin}/verify`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`)
}
