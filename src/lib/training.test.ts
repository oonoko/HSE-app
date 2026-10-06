import { describe, expect, it } from 'vitest'
import {
  attemptsAllowed, creditedPointsFor, effectiveCorrect, effectivePoints, isPassed, nextAttemptState,
  participantStatus, pickFinalAttempts, summarizeAnswers, summarizeAttempts, type AttemptLite,
} from './training'

const training = { pass_percent: 80, max_attempts: 3 }
const regular = { pass_percent: null, max_attempts: 1 }
const attempt = (n: number, completed: boolean, passed: boolean | null): AttemptLite => ({ id: `a${n}`, attempt_number: n, completed, passed })

describe('isPassed', () => {
  it('is null for a quiz without a pass threshold', () => {
    expect(isPassed(5, 7, null)).toBeNull()
  })
  it('compares percent correct against the threshold, inclusive', () => {
    expect(isPassed(4, 5, 80)).toBe(true)
    expect(isPassed(3, 5, 80)).toBe(false)
    expect(isPassed(6, 7, 80)).toBe(true)   // 85.7%
    expect(isPassed(5, 7, 80)).toBe(false)  // 71.4%
  })
  it('fails an empty quiz instead of dividing by zero', () => {
    expect(isPassed(0, 0, 80)).toBe(false)
  })
})

describe('answer overrides', () => {
  const wrong = { question_id: 'q', is_correct: false, points: 0, response_ms: 5000 }
  const right = { question_id: 'q', is_correct: true, points: 90, response_ms: 1000 }

  it('uses the original result when there is no override', () => {
    expect(effectiveCorrect(wrong)).toBe(false)
    expect(effectivePoints(right)).toBe(90)
  })
  it('lets an override flip a wrong answer to correct with base points', () => {
    expect(effectiveCorrect({ ...wrong, override_correct: true })).toBe(true)
    expect(effectivePoints({ ...wrong, override_correct: true })).toBe(50)
  })
  it('keeps the earned points when an override confirms an already-correct answer', () => {
    expect(effectivePoints({ ...right, override_correct: true })).toBe(90)
  })
  it('lets an override flip a correct answer to wrong with zero points', () => {
    expect(effectiveCorrect({ ...right, override_correct: false })).toBe(false)
    expect(effectivePoints({ ...right, override_correct: false })).toBe(0)
  })
  it('summarizeAnswers counts overrides', () => {
    const summary = summarizeAnswers([right, { ...wrong, question_id: 'q2', override_correct: true }, { ...wrong, question_id: 'q3' }], 3)
    expect(summary.correct).toBe(2)
    expect(summary.wrong).toBe(1)
    expect(summary.score).toBe(140)
    expect(summary.percent).toBeCloseTo(66.67, 1)
  })
})

describe('creditedPointsFor', () => {
  it('credits nothing for a failed training attempt, everything otherwise', () => {
    expect(creditedPointsFor(300, false)).toBe(0)
    expect(creditedPointsFor(300, true)).toBe(300)
    expect(creditedPointsFor(300, null)).toBe(300)
  })
})

describe('attemptsAllowed', () => {
  it('is always 1 for a regular quiz', () => {
    expect(attemptsAllowed({ pass_percent: null, max_attempts: 5 }, 2)).toBe(1)
  })
  it('adds granted bonus attempts to a training quiz', () => {
    expect(attemptsAllowed(training)).toBe(3)
    expect(attemptsAllowed(training, 3)).toBe(6)
  })
})

describe('nextAttemptState — regular quiz', () => {
  it('starts a first attempt', () => {
    expect(nextAttemptState(regular, [])).toEqual({ kind: 'new', attemptNumber: 1 })
  })
  it('resumes an unfinished attempt', () => {
    expect(nextAttemptState(regular, [attempt(1, false, null)]).kind).toBe('resume')
  })
  it('reports a finished quiz and never offers a retake', () => {
    expect(nextAttemptState(regular, [attempt(1, true, null)]).kind).toBe('finished')
  })
})

describe('nextAttemptState — training quiz', () => {
  it('lets a driver retake after a failed attempt', () => {
    expect(nextAttemptState(training, [attempt(1, true, false)])).toEqual({ kind: 'new', attemptNumber: 2 })
  })
  it('stops offering attempts once one has passed', () => {
    expect(nextAttemptState(training, [attempt(1, true, false), attempt(2, true, true)]).kind).toBe('passed')
  })
  it('locks after the third failed attempt', () => {
    const failed = [attempt(1, true, false), attempt(2, true, false), attempt(3, true, false)]
    expect(nextAttemptState(training, failed)).toEqual({ kind: 'locked' })
  })
  it('unlocks when the admin grants more attempts', () => {
    const failed = [attempt(1, true, false), attempt(2, true, false), attempt(3, true, false)]
    expect(nextAttemptState(training, failed, 3)).toEqual({ kind: 'new', attemptNumber: 4 })
  })
  it('resumes an in-progress attempt even when others failed', () => {
    expect(nextAttemptState(training, [attempt(1, true, false), attempt(2, false, null)]).kind).toBe('resume')
  })
  it('turns a locked driver into a passed one when an override flips a failed attempt', () => {
    const afterOverride = [attempt(1, true, false), attempt(2, true, false), attempt(3, true, true)]
    expect(nextAttemptState(training, afterOverride).kind).toBe('passed')
  })
})

describe('summarizeAttempts / participantStatus', () => {
  it('counts attempts left', () => {
    const summary = summarizeAttempts(training, [attempt(1, true, false)])
    expect(summary).toMatchObject({ used: 1, allowed: 3, left: 2, passed: false, locked: false })
  })
  it('maps states to a status label key', () => {
    expect(participantStatus(training, [])).toBe('not_started')
    expect(participantStatus(training, [attempt(1, true, false)])).toBe('failed')
    expect(participantStatus(training, [attempt(1, true, true)])).toBe('passed')
    expect(participantStatus(training, [attempt(1, true, false), attempt(2, true, false), attempt(3, true, false)])).toBe('locked')
    expect(participantStatus(training, [attempt(1, false, null)])).toBe('in_progress')
    expect(participantStatus(regular, [attempt(1, true, null)])).toBe('completed')
  })
})

describe('pickFinalAttempts', () => {
  const row = (user_id: string, attempt_number: number, passed: boolean | null, score: number, completed = true) =>
    ({ user_id, quiz_id: 'q', attempt_number, passed, score, completed })

  it('prefers the passing attempt over a higher-scoring failed one', () => {
    const result = pickFinalAttempts([row('u1', 1, false, 400), row('u1', 2, true, 300)])
    expect(result).toHaveLength(1)
    expect(result[0].attempt_number).toBe(2)
  })
  it('otherwise takes the best score, latest on a tie', () => {
    const result = pickFinalAttempts([row('u1', 1, false, 200), row('u1', 2, false, 350), row('u1', 3, false, 350)])
    expect(result[0].attempt_number).toBe(3)
  })
  it('ignores unfinished attempts and keeps drivers separate', () => {
    const result = pickFinalAttempts([row('u1', 1, null, 0, false), row('u2', 1, true, 500)])
    expect(result.map(r => r.user_id)).toEqual(['u2'])
  })
})
