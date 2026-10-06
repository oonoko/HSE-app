import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { SessionUser } from '@/lib/session'
import { creditedPointsFor, isPassed, summarizeAnswers, type AnswerRow } from '@/lib/training'

type Supabase = ReturnType<typeof createAdminClient>

// Makes the quiz's roster match `attendeeIds`. A shift-scoped admin can only add or
// remove drivers of their own shift; rows for other shifts are left alone.
export async function syncRoster(supabase: Supabase, quizId: string, attendeeIds: string[], admin: SessionUser) {
  const scoped = !admin.is_super_admin && !!admin.shift_number
  let driversQuery = supabase.from('users').select('id').eq('role', 'driver')
  if (scoped) driversQuery = driversQuery.eq('shift_number', admin.shift_number as number)
  const { data: managedDrivers, error: driversError } = await driversQuery
  if (driversError) throw driversError
  const managed = new Set((managedDrivers ?? []).map(row => row.id))
  const wanted = new Set(attendeeIds.filter(id => managed.has(id)))

  const { data: existing, error: existingError } = await supabase.from('quiz_attendees').select('user_id').eq('quiz_id', quizId)
  if (existingError) throw existingError
  const existingIds = new Set((existing ?? []).map(row => row.user_id))

  const toDelete = Array.from(existingIds).filter(id => managed.has(id) && !wanted.has(id))
  const toInsert = Array.from(wanted).filter(id => !existingIds.has(id))
  if (toDelete.length) {
    const { error } = await supabase.from('quiz_attendees').delete().eq('quiz_id', quizId).in('user_id', toDelete)
    if (error) throw error
  }
  if (toInsert.length) {
    const { error } = await supabase.from('quiz_attendees').insert(toInsert.map(user_id => ({ quiz_id: quizId, user_id })))
    if (error) throw error
  }
}

// When the pass threshold of an existing quiz changes, re-judge every finished
// attempt from its stored counts and move the credited points accordingly.
export async function rethresholdAttempts(supabase: Supabase, quizId: string, passPercent: number | null) {
  const { data: attempts, error } = await supabase
    .from('quiz_attempts')
    .select('id, user_id, score, correct_count, wrong_count, passed, credited_points')
    .eq('quiz_id', quizId)
    .eq('completed', true)
  if (error) throw error

  const userDelta = new Map<string, number>()
  for (const attempt of attempts ?? []) {
    const passed = isPassed(attempt.correct_count, attempt.correct_count + attempt.wrong_count, passPercent)
    const credited = creditedPointsFor(attempt.score, passed)
    if (passed === attempt.passed && credited === attempt.credited_points) continue
    const { error: updateError } = await supabase.from('quiz_attempts').update({ passed, credited_points: credited }).eq('id', attempt.id)
    if (updateError) throw updateError
    userDelta.set(attempt.user_id, (userDelta.get(attempt.user_id) ?? 0) + credited - attempt.credited_points)
  }
  for (const [userId, delta] of userDelta) {
    if (delta === 0) continue
    const { data: user, error: userError } = await supabase.from('users').select('total_score').eq('id', userId).single()
    if (userError) throw userError
    await supabase.from('users').update({ total_score: Math.max(0, user.total_score + delta) }).eq('id', userId)
  }
}

// Recomputes an attempt from its answers (honouring admin overrides), stores
// the result, and keeps users.total_score in step by crediting only the delta
// against what was already credited for this attempt.
export async function finalizeAttempt(supabase: Supabase, attemptId: string, options: { markCompleted?: boolean } = {}) {
  const { data: attempt, error: attemptError } = await supabase
    .from('quiz_attempts')
    .select('*, quiz:daily_quizzes(questions, pass_percent)')
    .eq('id', attemptId)
    .single()
  if (attemptError) throw attemptError

  const { data: answers, error: answersError } = await supabase.from('quiz_answers').select('*').eq('attempt_id', attemptId)
  if (answersError) throw answersError

  const quiz = attempt.quiz as { questions: unknown[]; pass_percent: number | null }
  const total = quiz.questions.length
  const summary = summarizeAnswers((answers ?? []) as AnswerRow[], total)
  const passed = isPassed(summary.correct, total, quiz.pass_percent)
  const credited = creditedPointsFor(summary.score, passed)

  const { data: updated, error: updateError } = await supabase
    .from('quiz_attempts')
    .update({
      score: summary.score,
      max_score: total * 100,
      correct_count: summary.correct,
      wrong_count: summary.wrong,
      total_time_seconds: Math.round(summary.totalMs / 1000),
      passed,
      credited_points: credited,
      ...(options.markCompleted ? { completed: true, completed_at: new Date().toISOString() } : {}),
    })
    .eq('id', attemptId)
    .select('*')
    .single()
  if (updateError) throw updateError

  const delta = credited - (attempt.credited_points ?? 0)
  if (delta !== 0) {
    const { data: user, error: userError } = await supabase.from('users').select('total_score').eq('id', attempt.user_id).single()
    if (userError) throw userError
    await supabase.from('users').update({ total_score: Math.max(0, user.total_score + delta), last_active: new Date().toISOString() }).eq('id', attempt.user_id)
  }
  return updated
}
