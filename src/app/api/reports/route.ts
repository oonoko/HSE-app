import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/session'

export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
    const supabase = createAdminClient()
    const shift = !admin.is_super_admin ? admin.shift_number : null

    let quizzesQuery = supabase.from('daily_quizzes').select('*', { count: 'exact', head: true })
    if (shift) quizzesQuery = quizzesQuery.or(`target_shift.is.null,target_shift.eq.${shift}`)
    let gameAttemptsQuery = supabase.from('game_attempts').select('*, user:users!inner(shift_number)', { count: 'exact', head: true })
    if (shift) gameAttemptsQuery = gameAttemptsQuery.eq('user.shift_number', shift)
    let quizAttemptsQuery = supabase.from('quiz_attempts').select('score, max_score, user:users!inner(shift_number)').eq('completed', true)
    if (shift) quizAttemptsQuery = quizAttemptsQuery.eq('user.shift_number', shift)
    let recentQuery = supabase.from('quiz_attempts').select('*, user:users!inner(name, sap_id, shift_number), quiz:daily_quizzes(title)').eq('completed', true).order('completed_at', { ascending: false }).limit(8)
    if (shift) recentQuery = recentQuery.eq('user.shift_number', shift)

    const [
      { count: totalQuizzes },
      { count: totalGames },
      { count: totalGameAttempts, error: gameAttemptsError },
      { data: quizAttempts, error: quizAttemptsError },
      { data: recent, error: recentError },
    ] = await Promise.all([
      quizzesQuery,
      supabase.from('safety_games').select('*', { count: 'exact', head: true }),
      gameAttemptsQuery,
      quizAttemptsQuery,
      recentQuery,
    ])
    if (gameAttemptsError) throw gameAttemptsError
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
