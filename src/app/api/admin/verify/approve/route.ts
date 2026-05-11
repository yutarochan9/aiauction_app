import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  // 管理者メール一覧（環境変数 ADMIN_EMAILS からカンマ区切りで取得）
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)

  // Supabase server client で認証チェック
  const { createClient: createServerClient } = await import('@/lib/supabase/server')
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !adminEmails.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { verificationId, userId } = await request.json()

  if (!verificationId || !userId) {
    return NextResponse.json({ error: 'verificationId and userId are required' }, { status: 400 })
  }

  // identity_verifications テーブルを verified に更新
  const { error: verifyError } = await supabaseAdmin
    .from('identity_verifications')
    .update({ status: 'verified', reviewed_at: new Date().toISOString() })
    .eq('id', verificationId)

  if (verifyError) {
    console.error('Failed to update identity_verifications:', verifyError)
    return NextResponse.json({ error: 'Failed to update verification record' }, { status: 500 })
  }

  // users テーブルの identity_verified を true に
  const { error: userError } = await supabaseAdmin
    .from('users')
    .update({ identity_verified: true, identity_verified_at: new Date().toISOString() })
    .eq('id', userId)

  if (userError) {
    console.error('Failed to update users:', userError)
    return NextResponse.json({ error: 'Failed to update user record' }, { status: 500 })
  }

  // ユーザーに通知
  await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    type: 'identity_verified',
    title: 'Identity Verified',
    body: 'Your identity has been verified. You can now approve avatar creation agreements.',
    url: '/settings',
  })

  return NextResponse.json({ success: true })
}
