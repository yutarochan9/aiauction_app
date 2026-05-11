// -- 実行するSQL（Supabaseコンソールで実行が必要） --
// CREATE TABLE identity_verifications (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
//   status text DEFAULT 'pending' NOT NULL,
//   full_name text,
//   document_type text,
//   document_front_path text,
//   document_back_path text,
//   selfie_path text,
//   note text,
//   submitted_at timestamptz DEFAULT now(),
//   reviewed_at timestamptz,
//   created_at timestamptz DEFAULT now(),
//   UNIQUE(user_id)
// );
// ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_verified boolean DEFAULT false;
// ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_verified_at timestamptz;
// CREATE STORAGE BUCKET identity-docs (private=true);

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = ['image/jpeg', 'image/png']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const BUCKET = 'identity-docs'

function getExtension(mimeType: string): string {
  return mimeType === 'image/png' ? 'png' : 'jpg'
}

async function uploadFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  file: File,
  path: string
): Promise<{ error: string | null }> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: `Invalid file type: ${file.type}. Only JPG and PNG are accepted.` }
  }
  if (file.size > MAX_SIZE) {
    return { error: `File too large (max 10MB): ${path}` }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (error) {
    return { error: `Storage upload failed for ${path}: ${error.message}` }
  }
  return { error: null }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check existing verification status — block if already verified
  const { data: existing } = await supabase
    .from('identity_verifications')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing?.status === 'verified') {
    return NextResponse.json(
      { error: 'Your identity is already verified.' },
      { status: 400 }
    )
  }

  // Parse form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }

  const fullName = (formData.get('full_name') as string | null)?.trim() ?? ''
  const documentType = (formData.get('document_type') as string | null)?.trim() ?? ''
  const frontFile = formData.get('front') as File | null
  const backFile = formData.get('back') as File | null
  const selfieFile = formData.get('selfie') as File | null

  // Validate required fields
  if (!fullName) {
    return NextResponse.json({ error: 'Full name is required.' }, { status: 400 })
  }
  if (!documentType) {
    return NextResponse.json({ error: 'Document type is required.' }, { status: 400 })
  }
  if (!frontFile || frontFile.size === 0) {
    return NextResponse.json({ error: 'Document front image is required.' }, { status: 400 })
  }
  if (!selfieFile || selfieFile.size === 0) {
    return NextResponse.json({ error: 'Selfie photo is required.' }, { status: 400 })
  }

  const userId = user.id

  // Upload front
  const frontPath = `${userId}/front.${getExtension(frontFile.type)}`
  const { error: frontError } = await uploadFile(supabase, frontFile, frontPath)
  if (frontError) {
    return NextResponse.json({ error: frontError }, { status: 500 })
  }

  // Upload back (optional)
  let backPath: string | null = null
  if (backFile && backFile.size > 0) {
    backPath = `${userId}/back.${getExtension(backFile.type)}`
    const { error: backError } = await uploadFile(supabase, backFile, backPath)
    if (backError) {
      return NextResponse.json({ error: backError }, { status: 500 })
    }
  }

  // Upload selfie
  const selfiePath = `${userId}/selfie.${getExtension(selfieFile.type)}`
  const { error: selfieError } = await uploadFile(supabase, selfieFile, selfiePath)
  if (selfieError) {
    return NextResponse.json({ error: selfieError }, { status: 500 })
  }

  // Upsert identity_verifications record
  const { error: upsertError } = await supabase
    .from('identity_verifications')
    .upsert(
      {
        user_id: userId,
        full_name: fullName,
        document_type: documentType,
        document_front_path: frontPath,
        document_back_path: backPath,
        selfie_path: selfiePath,
        status: 'pending',
        submitted_at: new Date().toISOString(),
        note: null,
      },
      { onConflict: 'user_id' }
    )

  if (upsertError) {
    return NextResponse.json(
      { error: `Database error: ${upsertError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
