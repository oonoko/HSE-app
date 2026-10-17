import { describe, expect, it } from 'vitest'
import type { QuizResults } from './quiz-results'
import { filterResults, parseExportFilter } from './quiz-filter'

const attempt = (id: string, n: number, completed: boolean, passed: boolean | null) => ({ id, attempt_number: n, completed, passed, percent: 0, correct_count: 0, wrong_count: 0, score: 0, started_at: '2026-10-01T03:00:00Z', completed_at: completed ? '2026-10-01T03:05:00Z' : null, overridden: 0 })
const person = (id: string, status: QuizResults['rows'][number]['status'], attempts: ReturnType<typeof attempt>[]) => ({
  user: { id, sap_id: id, name: id, shift_number: 1 }, in_roster: true, bonus: 0, status, attempts_used: attempts.filter(a => a.completed).length, attempts_allowed: 3,
  attempts, final: attempts.filter(a => a.completed).slice(-1)[0] ?? null,
})
const ans = (attempt_id: string, ok: boolean) => ({ attempt_id, question_id: 'q1', selected_index: ok ? 0 : 1, is_correct: ok, override_correct: null, override_reason: null, overridden_at: null, response_ms: 1000, points: ok ? 90 : 0 })

const results: QuizResults = {
  quiz: { id: 'z', title: 'T', topic: null, active_date: '2026-10-01', target_shift: null, pass_percent: 80, max_attempts: 3, questions: [{ id: 'q1', text: 'Q?', options: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] as never, correct_index: 0 }] },
  training: true,
  rows: [
    person('passed', 'passed', [attempt('a1', 1, true, true)]),
    person('failed', 'failed', [attempt('b1', 1, true, false)]),
    person('locked', 'locked', [attempt('c1', 1, true, false), attempt('c2', 2, true, false), attempt('c3', 3, true, false)]),
    person('absent', 'not_started', []),
    person('midway', 'in_progress', [attempt('d1', 1, false, null)]),
  ],
  counts: { roster: 5, participants: 5, passed: 1, failed: 1, locked: 1, in_progress: 1, not_started: 1, completed: 0 },
  questionStats: [{ id: 'q1', text: 'Q?', correct: 1, wrong: 2, percent: 33 }],
  answers: [ans('a1', true), ans('b1', false), ans('c1', false), ans('c3', false), ans('d1', true)],
}
const ids = (r: QuizResults) => r.rows.map(row => row.user.id)

describe('filterResults', () => {
  it('keeps everything for "all" (same object)', () => { expect(filterResults(results, 'all')).toBe(results) })
  it('passed / failed / given / not_given pick the right people', () => {
    expect(ids(filterResults(results, 'passed'))).toEqual(['passed'])
    expect(ids(filterResults(results, 'failed'))).toEqual(['failed', 'locked'])
    expect(ids(filterResults(results, 'given'))).toEqual(['passed', 'failed', 'locked'])
    expect(ids(filterResults(results, 'not_given'))).toEqual(['absent', 'midway'])
  })
  it('recomputes counts and per-question stats for the subset only', () => {
    const failed = filterResults(results, 'failed')
    expect(failed.counts).toMatchObject({ roster: 5, participants: 2, passed: 0, failed: 1, locked: 1 })
    expect(failed.questionStats[0]).toMatchObject({ correct: 0, wrong: 2, percent: 0 })
    const passed = filterResults(results, 'passed')
    expect(passed.questionStats[0]).toMatchObject({ correct: 1, wrong: 0, percent: 100 })
  })
  it('drops answers that belong to removed people', () => {
    expect(filterResults(results, 'not_given').answers.map(a => a.attempt_id)).toEqual(['d1'])
    expect(filterResults(results, 'passed').answers.map(a => a.attempt_id)).toEqual(['a1'])
  })
  it('handles a subset with nobody', () => {
    const none = filterResults({ ...results, rows: [results.rows[0]] }, 'failed')
    expect(none.rows).toEqual([])
    expect(none.questionStats[0].percent).toBe(0)
  })
})

describe('parseExportFilter', () => {
  it('falls back to all on unknown values', () => {
    expect(parseExportFilter('passed')).toBe('passed')
    expect(parseExportFilter('hack')).toBe('all')
    expect(parseExportFilter(null)).toBe('all')
  })
})
