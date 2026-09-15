import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/session'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_DIMENSION = 1600

export async function POST(req: NextRequest) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
    const formData = await req.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Зургийн файл шаардлагатай' }, { status: 400 })
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Зөвхөн зураг оруулна уу' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Зураг 10 MB-аас бага байх ёстой' }, { status: 400 })
    }

    const original = Buffer.from(await file.arrayBuffer())
    const compressed = await sharp(original)
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer()

    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`
    const supabase = createAdminClient()
    const { error } = await supabase.storage
      .from('hazard-images')
      .upload(path, compressed, { contentType: 'image/jpeg', upsert: false })

    if (error) throw error
    const { data } = supabase.storage.from('hazard-images').getPublicUrl(path)
    return NextResponse.json({ data: { path, publicUrl: data.publicUrl } }, { status: 201 })
  } catch (error) {
    console.error('Upload failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Зураг upload хийж чадсангүй' }, { status: 500 })
  }
}
