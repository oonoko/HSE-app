import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/session'
import { SHIFT_NUMBERS } from '@/lib/shifts'
import { loadShiftReports } from '@/lib/shift-report-data'
import { buildShiftWorkbook } from '@/lib/shift-report-export'

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
    const param = new URL(req.url).searchParams.get('shift')
    let shift: number | null
    if (!admin.is_super_admin && admin.shift_number) {
      if (param && Number(param) !== admin.shift_number) return NextResponse.json({ error: 'Зөвхөн өөрийн ээлжийн тайланг татна' }, { status: 403 })
      shift = admin.shift_number
    } else if (!param || param === 'all') {
      shift = null
    } else {
      shift = Number(param)
      if (!SHIFT_NUMBERS.includes(shift as typeof SHIFT_NUMBERS[number])) return NextResponse.json({ error: 'Ээлж буруу байна' }, { status: 400 })
    }
    const rows = await loadShiftReports(createAdminClient(), shift)
    const buffer = await buildShiftWorkbook(rows, shift)
    const filename = `shift-report-${shift ?? 'all'}.xlsx`
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Shift report export failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Тайлан татаж чадсангүй' }, { status: 500 })
  }
}
