import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/session'
import { loadDriverReport, ReportAccessError } from '@/lib/driver-report-data'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 })
    const { id } = await params
    return NextResponse.json({ data: await loadDriverReport(createAdminClient(), id, session) })
  } catch (error) {
    if (error instanceof ReportAccessError) return NextResponse.json({ error: error.message }, { status: 403 })
    console.error('Driver report failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Тайлан авч чадсангүй' }, { status: 500 })
  }
}
