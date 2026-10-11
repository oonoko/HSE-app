import { describe, expect, it } from 'vitest'
import { buildDriverReport } from './driver-report'
import { attentionReasons, groupGames, groupTopics, verdictCounts, type ShiftDriverReport } from './shift-report'

const q = (topic: string) => ({ id: 'q1', text: 'Асуулт', topic, options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }], correct_index: 0 })
const quiz = (pass: number | null) => ({ title: 'Шалгалт', topic: null, active_date: '2026-10-01', pass_percent: pass, max_attempts: 2, questions: [q('Хурд')] })
const attempt = (id: string, n: number, correct: number, pass: number | null, passed: boolean | null) => ({
  id, quiz_id: `z-${id[0]}`, user_id: 'u', attempt_number: n, completed: true, passed, score: correct * 100, max_score: 100, correct_count: correct, wrong_count: 1 - correct,
  credited_points: correct * 100, started_at: '2026-10-01T03:00:00Z', completed_at: '2026-10-01T03:05:00Z', quiz: quiz(pass),
})
const answer = (attempt_id: string, ok: boolean) => ({ attempt_id, question_id: 'q1', selected_index: ok ? 0 : 1, is_correct: ok, override_correct: null, override_reason: null })
const game = (id: string, score: number, at: string) => ({ id, game_id: 'g', score, duration_seconds: 60, played_at: at, game: { title: 'C3', template: 'truth_false' } })
const row = (name: string, report: ReturnType<typeof buildDriverReport>): ShiftDriverReport => ({ driver: { id: name, sap_id: name, name, shift_number: 1, total_score: 0 }, rank: null, report })

describe('shift report helpers', () => {
  const good = row('good', buildDriverReport([attempt('a1', 1, 1, null, null)], [answer('a1', true)], [game('1', 500, '2026-09-17T03:00:00Z'), game('2', 900, '2026-10-01T03:00:00Z')]))
  const weak = row('weak', buildDriverReport([attempt('b1', 1, 0, 80, false)], [answer('b1', false)], []))
  const idle = row('idle', buildDriverReport([], [], []))

  it('flags drivers who need attention with reasons', () => {
    expect(attentionReasons(good.report)).toEqual([])
    expect(attentionReasons(idle.report)).toEqual(['Асуумж өгөөгүй, тоглоом тоглоогүй'])
    const reasons = attentionReasons(weak.report)
    expect(reasons).toContain('Сургалтын шалгалтад тэнцээгүй, дахин оролдох боломжтой')
    expect(reasons.some(text => text.includes('60%'))).toBe(true)
  })

  it('counts verdicts', () => {
    expect(verdictCounts([good, weak, idle])).toEqual({ improved: 1, stable: 0, declined: 0, unknown: 2 })
  })

  it('sums topic answers across drivers', () => {
    expect(groupTopics([good, weak, idle])).toEqual([{ topic: 'Хурд', answered: 2, correct: 1, percent: 50, drivers: 2 }])
  })

  it('summarises games across drivers', () => {
    expect(groupGames([good, weak, idle])).toEqual([{ title: 'C3', players: 1, plays: 2, repeaters: 1, avgFirst: 500, avgLatest: 900, improved: 1, declined: 0 }])
  })
})
