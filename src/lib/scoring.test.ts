import { describe, expect, it } from 'vitest'
import { calculatePoints } from './scoring'

describe('calculatePoints', () => {
  it('awards 0 for a wrong answer regardless of speed', () => {
    expect(calculatePoints(false, 0, 30000)).toBe(0)
    expect(calculatePoints(false, 29999, 30000)).toBe(0)
  })

  it('awards the max (100) for an instant correct answer', () => {
    expect(calculatePoints(true, 0, 30000)).toBe(100)
  })

  it('awards the base (50) for a correct answer right at the deadline', () => {
    expect(calculatePoints(true, 30000, 30000)).toBe(50)
  })

  it('scales linearly between 50 and 100 based on remaining time', () => {
    // half the time left -> halfway between base and max
    expect(calculatePoints(true, 15000, 30000)).toBe(75)
  })

  it('clamps a response time beyond the limit to the base score', () => {
    expect(calculatePoints(true, 999999, 30000)).toBe(50)
  })

  it('clamps a negative response time to the max score', () => {
    expect(calculatePoints(true, -500, 30000)).toBe(100)
  })

  it('returns 0 when the time limit is zero or negative (no divide-by-zero)', () => {
    expect(calculatePoints(true, 0, 0)).toBe(0)
    expect(calculatePoints(true, 0, -5000)).toBe(0)
  })
})
