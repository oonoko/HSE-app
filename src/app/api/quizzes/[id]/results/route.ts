import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/session'
import { AccessError, loadQuizResults } from '@/lib/quiz-results'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
    const { id } = await params
    const results = await loadQuizResults(createAdminClient(), id, admin)
    const userId = new URL(req.url).searchParams.get('user_id')
    const { answers, ...summary } = results
    if (!userId) return NextResponse.json({ data: summary })
    const attemptIds = new Set(results.rows.find(row => row.user.id === userId)?.attempts.map(attempt => attempt.id) ?? [])
    return NextResponse.json({ data: { ...summary, answers: answers.filter(answer => attemptIds.has(answer.attempt_id)) } })
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: 403 })
    console.error('Quiz results failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Үр дүн авч чадсангүй' }, { status: 500 })
  }
}
