import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/session'
import { AccessError, loadQuizResults } from '@/lib/quiz-results'
import { buildQuizWorkbook } from '@/lib/quiz-export'
import { filterLabel, parseExportFilter, parseLocalTime, parseShift, type ExportExtras } from '@/lib/quiz-filter'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
    const { id } = await params
    const results = await loadQuizResults(createAdminClient(), id, admin)
    const search = new URL(req.url).searchParams
    const filter = parseExportFilter(search.get('filter'))
    const extras: ExportExtras = {
      shift: parseShift(search.get('shift')),
      from: parseLocalTime(search.get('from')) === null ? null : search.get('from'),
      to: parseLocalTime(search.get('to')) === null ? null : search.get('to'),
    }
    const narrowed = filter !== 'all' || !!extras.shift || !!extras.from || !!extras.to
    const buffer = await buildQuizWorkbook(results, new Date(), filter, extras)
    const safeTitle = results.quiz.title.replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 80) || 'asuumj'
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="quiz-results-${results.quiz.active_date}${narrowed ? '-filtered' : ''}.xlsx"; filename*=UTF-8''${encodeURIComponent(`${safeTitle} - ${results.quiz.active_date}${narrowed ? ` - ${[filter === 'all' ? '' : filterLabel(filter), extras.shift ? `${extras.shift}-р ээлж` : '', extras.from ? `${extras.from.replace('T', ' ').replace(':', '.')}-аас хойш` : '', extras.to ? `${extras.to.replace('T', ' ').replace(':', '.')}-аас өмнө` : ''].filter(Boolean).join(', ')}` : ''}.xlsx`)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: 403 })
    console.error('Quiz export failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Excel тайлан үүсгэж чадсангүй' }, { status: 500 })
  }
}
