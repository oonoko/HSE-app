import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, requireSuperAdmin } from '@/lib/session'

export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 })
    const supabase = createAdminClient()
    let query = supabase.from('users').select('*').order('name')
    if (!admin.is_super_admin && admin.shift_number) query = query.eq('shift_number', admin.shift_number)
    const { data, error } = await query

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Users GET failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Ажилчдын мэдээлэл авч чадсангүй' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!await requireSuperAdmin()) return NextResponse.json({ error: 'Зөвхөн ерөнхий админ ажилтан засна' }, { status: 403 })
    const body = await req.json()
    const sapId = String(body.sap_id ?? '').trim()
    const name = String(body.name ?? '').trim()
    const department = String(body.department ?? '').trim()

    if (!sapId || !name || !department) {
      return NextResponse.json({ error: 'SAP ID, нэр, хэлтэс шаардлагатай' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const payload = {
        sap_id: sapId,
        name,
        department,
        location_id: body.location_id || null,
        role: body.role === 'admin' ? 'admin' : 'driver',
        shift_number: body.shift_number ? Number(body.shift_number) : null,
      }
    const operation = body.id
      ? supabase.from('users').update(payload).eq('id', body.id)
      : supabase.from('users').insert(payload)
    const { data, error } = await operation
      .select('*')
      .single()

    if (error?.code === '23505') {
      return NextResponse.json({ error: 'Энэ SAP ID бүртгэлтэй байна' }, { status: 409 })
    }
    if (error) throw error

    return NextResponse.json({ data }, { status: body.id ? 200 : 201 })
  } catch (error) {
    console.error('Users POST failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Ажилтан хадгалж чадсангүй' }, { status: 500 })
  }
}
