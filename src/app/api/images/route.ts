import { NextRequest, NextResponse } from 'next/server'
import { MOCK_IMAGES, getTodayImage } from '@/lib/mock-data'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const locationId = searchParams.get('location_id')
  const todayOnly = searchParams.get('today') === 'true'

  const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true'

  if (isMock) {
    if (todayOnly) {
      const img = getTodayImage(locationId ?? undefined)
      return NextResponse.json({ data: img ? [img] : [] })
    }
    let filtered = MOCK_IMAGES
    if (date) filtered = filtered.filter(img => img.date === date)
    if (locationId) filtered = filtered.filter(img => img.location_id === locationId)
    return NextResponse.json({ data: filtered })
  }

  try {
    const supabase = createAdminClient()
    let query = supabase
      .from('hazard_images')
      .select('*, location:locations(*)')
      .order('date', { ascending: false })

    if (todayOnly) query = query.eq('date', new Date().toISOString().split('T')[0])
    else if (date) query = query.eq('date', date)
    if (locationId) query = query.eq('location_id', locationId)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Images GET failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Зургийн мэдээлэл авч чадсангүй' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true'
    if (isMock) {
      return NextResponse.json({ data: { id: `img-${Date.now()}`, ...body }, success: true })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('hazard_images')
      .insert({
        image_url: body.image_url,
        location_id: body.location_id,
        date: body.date,
        title: body.title,
        title_en: body.title_en,
        hazards: body.hazards ?? [],
        created_by: body.created_by,
      })
      .select('*, location:locations(*)')
      .single()

    if (error) throw error
    return NextResponse.json({ data, success: true }, { status: 201 })
  } catch (error) {
    console.error('Images POST failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Зураг хадгалж чадсангүй' }, { status: 500 })
  }
}
