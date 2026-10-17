import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/session'
import { AccessError, loadQuizResults } from '@/lib/quiz-results'
import { buildQuizWorkbook } from '@/lib/quiz-export'
import { filterLabel, parseExportFilter } from '@/lib/quiz-filter'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
    const { id } = await params
    const results = await loadQuizResults(createAdminClient(), id, admin)
    const filter = parseExportFilter(new URL(req.url).searchParams.get('filter'))
    const buffer = await buildQuizWorkbook(results, new Date(), filter)
    const safeTitle = results.quiz.title.replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 80) || 'asuumj'
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="quiz-results-${results.quiz.active_date}${filter === 'all' ? '' : `-${filter}`}.xlsx"; filename*=UTF-8''${encodeURIComponent(`${safeTitle} - ${results.quiz.active_date}${filter === 'all' ? '' : ` - ${filterLabel(filter)}`}.xlsx`)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: 403 })
    console.error('Quiz export failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Excel тайлан үүсгэж чадсангүй' }, { status: 500 })
  }
}
