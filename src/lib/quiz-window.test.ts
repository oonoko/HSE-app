import { describe, expect, it } from 'vitest'
import { isQuizOpenForDriver } from './quiz-window'

const baseQuiz = { active_date: '2026-09-15', status: 'scheduled', target_shift: null, start_time: '08:00:00', end_time: '20:00:00' }
const noon = { date: '2026-09-15', time: '12:00' }

describe('isQuizOpenForDriver', () => {
  it('is open for the right date, status and time window', () => {
    expect(isQuizOpenForDriver(baseQuiz, noon)).toBe(true)
  })

  it('is closed on a different date', () => {
    expect(isQuizOpenForDriver(baseQuiz, { ...noon, date: '2026-09-16' })).toBe(false)
  })

  it('is closed before the start time', () => {
    expect(isQuizOpenForDriver(baseQuiz, { ...noon, time: '07:59' })).toBe(false)
  })

  it('is closed after the end time', () => {
    expect(isQuizOpenForDriver(baseQuiz, { ...noon, time: '20:01' })).toBe(false)
  })

  it('is open exactly at the boundaries', () => {
    expect(isQuizOpenForDriver(baseQuiz, { ...noon, time: '08:00' })).toBe(true)
    expect(isQuizOpenForDriver(baseQuiz, { ...noon, time: '20:00' })).toBe(true)
  })

  it('rejects a status outside scheduled/active', () => {
    expect(isQuizOpenForDriver({ ...baseQuiz, status: 'closed' }, noon)).toBe(false)
    expect(isQuizOpenForDriver({ ...baseQuiz, status: 'draft' }, noon)).toBe(false)
  })

  it('accepts a null target_shift for any driver shift', () => {
    expect(isQuizOpenForDriver(baseQuiz, { ...noon, shiftNumber: 3 })).toBe(true)
    expect(isQuizOpenForDriver(baseQuiz, { ...noon, shiftNumber: null })).toBe(true)
  })

  it('only opens for the matching shift when target_shift is set', () => {
    const shiftQuiz = { ...baseQuiz, target_shift: 2 }
    expect(isQuizOpenForDriver(shiftQuiz, { ...noon, shiftNumber: 2 })).toBe(true)
    expect(isQuizOpenForDriver(shiftQuiz, { ...noon, shiftNumber: 1 })).toBe(false)
    expect(isQuizOpenForDriver(shiftQuiz, { ...noon, shiftNumber: null })).toBe(false)
  })
})
