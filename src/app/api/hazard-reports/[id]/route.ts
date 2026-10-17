import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/session'
import { HAZARD_STATUSES } from '@/lib/hazard'

// Admins triage a report: change its status and leave a note the reporter can read.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
    const { id } = await params
    const body = await req.json()
    if (!HAZARD_STATUSES.some(item => item.value === body.status)) return NextResponse.json({ error: 'Төлөв буруу байна' }, { status: 400 })
    const note = String(body.admin_note ?? '').trim().slice(0, 1000)

    const supabase = createAdminClient()
    const { data: report, error: findError } = await supabase.from('hazard_reports').select('id, shift_number').eq('id', id).single()
    if (findError) throw findError
    if (!admin.is_super_admin && admin.shift_number && report.shift_number !== null && report.shift_number !== admin.shift_number) {
      return NextResponse.json({ error: 'Зөвхөн өөрийн ээлжийн мэдээллийг шийдвэрлэнэ' }, { status: 403 })
    }
    const now = new Date().toISOString()
    const { data, error } = await supabase.from('hazard_reports')
      .update({ status: body.status, admin_note: note || null, handled_by: admin.id, handled_at: now, updated_at: now })
      .eq('id', id).select('id, status, admin_note, handled_at').single()
    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Hazard report update failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Мэдээлэл шинэчилж чадсангүй' }, { status: 500 })
  }
}
