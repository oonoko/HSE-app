import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { SessionUser } from '@/lib/session'
import type { DailyQuizQuestion } from '@/types'
import {
  effectiveCorrect, participantStatus, pickFinalAttempts, type AttemptLite, type ParticipantStatus,
} from '@/lib/training'

type Supabase = ReturnType<typeof createAdminClient>

export type AnswerDetail = {
  attempt_id: string
  question_id: string
  selected_index: number | null
  is_correct: boolean
  override_correct: boolean | null
  override_reason: string | null
  overridden_at: string | null
  response_ms: number
  points: number
}

export type AttemptDetail = {
  id: string
  attempt_number: number
  completed: boolean
  passed: boolean | null
  percent: number
  correct_count: number
  wrong_count: number
  score: number
  started_at: string
  completed_at: string | null
  overridden: number
}

export type ParticipantRow = {
  user: { id: string; sap_id: string; name: string; shift_number: number | null }
  in_roster: boolean
  bonus: number
  status: ParticipantStatus
  attempts_used: number
  attempts_allowed: number
  final: AttemptDetail | null
  attempts: AttemptDetail[]
}

export type QuestionStat = { id: string; text: string; correct: number; wrong: number; percent: number }

export type QuizResults = {
  quiz: {
    id: string; title: string; topic: string | null; active_date: string; target_shift: number | null
    pass_percent: number | null; max_attempts: number; questions: DailyQuizQuestion[]
  }
  training: boolean
  rows: ParticipantRow[]
  counts: Record<ParticipantStatus, number> & { roster: number; participants: number }
  questionStats: QuestionStat[]
  answers: AnswerDetail[]
}

type AttemptRow = {
  id: string; user_id: string; attempt_number: number; completed: boolean; passed: boolean | null
  score: number; correct_count: number; wrong_count: number; started_at: string; completed_at: string | null
}

export class AccessError extends Error {}

// PostgREST caps a response at 1000 rows, so anything that can grow with
// people x questions is read in pages.
async function fetchAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []))
    if ((data?.length ?? 0) < 1000) break
  }
  return out
}

export async function fetchAnswersForAttempts(supabase: Supabase, attemptIds: string[]): Promise<AnswerDetail[]> {
  const out: AnswerDetail[] = []
  for (let i = 0; i < attemptIds.length; i += 40) {
    const chunk = attemptIds.slice(i, i + 40)
    out.push(...await fetchAllRows<AnswerDetail>((from, to) =>
      supabase.from('quiz_answers')
        .select('attempt_id, question_id, selected_index, is_correct, override_correct, override_reason, overridden_at, response_ms, points')
        .in('attempt_id', chunk)
        .order('id')
        .range(from, to) as unknown as PromiseLike<{ data: AnswerDetail[] | null; error: unknown }>))
  }
  return out
}

function detailOf(attempt: AttemptRow, overridden: number): AttemptDetail {
  const total = (attempt.correct_count ?? 0) + (attempt.wrong_count ?? 0)
  return {
    id: attempt.id,
    attempt_number: attempt.attempt_number,
    completed: attempt.completed,
    passed: attempt.passed ?? null,
    percent: total > 0 ? Math.round((attempt.correct_count / total) * 100) : 0,
    correct_count: attempt.correct_count ?? 0,
    wrong_count: attempt.wrong_count ?? 0,
    score: attempt.score ?? 0,
    started_at: attempt.started_at,
    completed_at: attempt.completed_at ?? null,
    overridden,
  }
}

