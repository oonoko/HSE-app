import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/session'
import { maskReporter } from '@/lib/hazard'
import { buildHazardWorkbook, type HazardRow } from '@/lib/hazard-export'
import { shiftLabel } from '@/lib/shifts'

export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
    const supabase = createAdminClient()
    let query = supabase.from('hazard_reports').select('*, reporter:users!hazard_reports_reporter_id_fkey(name, sap_id)').order('created_at', { ascending: false }).limit(5000)
    const scoped = !admin.is_super_admin && admin.shift_number
    if (scoped) query = query.or(`shift_number.eq.${admin.shift_number},shift_number.is.null`)
    const { data, error } = await query
    if (error) throw error
    const rows = ((data ?? []) as unknown as HazardRow[]).map(row => maskReporter(row))
    const buffer = await buildHazardWorkbook(rows, scoped ? shiftLabel(admin.shift_number) : 'Бүх ээлж')
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="hazard-reports.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (typeof error === 'object' && error && ['42P01', 'PGRST205'].includes((error as { code?: string }).code ?? '')) {
      return NextResponse.json({ error: 'Аюулын мэдээллийн хүснэгт үүсээгүй байна', setup_required: true }, { status: 503 })
    }
    console.error('Hazard export failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Тайлан татаж чадсангүй' }, { status: 500 })
  }
}
