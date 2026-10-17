import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { UploadError, storeImage } from '@/lib/image-upload'

// Any signed-in person may attach photos to a report they are writing.
export async function POST(req: NextRequest) {
  try {
    if (!await getSession()) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 })
    const formData = await req.formData()
    const stored = await storeImage(formData.get('file'), `reports/${new Date().toISOString().slice(0, 10)}`)
    return NextResponse.json({ data: stored }, { status: 201 })
  } catch (error) {
    if (error instanceof UploadError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Hazard upload failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Зураг upload хийж чадсангүй' }, { status: 500 })
  }
}