export async function loadQuizResults(supabase: Supabase, quizId: string, admin: SessionUser): Promise<QuizResults> {
  const { data: quiz, error: quizError } = await supabase.from('daily_quizzes').select('*').eq('id', quizId).single()
  if (quizError) throw quizError
  const scopeShift = !admin.is_super_admin && admin.shift_number ? admin.shift_number : null
  if (scopeShift && quiz.target_shift !== null && quiz.target_shift !== scopeShift) throw new AccessError('Зөвхөн өөрийн ээлжийн асуумжийн үр дүнг харна')

  const [{ data: rosterRows, error: rosterError }, attempts] = await Promise.all([
    supabase.from('quiz_attendees').select('user_id, attempts_bonus').eq('quiz_id', quizId),
    fetchAllRows<AttemptRow>((from, to) =>
      supabase.from('quiz_attempts').select('*').eq('quiz_id', quizId).order('id').range(from, to) as unknown as PromiseLike<{ data: AttemptRow[] | null; error: unknown }>),
  ])
  if (rosterError) throw rosterError

  const userIds = Array.from(new Set([...(rosterRows ?? []).map(row => row.user_id), ...attempts.map(attempt => attempt.user_id)]))
  const users: Array<{ id: string; sap_id: string; name: string; shift_number: number | null }> = []
  for (let i = 0; i < userIds.length; i += 150) {
    const { data, error } = await supabase.from('users').select('id, sap_id, name, shift_number').in('id', userIds.slice(i, i + 150))
    if (error) throw error
    users.push(...(data ?? []))
  }
  const scopedUsers = users.filter(user => !scopeShift || user.shift_number === scopeShift)

  const scopedAttempts = attempts.filter(attempt => scopedUsers.some(user => user.id === attempt.user_id))
  const answers = await fetchAnswersForAttempts(supabase, scopedAttempts.map(attempt => attempt.id))
  const overriddenByAttempt = new Map<string, number>()
  for (const answer of answers) if (answer.override_correct !== null) overriddenByAttempt.set(answer.attempt_id, (overriddenByAttempt.get(answer.attempt_id) ?? 0) + 1)

  const rules = { pass_percent: quiz.pass_percent ?? null, max_attempts: quiz.max_attempts ?? 1 }
  const bonusOf = new Map((rosterRows ?? []).map(row => [row.user_id, row.attempts_bonus ?? 0]))
  const inRoster = new Set((rosterRows ?? []).map(row => row.user_id))
  const finalIds = new Set(pickFinalAttempts(scopedAttempts.map(attempt => ({ ...attempt, quiz_id: quizId }))).map(attempt => attempt.id))

  const rows: ParticipantRow[] = scopedUsers.map(user => {
    const mine = scopedAttempts.filter(attempt => attempt.user_id === user.id).sort((a, b) => a.attempt_number - b.attempt_number)
    const details = mine.map(attempt => detailOf(attempt, overriddenByAttempt.get(attempt.id) ?? 0))
    const bonus = bonusOf.get(user.id) ?? 0
    const summaryStatus = participantStatus(rules, mine as unknown as AttemptLite[], bonus)
    const allowed = rules.pass_percent === null ? 1 : (rules.max_attempts ?? 1) + bonus
    return {
      user,
      in_roster: inRoster.has(user.id),
      bonus,
      status: summaryStatus,
      attempts_used: mine.filter(attempt => attempt.completed).length,
      attempts_allowed: allowed,
      final: details.find(detail => finalIds.has(detail.id)) ?? null,
      attempts: details,
    }
  }).sort((a, b) => a.user.name.localeCompare(b.user.name))

  const counts = { roster: inRoster.size, participants: rows.length, passed: 0, failed: 0, locked: 0, in_progress: 0, not_started: 0, completed: 0 } as QuizResults['counts']
  for (const row of rows) counts[row.status] += 1

  const questions = quiz.questions as DailyQuizQuestion[]
  const finalAnswers = answers.filter(answer => finalIds.has(answer.attempt_id))
  const finalCount = finalIds.size
  const questionStats: QuestionStat[] = questions.map(question => {
    const correct = finalAnswers.filter(answer => answer.question_id === question.id && effectiveCorrect(answer)).length
    return { id: question.id, text: question.text, correct, wrong: Math.max(0, finalCount - correct), percent: finalCount > 0 ? Math.round((correct / finalCount) * 100) : 0 }
  })

  return {
    quiz: {
      id: quiz.id, title: quiz.title, topic: quiz.topic, active_date: quiz.active_date, target_shift: quiz.target_shift,
      pass_percent: quiz.pass_percent ?? null, max_attempts: quiz.max_attempts ?? 1, questions,
    },
    training: quiz.pass_percent != null,
    rows, counts, questionStats, answers,
  }
}
