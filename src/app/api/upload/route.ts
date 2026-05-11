import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import sharp from 'sharp'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const VIDEO_TYPES = ['video/mp4', 'video/webm']
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp3']
const MODEL_TYPES = ['model/gltf-binary', 'model/gltf+json', 'application/octet-stream']

const MAX_IMAGE_SIZE = 10 * 1024 * 1024   // 10MB
const MAX_MEDIA_SIZE = 50 * 1024 * 1024   // 50MB

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const thumbnailFile = formData.get('thumbnail') as File | null
  const fileFormat = (formData.get('fileFormat') as string) ?? 'image'

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const fileId = `${user.id}/${Date.now()}`

  // --- 画像以外のファイル（video/audio/3D）---
  if (fileFormat !== 'image') {
    const maxSize = MAX_MEDIA_SIZE
    if (file.size > maxSize) return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 })

    // オリジナルファイルを非公開バケットに保存
    const ext = file.name.split('.').pop()?.toLowerCase() ?? fileFormat
    const origBuffer = Buffer.from(await file.arrayBuffer())
    const originalPath = `${fileId}/original.${ext}`

    const { error: origError } = await supabase.storage
      .from('artwork-originals')
      .upload(originalPath, origBuffer, { contentType: file.type, upsert: false })

    if (origError) return NextResponse.json({ error: `Upload failed: ${origError.message}` }, { status: 500 })

    // サムネイル画像をアップロード（必須）
    if (!thumbnailFile) return NextResponse.json({ error: 'Thumbnail required for non-image files' }, { status: 400 })
    if (!IMAGE_TYPES.includes(thumbnailFile.type)) return NextResponse.json({ error: 'Thumbnail must be an image' }, { status: 400 })

    const thumbRaw = Buffer.from(await thumbnailFile.arrayBuffer())
    const thumbnail = await sharp(thumbRaw)
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()

    const { error: thumbError } = await supabase.storage
      .from('artwork-previews')
      .upload(`${fileId}/thumbnail.webp`, thumbnail, { contentType: 'image/webp' })

    if (thumbError) return NextResponse.json({ error: `Thumbnail upload failed: ${thumbError.message}` }, { status: 500 })

    const { data: urlData } = supabase.storage.from('artwork-previews').getPublicUrl(`${fileId}/thumbnail.webp`)

    return NextResponse.json({ imageUrl: urlData.publicUrl, originalPath })
  }

  // --- 画像ファイル ---
  if (file.size > MAX_IMAGE_SIZE) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
  if (!IMAGE_TYPES.includes(file.type)) return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  // オリジナルを非公開バケットに保存
  const origBuffer = await sharp(buffer).webp({ quality: 95 }).toBuffer()
  const { error: origError } = await supabase.storage
    .from('artwork-originals')
    .upload(`${fileId}/original.webp`, origBuffer, { contentType: 'image/webp' })

  if (origError) return NextResponse.json({ error: `Upload failed: ${origError.message}` }, { status: 500 })

  // 低解像度サムネイル（600px以下）
  const thumbnail = await sharp(buffer)
    .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()

  const { error: thumbError } = await supabase.storage
    .from('artwork-previews')
    .upload(`${fileId}/thumbnail.webp`, thumbnail, { contentType: 'image/webp' })

  if (thumbError) return NextResponse.json({ error: `Thumbnail upload failed: ${thumbError.message}` }, { status: 500 })

  const { data: urlData } = supabase.storage.from('artwork-previews').getPublicUrl(`${fileId}/thumbnail.webp`)

  return NextResponse.json({
    imageUrl: urlData.publicUrl,
    originalPath: `${fileId}/original.webp`,
  })
}
