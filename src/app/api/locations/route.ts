import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('active', true)
      .order('name')

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Locations GET failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Байршлын мэдээлэл авч чадсангүй' }, { status: 500 })
  }
}
