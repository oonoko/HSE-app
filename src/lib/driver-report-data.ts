import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { SessionUser } from '@/lib/session'
import { fetchAnswersForAttempts } from '@/lib/quiz-results'
import { buildDriverReport, redactForDriver, type DriverReport, type GameAttemptRecord, type QuizAttemptRecord } from '@/lib/driver-report'

type Supabase = ReturnType<typeof createAdminClient>

export class ReportAccessError extends Error {}

export type DriverReportPayload = {
  user: { id: string; sap_id: string; name: string; shift_number: number | null; department: string | null; total_score: number }
  rank: number | null
  shift_rank: number | null
  total_drivers: number
  shift_drivers: number
  report: DriverReport
}

export async function loadDriverReport(supabase: Supabase, userId: string, viewer: SessionUser): Promise<DriverReportPayload> {
  const { data: user, error: userError } = await supabase.from('users').select('id, sap_id, name, shift_number, department, total_score, role').eq('id', userId).single()
  if (userError) throw userError
  if (viewer.role !== 'admin' && viewer.id !== userId) throw new ReportAccessError('Хандах эрхгүй')
  if (viewer.role === 'admin' && !viewer.is_super_admin && viewer.shift_number && user.shift_number !== viewer.shift_number) throw new ReportAccessError('Зөвхөн өөрийн ээлжийн жолоочийг харна')

  const [{ data: attempts, error: attemptsError }, { data: games, error: gamesError }, { data: roster, error: rosterError }, { data: drivers, error: driversError }] = await Promise.all([
    supabase.from('quiz_attempts').select('*, quiz:daily_quizzes(title, topic, active_date, pass_percent, max_attempts, questions)').eq('user_id', userId).order('started_at'),
    supabase.from('game_attempts').select('id, game_id, score, duration_seconds, played_at, game:safety_games(title, template)').eq('user_id', userId).order('played_at'),
    supabase.from('quiz_attendees').select('quiz_id, attempts_bonus').eq('user_id', userId),
    supabase.from('users').select('id, total_score, shift_number').eq('role', 'driver').order('total_score', { ascending: false }),
  ])
  if (attemptsError) throw attemptsError
  if (gamesError) throw gamesError
  if (rosterError) throw rosterError
  if (driversError) throw driversError

  const quizAttempts = ((attempts ?? []) as Array<Record<string, any>>)
    .filter(attempt => attempt.quiz)
    .map(attempt => ({ ...attempt, quiz: { ...attempt.quiz, max_attempts: attempt.quiz.max_attempts ?? 1, pass_percent: attempt.quiz.pass_percent ?? null, topic: attempt.quiz.topic ?? null } })) as unknown as QuizAttemptRecord[]
  const answers = await fetchAnswersForAttempts(supabase, quizAttempts.filter(attempt => attempt.completed).map(attempt => attempt.id))
  const bonus = new Map((roster ?? []).map(row => [row.quiz_id, row.attempts_bonus ?? 0]))
  const built = buildDriverReport(quizAttempts, answers, (games ?? []) as unknown as GameAttemptRecord[], bonus)
  const report = viewer.role === 'admin' ? built : redactForDriver(built)

  const all = drivers ?? []
  const sameShift = all.filter(driver => driver.shift_number === user.shift_number)
  const rank = all.findIndex(driver => driver.id === userId) + 1
  const shiftRank = sameShift.findIndex(driver => driver.id === userId) + 1
  return {
    user: { id: user.id, sap_id: user.sap_id, name: user.name, shift_number: user.shift_number, department: user.department ?? null, total_score: user.total_score },
    rank: rank || null, shift_rank: shiftRank || null, total_drivers: all.length, shift_drivers: sameShift.length, report,
  }
}
