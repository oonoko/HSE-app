import type { QuizResults, ParticipantRow } from '@/lib/quiz-results'
import { effectiveCorrect, type ParticipantStatus } from '@/lib/training'

export type ExportFilter = 'all' | 'passed' | 'failed' | 'given' | 'not_given'

export const EXPORT_FILTERS: Array<{ value: ExportFilter; label: string; training: boolean }> = [
  { value: 'all', label: 'Бүгд', training: false },
  { value: 'passed', label: 'Зөвхөн тэнцсэн', training: true },
  { value: 'failed', label: 'Зөвхөн тэнцээгүй', training: true },
  { value: 'given', label: 'Зөвхөн шалгалт өгсөн', training: false },
  { value: 'not_given', label: 'Зөвхөн өгөөгүй', training: false },
]

export function parseExportFilter(value: string | null | undefined): ExportFilter {
  return EXPORT_FILTERS.some(item => item.value === value) ? (value as ExportFilter) : 'all'
}

export function filterLabel(filter: ExportFilter): string {
  return EXPORT_FILTERS.find(item => item.value === filter)?.label ?? 'Бүгд'
}

// Optional narrowing on top of the status filter. `from`/`to` are Mongolian local times ("2026-10-14T09:30").
export type ExportExtras = { shift?: number | null; from?: string | null; to?: string | null }

const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

// Mongolia has no daylight saving, so local time is always UTC+8.
export function parseLocalTime(value: string | null | undefined): number | null {
  if (!value || !LOCAL_TIME.test(value)) return null
  const time = new Date(`${value}:00+08:00`).getTime()
  return Number.isNaN(time) ? null : time
}

export function parseShift(value: string | null | undefined): number | null {
  const shift = Number(value)
  return Number.isInteger(shift) && shift >= 1 ? shift : null
}

export function describeExtras(extras: ExportExtras, shiftName: (shift: number) => string): string[] {
  const parts: string[] = []
  if (extras.shift) parts.push(`Ээлж: ${shiftName(extras.shift)}`)
  if (extras.from) parts.push(`${extras.from.replace('T', ' ')}-аас хойш`)
  if (extras.to) parts.push(`${extras.to.replace('T', ' ')}-аас өмнө`)
  return parts
}

// "Failed" covers everyone who did not pass: still allowed to retry, or locked out.
const matchers: Record<ExportFilter, (row: ParticipantRow) => boolean> = {
  all: () => true,
  passed: row => row.status === 'passed',
  failed: row => row.status === 'failed' || row.status === 'locked',
  given: row => row.attempts.some(attempt => attempt.completed),
  not_given: row => !row.attempts.some(attempt => attempt.completed),
}

// Narrows a results set to one group of people and recomputes everything that summarises it.
export function filterResults(results: QuizResults, filter: ExportFilter, extras: ExportExtras = {}): QuizResults {
  const from = parseLocalTime(extras.from), to = parseLocalTime(extras.to)
  if (filter === 'all' && !extras.shift && from === null && to === null) return results
  // With a time window, a person counts when one of their finished attempts falls inside it.
  const inWindow = (row: ParticipantRow) => row.attempts.some(attempt => {
    if (!attempt.completed || !attempt.completed_at) return false
    const time = new Date(attempt.completed_at).getTime()
    return (from === null || time >= from) && (to === null || time <= to)
  })
  const rows = results.rows.filter(row => matchers[filter](row) && (!extras.shift || row.user.shift_number === extras.shift) && (from === null && to === null ? true : inWindow(row)))
  const attemptIds = new Set(rows.flatMap(row => row.attempts.map(attempt => attempt.id)))
  const answers = results.answers.filter(answer => attemptIds.has(answer.attempt_id))

  const counts = { roster: results.counts.roster, participants: rows.length, passed: 0, failed: 0, locked: 0, in_progress: 0, not_started: 0, completed: 0 } as QuizResults['counts']
  for (const row of rows) counts[row.status as ParticipantStatus] += 1

  const finalIds = new Set(rows.flatMap(row => (row.final ? [row.final.id] : [])))
  const finalAnswers = answers.filter(answer => finalIds.has(answer.attempt_id))
  const questionStats = results.quiz.questions.map(question => {
    const correct = finalAnswers.filter(answer => answer.question_id === question.id && effectiveCorrect(answer)).length
    return { id: question.id, text: question.text, correct, wrong: Math.max(0, finalIds.size - correct), percent: finalIds.size > 0 ? Math.round((correct / finalIds.size) * 100) : 0 }
  })
  return { ...results, rows, answers, counts, questionStats }
}
