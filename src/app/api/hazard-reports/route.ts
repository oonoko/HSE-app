import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession, requireAdmin } from '@/lib/session'
import { imagePublicPrefix } from '@/lib/image-upload'
import { MAX_REPORTS_PER_DAY, maskReporter, validateHazardInput } from '@/lib/hazard'
import { mongoliaDate } from '@/lib/date'

const isMissingTable = (error: unknown) => !!error && typeof error === 'object' && ['42P01', 'PGRST205'].includes((error as { code?: string }).code ?? '')
const TABLE_HINT = 'Аюулын мэдээллийн хүснэгт үүсээгүй байна. supabase/migrate_hazard_reports.sql файлыг Supabase SQL Editor дээр ажиллуулна уу.'
const REPORTER = 'reporter:users!hazard_reports_reporter_id_fkey(name, sap_id, department, shift_number)'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const supabase = createAdminClient()

    if (searchParams.get('admin') === 'true') {
      const admin = await requireAdmin()
      if (!admin) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
      let query = supabase.from('hazard_reports').select(`*, ${REPORTER}`).order('created_at', { ascending: false }).limit(1000)
      if (!admin.is_super_admin && admin.shift_number) query = query.or(`shift_number.eq.${admin.shift_number},shift_number.is.null`)
      else if (searchParams.get('shift')) query = query.eq('shift_number', Number(searchParams.get('shift')))
      const { data, error } = await query
      if (error) throw error
      return NextResponse.json({ data: ((data ?? []) as Array<Record<string, any>>).map(row => maskReporter(row as { anonymous: boolean; reporter?: { name: string; sap_id: string } | null })) })
    }

    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 })
    const { data, error } = await supabase.from('hazard_reports')
      .select('id, kind, category, severity, location_text, description, image_urls, status, admin_note, anonymous, handled_at, created_at')
      .eq('reporter_id', session.id).order('created_at', { ascending: false }).limit(200)
    if (error) throw error
    return NextResponse.json({ data: data ?? [] })
  } catch (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: TABLE_HINT, setup_required: true }, { status: 503 })
    console.error('Hazard reports GET failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Мэдээлэл авч чадсангүй' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 })
    const checked = validateHazardInput(await req.json(), imagePublicPrefix())
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })

    const supabase = createAdminClient()
    const dayStart = new Date(`${mongoliaDate()}T00:00:00+08:00`).toISOString()
    const { count, error: countError } = await supabase.from('hazard_reports').select('id', { count: 'exact', head: true }).eq('reporter_id', session.id).gte('created_at', dayStart)
    if (countError) throw countError
    if ((count ?? 0) >= MAX_REPORTS_PER_DAY) return NextResponse.json({ error: `Өдөрт ${MAX_REPORTS_PER_DAY}-аас олон мэдээлэл илгээх боломжгүй` }, { status: 429 })

    const { data: reporter, error: reporterError } = await supabase.from('users').select('shift_number').eq('id', session.id).maybeSingle()
    if (reporterError) throw reporterError
    const { data, error } = await supabase.from('hazard_reports').insert({
      reporter_id: session.id, shift_number: reporter?.shift_number ?? null, ...checked.value,
    }).select('id, status, created_at').single()
    if (error) throw error
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: TABLE_HINT, setup_required: true }, { status: 503 })
    console.error('Hazard reports POST failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Мэдээлэл илгээж чадсангүй' }, { status: 500 })
  }
}
