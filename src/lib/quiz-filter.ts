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

// "Failed" covers everyone who did not pass: still allowed to retry, or locked out.
const matchers: Record<ExportFilter, (row: ParticipantRow) => boolean> = {
  all: () => true,
  passed: row => row.status === 'passed',
  failed: row => row.status === 'failed' || row.status === 'locked',
  given: row => row.attempts.some(attempt => attempt.completed),
  not_given: row => !row.attempts.some(attempt => attempt.completed),
}

// Narrows a results set to one group of people and recomputes everything that summarises it.
export function filterResults(results: QuizResults, filter: ExportFilter): QuizResults {
  if (filter === 'all') return results
  const rows = results.rows.filter(matchers[filter])
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
