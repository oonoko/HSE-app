import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { UploadError, storeImage } from '@/lib/image-upload'

export async function POST(req: NextRequest) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
    const formData = await req.formData()
    const stored = await storeImage(formData.get('file'), new Date().toISOString().slice(0, 10))
    return NextResponse.json({ data: stored }, { status: 201 })
  } catch (error) {
    if (error instanceof UploadError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Upload failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Зураг upload хийж чадсангүй' }, { status: 500 })
  }
}
