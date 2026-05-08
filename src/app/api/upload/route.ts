import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import sharp from 'sharp'

// 画像アップロードAPI
// 1. 高解像度オリジナルを非公開ストレージに保存
// 2. 低解像度（600px以下）＋透かし付きサムネイルを公開ストレージに保存
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // ログイン確認
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file' }, { status: 400 })
  }

  // ファイルサイズチェック（10MB上限）
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
  }

  // 拡張子チェック
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const fileId = `${user.id}/${Date.now()}`

  // オリジナル画像を非公開ストレージに保存
  let origBuffer: Buffer
  try {
    origBuffer = await sharp(buffer).webp({ quality: 95 }).toBuffer()
  } catch (e) {
    console.error('sharp original error:', e)
    return NextResponse.json({ error: 'Image processing failed' }, { status: 500 })
  }

  const { error: origError } = await supabase.storage
    .from('artwork-originals')
    .upload(`${fileId}/original.webp`, origBuffer, {
      contentType: 'image/webp',
    })

  if (origError) {
    console.error('original upload error:', origError)
    return NextResponse.json({ error: `Upload failed: ${origError.message}` }, { status: 500 })
  }

  // 低解像度サムネイル生成（600px以下・透かしなし）
  let thumbnail: Buffer
  try {
    thumbnail = await sharp(buffer)
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
  } catch (e) {
    console.error('sharp thumbnail error:', e)
    return NextResponse.json({ error: 'Thumbnail generation failed' }, { status: 500 })
  }

  // サムネイルを公開ストレージに保存
  const { error: thumbError } = await supabase.storage
    .from('artwork-previews')
    .upload(`${fileId}/thumbnail.webp`, thumbnail, {
      contentType: 'image/webp',
    })

  if (thumbError) {
    console.error('thumbnail upload error:', thumbError)
    return NextResponse.json({ error: `Thumbnail upload failed: ${thumbError.message}` }, { status: 500 })
  }

  // 公開URLを取得
  const { data: urlData } = supabase.storage
    .from('artwork-previews')
    .getPublicUrl(`${fileId}/thumbnail.webp`)

  return NextResponse.json({
    imageUrl: urlData.publicUrl,
    originalPath: `${fileId}/original.webp`,
  })
}
