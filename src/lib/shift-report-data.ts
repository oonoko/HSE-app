import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { fetchAnswersForAttempts } from '@/lib/quiz-results'
import { buildDriverReport, type AnswerRecord, type GameAttemptRecord, type QuizAttemptRecord } from '@/lib/driver-report'
import type { ShiftDriverReport } from '@/lib/shift-report'
import { GUEST_DEPARTMENT } from '@/lib/guest'

type Supabase = ReturnType<typeof createAdminClient>

async function pagedByUsers<T>(userIds: string[], page: (ids: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < userIds.length; i += 100) {
    const ids = userIds.slice(i, i + 100)
    for (let from = 0; ; from += 1000) {
      const { data, error } = await page(ids, from, from + 999)
      if (error) throw error
      out.push(...(data ?? []))
      if ((data?.length ?? 0) < 1000) break
    }
  }
  return out
}

// shift = null means every driver (super admin only; callers enforce that).
export async function loadShiftReports(supabase: Supabase, shift: number | null): Promise<ShiftDriverReport[]> {
  const { data: everyone, error: everyoneError } = await supabase.from('users').select('id, sap_id, name, shift_number, total_score').eq('role', 'driver').neq('department', GUEST_DEPARTMENT).order('total_score', { ascending: false })
  if (everyoneError) throw everyoneError
  const all = everyone ?? []
  const drivers = shift ? all.filter(driver => driver.shift_number === shift) : all
  const ids = drivers.map(driver => driver.id)
  if (ids.length === 0) return []

  const [attempts, games, roster] = await Promise.all([
    pagedByUsers(ids, (chunk, from, to) => supabase.from('quiz_attempts').select('*, quiz:daily_quizzes(title, topic, active_date, pass_percent, max_attempts, questions)').in('user_id', chunk).order('id').range(from, to) as unknown as PromiseLike<{ data: Array<Record<string, any>> | null; error: unknown }>),
    pagedByUsers(ids, (chunk, from, to) => supabase.from('game_attempts').select('id, user_id, game_id, score, duration_seconds, played_at, game:safety_games(title, template)').in('user_id', chunk).order('id').range(from, to) as unknown as PromiseLike<{ data: Array<Record<string, any>> | null; error: unknown }>),
    pagedByUsers(ids, (chunk, from, to) => supabase.from('quiz_attendees').select('user_id, quiz_id, attempts_bonus').in('user_id', chunk).order('quiz_id').range(from, to) as unknown as PromiseLike<{ data: Array<{ user_id: string; quiz_id: string; attempts_bonus: number | null }> | null; error: unknown }>),
  ])

  const quizAttempts = attempts.filter(attempt => attempt.quiz).map(attempt => ({ ...attempt, quiz: { ...attempt.quiz, max_attempts: attempt.quiz.max_attempts ?? 1, pass_percent: attempt.quiz.pass_percent ?? null, topic: attempt.quiz.topic ?? null } })) as unknown as Array<QuizAttemptRecord>
  const answers = await fetchAnswersForAttempts(supabase, quizAttempts.filter(attempt => attempt.completed).map(attempt => attempt.id))

  const attemptsByUser = new Map<string, QuizAttemptRecord[]>()
  for (const attempt of quizAttempts) attemptsByUser.set(attempt.user_id, [...(attemptsByUser.get(attempt.user_id) ?? []), attempt])
  const answersByAttempt = new Map<string, AnswerRecord[]>()
  for (const answer of answers) answersByAttempt.set(answer.attempt_id, [...(answersByAttempt.get(answer.attempt_id) ?? []), answer])
  const gamesByUser = new Map<string, GameAttemptRecord[]>()
  for (const game of games) gamesByUser.set(game.user_id, [...(gamesByUser.get(game.user_id) ?? []), game as unknown as GameAttemptRecord])
  const bonusByUser = new Map<string, Map<string, number>>()
  for (const row of roster) bonusByUser.set(row.user_id, new Map([...(bonusByUser.get(row.user_id) ?? []), [row.quiz_id, row.attempts_bonus ?? 0]]))

  return drivers.map(driver => {
    const mine = attemptsByUser.get(driver.id) ?? []
    const mineAnswers = mine.flatMap(attempt => answersByAttempt.get(attempt.id) ?? [])
    return {
      driver,
      rank: all.findIndex(item => item.id === driver.id) + 1 || null,
      report: buildDriverReport(mine, mineAnswers, gamesByUser.get(driver.id) ?? [], bonusByUser.get(driver.id) ?? new Map()),
    }
  })
}
