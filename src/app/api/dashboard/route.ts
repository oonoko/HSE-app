import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/session'

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)
    const shift = (!admin.is_super_admin && admin.shift_number) ? String(admin.shift_number) : searchParams.get('shift')
    const quizId = searchParams.get('quiz_id')
    const start = new Date(`${date}T00:00:00+08:00`).toISOString()
    const end = new Date(`${date}T23:59:59+08:00`).toISOString()
    const supabase = createAdminClient()

    let usersQuery = supabase.from('users').select('id, sap_id, name, shift_number, total_score').eq('role', 'driver')
    if (shift) usersQuery = usersQuery.eq('shift_number', Number(shift))
    let quizQuery = supabase.from('daily_quizzes').select('*').eq('active_date', date)
    if (quizId) quizQuery = quizQuery.eq('id', quizId)

    const [{ data: users, error: usersError }, { data: quizzes, error: quizzesError }, { data: gameAttempts, error: gamesError }] = await Promise.all([
      usersQuery,
      quizQuery,
      supabase.from('game_attempts').select('*, user:users(sap_id, name, shift_number), game:safety_games(title, template)').gte('played_at', start).lte('played_at', end),
    ])
    if (usersError) throw usersError
    if (quizzesError) throw quizzesError
    if (gamesError) throw gamesError
    const quizIds = (quizzes ?? []).map(quiz => quiz.id)
    let quizAttempts: Array<Record<string, any>> = []
    if (quizIds.length) {
      const { data, error } = await supabase.from('quiz_attempts').select('*, user:users(sap_id, name, shift_number), quiz:daily_quizzes(title, active_date)').in('quiz_id', quizIds).eq('completed', true)
      if (error) throw error
      quizAttempts = data ?? []
    }
    const allowedIds = new Set((users ?? []).map(user => user.id))
    const filteredQuiz = quizAttempts.filter(attempt => allowedIds.has(attempt.user_id))
    const filteredGames = (gameAttempts ?? []).filter(attempt => allowedIds.has(attempt.user_id))
    let quizAnswers: Array<Record<string, any>> = []
    if (filteredQuiz.length) {
      const { data, error } = await supabase.from('quiz_answers').select('*').in('attempt_id', filteredQuiz.map(attempt => attempt.id))
      if (error) throw error
      quizAnswers = data ?? []
    }
    const questionLabels = new Map<string, string>()
    for (const quiz of quizzes ?? []) {
      for (const question of (quiz.questions as Array<{ id: string; text: string }>)) questionLabels.set(question.id, question.text)
    }
    const questionMap: Record<string, { question_id: string; text: string; total: number; correct: number }> = {}
    for (const answer of quizAnswers) {
      questionMap[answer.question_id] ??= { question_id: answer.question_id, text: questionLabels.get(answer.question_id) || answer.question_id, total: 0, correct: 0 }
      questionMap[answer.question_id].total += 1
      if (answer.is_correct) questionMap[answer.question_id].correct += 1
    }
    const assigned = users?.length ?? 0
    const completedUsers = new Set(filteredQuiz.map(attempt => attempt.user_id)).size
    const averageScore = filteredQuiz.length
      ? Math.round(filteredQuiz.reduce((sum, attempt) => sum + (attempt.max_score ? attempt.score / attempt.max_score * 100 : 0), 0) / filteredQuiz.length)
      : 0
    const leaderboard = (users ?? []).map(user => {
      const quizScore = filteredQuiz.filter(item => item.user_id === user.id).reduce((sum, item) => sum + item.score, 0)
      const gameScore = filteredGames.filter(item => item.user_id === user.id).reduce((sum, item) => sum + item.score, 0)
      return { ...user, quiz_score: quizScore, game_score: gameScore, total: quizScore + gameScore }
    }).sort((a, b) => b.total - a.total)

    return NextResponse.json({ data: {
      date,
      assigned,
      completed: completedUsers,
      missing: Math.max(0, assigned - completedUsers),
      completion_rate: assigned ? Math.round(completedUsers / assigned * 100) : 0,
      average_score: averageScore,
      quizzes: quizzes ?? [],
      quiz_attempts: filteredQuiz,
      question_analysis: Object.values(questionMap).map(item => ({ ...item, accuracy: item.total ? Math.round(item.correct / item.total * 100) : 0 })).sort((a, b) => a.accuracy - b.accuracy),
      game_attempts: filteredGames,
      leaderboard,
    } })
  } catch (error) {
    console.error('Dashboard GET failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Dashboard мэдээлэл авч чадсангүй' }, { status: 500 })
  }
}
