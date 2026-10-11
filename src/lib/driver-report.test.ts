import { describe, expect, it } from 'vitest'
import { buildDriverReport, type AnswerRecord, type QuizAttemptRecord } from './driver-report'

const questions = [
  { id: 'q1', text: 'Хурд?', options: [{ text: '40' }, { text: '60' }, { text: '90' }], correct_index: 1 },
  { id: 'q2', text: 'Бүс?', options: [{ text: 'Тийм' }, { text: 'Үгүй' }, { text: 'Заримдаа' }], correct_index: 0 },
]
const quiz = (title: string, date: string, pass: number | null, max = 1, topic: string | null = null) => ({ title, topic, active_date: date, pass_percent: pass, max_attempts: max, questions })
const attempt = (id: string, quiz_id: string, n: number, correct: number, q: QuizAttemptRecord['quiz'], passed: boolean | null = null, score = correct * 100): QuizAttemptRecord => ({
  id, quiz_id, user_id: 'u', attempt_number: n, completed: true, passed, score, max_score: 200, correct_count: correct, wrong_count: 2 - correct,
  credited_points: passed === false ? 0 : score, started_at: `${q.active_date}T03:00:00Z`, completed_at: `${q.active_date}T03:05:00Z`, quiz: q,
})
const ans = (attempt_id: string, question_id: string, selected: number | null, is_correct: boolean, override_correct: boolean | null = null): AnswerRecord => ({ attempt_id, question_id, selected_index: selected, is_correct, override_correct, override_reason: override_correct === null ? null : 'misclick' })

describe('buildDriverReport', () => {
  const q1 = quiz('Эхний', '2026-09-10', null, 1, 'Хурд')
  const q2 = quiz('Сургалт', '2026-09-20', 80, 3, 'Бүс')
  const attempts = [
    attempt('a1', 'z1', 1, 1, q1),
    attempt('b1', 'z2', 1, 0, q2, false), attempt('b2', 'z2', 2, 2, q2, true),
    { ...attempt('c1', 'z3', 1, 0, q1), completed: false, completed_at: null },
  ]
  const answers = [
    ans('a1', 'q1', 1, true), ans('a1', 'q2', 2, false),
    ans('b2', 'q1', 1, true), ans('b2', 'q2', 1, false, true),
  ]
  const report = buildDriverReport(attempts, answers, [])

  it('counts one result per quiz and ignores unfinished attempts', () => {
    expect(report.quizzes.map(entry => entry.quiz_id)).toEqual(['z1', 'z2'])
    expect(report.quizSummary).toMatchObject({ count: 2, passed: 1, attemptsTotal: 3, retakes: 1 })
  })

  it('uses the passing attempt for a retaken training quiz', () => {
    const training = report.quizzes[1]
    expect(training).toMatchObject({ training: true, status: 'passed' })
    expect(training.final).toMatchObject({ number: 2, percent: 100, passed: true })
    expect(training.attempts.map(item => item.percent)).toEqual([0, 100])
  })

  it('honours admin overrides in answers and topic stats', () => {
    const overridden = report.quizzes[1].answers.find(item => item.question_id === 'q2')!
    expect(overridden).toMatchObject({ correct: true, overridden: true })
    expect(report.topics.find(topic => topic.topic === 'Бүс')).toMatchObject({ answered: 2, correct: 2, percent: 100 })
    expect(report.topics.find(topic => topic.topic === 'Хурд')).toMatchObject({ answered: 2, correct: 1, percent: 50 })
  })

  it('lists only questions still wrong in the final attempt', () => {
    expect(report.weakQuestions).toHaveLength(1)
    expect(report.weakQuestions[0]).toMatchObject({ quiz_id: 'z1', question_id: 'q2', correct_text: 'Тийм', chosen_text: 'Заримдаа' })
  })

  it('reads the trend from first to latest quiz result', () => {
    expect(report.quizSummary).toMatchObject({ firstPercent: 50, latestPercent: 100, change: 50, trend: 'improved' })
    expect(report.overall).toBe('improved')
  })

  it('reports a locked training quiz', () => {
    const locked = buildDriverReport([attempt('x1', 'z', 1, 0, q2, false), attempt('x2', 'z', 2, 1, q2, false), attempt('x3', 'z', 3, 1, q2, false)], [], [])
    expect(locked.quizzes[0].status).toBe('locked')
    expect(locked.quizSummary.failed).toBe(1)
    expect(locked.quizSummary.creditedPoints).toBe(0)
  })

  it('summarises games per game and falls back to them for the verdict', () => {
    const game = (id: string, score: number, at: string) => ({ id, game_id: 'g', score, duration_seconds: 60, played_at: at, game: { title: 'C3', template: 'truth_false' } })
    const result = buildDriverReport([], [], [game('1', 500, '2026-09-17T03:00:00Z'), game('2', 1400, '2026-10-01T03:00:00Z')])
    expect(result.games[0]).toMatchObject({ plays: 2, first: 500, latest: 1400, best: 1400, change: 900, status: 'improved' })
    expect(result.gameSummary).toMatchObject({ plays: 2, totalScore: 1900, improved: 1 })
    expect(result.quizSummary.trend).toBe('unknown')
    expect(result.overall).toBe('improved')
  })

  it('handles a driver with no activity', () => {
    const empty = buildDriverReport([], [], [])
    expect(empty.quizzes).toEqual([])
    expect(empty.overall).toBe('unknown')
  })
})
