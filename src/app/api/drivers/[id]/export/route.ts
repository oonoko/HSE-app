import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/session'
import { loadDriverReport, ReportAccessError } from '@/lib/driver-report-data'
import { buildDriverWorkbook } from '@/lib/driver-report-export'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 })
    const { id } = await params
    const payload = await loadDriverReport(createAdminClient(), id, session)
    const buffer = await buildDriverWorkbook(payload)
    const filename = `hogjliin-tailan-${payload.user.sap_id}.xlsx`
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof ReportAccessError) return NextResponse.json({ error: error.message }, { status: 403 })
    console.error('Driver export failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Тайлан татаж чадсангүй' }, { status: 500 })
  }
}
