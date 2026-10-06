export const DEFAULT_PASS_PERCENT = 80
export const DEFAULT_MAX_ATTEMPTS = 3
export const OVERRIDE_BASE_POINTS = 50

export const OVERRIDE_REASONS = [
  { value: 'misclick', label: 'Буруу дарсан' },
  { value: 'no_correct_option', label: 'Зөв хариулт сонголтод байгаагүй' },
  { value: 'bad_question', label: 'Асуулт буруу / ойлгомжгүй байсан' },
  { value: 'other', label: 'Бусад' },
] as const

export type OverrideReason = typeof OVERRIDE_REASONS[number]['value']

export function isOverrideReason(value: unknown): value is OverrideReason {
  return OVERRIDE_REASONS.some(reason => reason.value === value)
}

export function overrideReasonLabel(value?: string | null): string {
  return OVERRIDE_REASONS.find(reason => reason.value === value)?.label ?? ''
}

export type AnswerRow = {
  question_id: string
  is_correct: boolean
  points: number
  response_ms: number
  override_correct?: boolean | null
}

export function effectiveCorrect(answer: Pick<AnswerRow, 'is_correct' | 'override_correct'>): boolean {
  return answer.override_correct ?? answer.is_correct
}

export function effectivePoints(answer: AnswerRow): number {
  if (answer.override_correct == null) return answer.points
  if (!answer.override_correct) return 0
  return answer.is_correct ? answer.points : OVERRIDE_BASE_POINTS
}

export function summarizeAnswers(answers: AnswerRow[], totalQuestions: number) {
  const correct = answers.filter(effectiveCorrect).length
  return {
    score: answers.reduce((sum, answer) => sum + effectivePoints(answer), 0),
    correct,
    wrong: Math.max(0, totalQuestions - correct),
    totalMs: answers.reduce((sum, answer) => sum + answer.response_ms, 0),
    percent: totalQuestions > 0 ? (correct / totalQuestions) * 100 : 0,
  }
}

export function isPassed(correct: number, total: number, passPercent: number | null | undefined): boolean | null {
  if (passPercent == null) return null
  if (total <= 0) return false
  return (correct / total) * 100 >= passPercent
}

export function creditedPointsFor(score: number, passed: boolean | null): number {
  return passed === false ? 0 : score
}

export type QuizRules = { pass_percent?: number | null; max_attempts?: number | null }
export type AttemptLite = { id: string; attempt_number: number; completed: boolean; passed: boolean | null }

export type AttemptState =
  | { kind: 'resume'; attempt: AttemptLite }
  | { kind: 'passed'; attempt: AttemptLite }
  | { kind: 'finished'; attempt: AttemptLite }
  | { kind: 'locked' }
  | { kind: 'new'; attemptNumber: number }

export function isTrainingQuiz(rules: QuizRules): boolean {
  return rules.pass_percent != null
}

export function attemptsAllowed(rules: QuizRules, bonus = 0): number {
  if (!isTrainingQuiz(rules)) return 1
  return Math.max(1, rules.max_attempts ?? DEFAULT_MAX_ATTEMPTS) + Math.max(0, bonus)
}

export function nextAttemptState(rules: QuizRules, attempts: AttemptLite[], bonus = 0): AttemptState {
  const ordered = [...attempts].sort((a, b) => a.attempt_number - b.attempt_number)
  const inProgress = ordered.find(attempt => !attempt.completed)
  if (inProgress) return { kind: 'resume', attempt: inProgress }

  if (!isTrainingQuiz(rules)) {
    const last = ordered[ordered.length - 1]
    return last ? { kind: 'finished', attempt: last } : { kind: 'new', attemptNumber: 1 }
  }

  const passedAttempt = ordered.find(attempt => attempt.passed === true)
  if (passedAttempt) return { kind: 'passed', attempt: passedAttempt }
  if (ordered.length >= attemptsAllowed(rules, bonus)) return { kind: 'locked' }
  const highest = ordered.reduce((max, attempt) => Math.max(max, attempt.attempt_number), 0)
  return { kind: 'new', attemptNumber: highest + 1 }
}

export type AttemptSummary = {
  used: number
  allowed: number
  left: number
  passed: boolean
  locked: boolean
  inProgress: boolean
}

export function summarizeAttempts(rules: QuizRules, attempts: AttemptLite[], bonus = 0): AttemptSummary {
  const state = nextAttemptState(rules, attempts, bonus)
  const used = attempts.filter(attempt => attempt.completed).length
  const allowed = attemptsAllowed(rules, bonus)
  return {
    used,
    allowed,
    left: Math.max(0, allowed - used),
    passed: state.kind === 'passed',
    locked: state.kind === 'locked',
    inProgress: state.kind === 'resume',
  }
}

export type FinalAttemptCandidate = {
  user_id: string
  quiz_id?: string
  attempt_number: number
  passed: boolean | null
  completed: boolean
  score: number
  correct_count?: number
}

// One attempt per (quiz, driver) that represents their result: the passing
// attempt if there is one, otherwise the highest-scoring completed attempt
// (latest wins ties).
function outranks(a: FinalAttemptCandidate, b: FinalAttemptCandidate): boolean {
  const aPassed = a.passed === true ? 1 : 0
  const bPassed = b.passed === true ? 1 : 0
  if (aPassed !== bPassed) return aPassed > bPassed
  if (a.score !== b.score) return a.score > b.score
  return a.attempt_number > b.attempt_number
}

export function pickFinalAttempts<T extends FinalAttemptCandidate>(attempts: T[]): T[] {
  const best = new Map<string, T>()
  for (const attempt of attempts) {
    if (!attempt.completed) continue
    const key = `${attempt.quiz_id ?? ''}|${attempt.user_id}`
    const current = best.get(key)
    if (!current || outranks(attempt, current)) best.set(key, attempt)
  }
  return Array.from(best.values())
}

export type ParticipantStatus = 'passed' | 'failed' | 'locked' | 'in_progress' | 'not_started' | 'completed'

export function participantStatus(rules: QuizRules, attempts: AttemptLite[], bonus = 0): ParticipantStatus {
  const state = nextAttemptState(rules, attempts, bonus)
  if (state.kind === 'resume') return 'in_progress'
  if (state.kind === 'passed') return 'passed'
  if (state.kind === 'locked') return 'locked'
  if (state.kind === 'finished') return 'completed'
  return attempts.some(attempt => attempt.completed) ? 'failed' : 'not_started'
}

export const STATUS_LABELS: Record<ParticipantStatus, string> = {
  passed: 'Тэнцсэн',
  failed: 'Тэнцээгүй (оролдлого үлдсэн)',
  locked: 'Түгжигдсэн (ахин сургалтад)',
  in_progress: 'Бөглөж байгаа',
  not_started: 'Өгөөгүй',
  completed: 'Өгсөн',
}
