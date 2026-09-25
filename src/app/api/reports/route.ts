import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/session'

export async function GET() {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
    const supabase = createAdminClient()

    const [
      { count: totalQuizzes },
      { count: totalGames },
      { count: totalGameAttempts },
      { data: quizAttempts, error: quizAttemptsError },
      { data: recent, error: recentError },
    ] = await Promise.all([
      supabase.from('daily_quizzes').select('*', { count: 'exact', head: true }),
      supabase.from('safety_games').select('*', { count: 'exact', head: true }),
      supabase.from('game_attempts').select('*', { count: 'exact', head: true }),
      supabase.from('quiz_attempts').select('score, max_score').eq('completed', true),
      supabase.from('quiz_attempts').select('*, user:users(name, sap_id, shift_number), quiz:daily_quizzes(title)').eq('completed', true).order('completed_at', { ascending: false }).limit(8),
    ])
    if (quizAttemptsError) throw quizAttemptsError
    if (recentError) throw recentError

    const scored = (quizAttempts ?? []).filter(a => a.max_score > 0)
    const avgQuizPercent = scored.length
      ? Math.round(scored.reduce((sum, a) => sum + (a.score / a.max_score) * 100, 0) / scored.length)
      : 0

    return NextResponse.json({
      data: {
        total_quizzes: totalQuizzes ?? 0,
        total_quiz_attempts: quizAttempts?.length ?? 0,
        avg_quiz_percent: avgQuizPercent,
        total_games: totalGames ?? 0,
        total_game_attempts: totalGameAttempts ?? 0,
        recent_attempts: recent ?? [],
      },
    })
  } catch (error) {
    console.error('Reports GET failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Тайлан авч чадсангүй' }, { status: 500 })
  }
}
