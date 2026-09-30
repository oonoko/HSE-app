import { describe, expect, it } from 'vitest'
import { SHIFT_NUMBERS, shiftLabel, shiftLabelShort } from './shifts'

describe('shiftLabel', () => {
  it('labels numbered shifts 1-4 as "N-р ээлж"', () => {
    expect(shiftLabel(1)).toBe('1-р ээлж')
    expect(shiftLabel(4)).toBe('4-р ээлж')
  })

  it('labels shift 5 as "Хот"', () => {
    expect(shiftLabel(5)).toBe('Хот')
  })

  it('falls back to "N-р ээлж" for an unknown shift number', () => {
    expect(shiftLabel(9)).toBe('9-р ээлж')
  })

  it('returns a friendly message for null/undefined/0', () => {
    expect(shiftLabel(null)).toBe('Ээлж оноогоогүй')
    expect(shiftLabel(undefined)).toBe('Ээлж оноогоогүй')
    expect(shiftLabel(0)).toBe('Ээлж оноогоогүй')
  })
})

describe('shiftLabelShort', () => {
  it('matches shiftLabel for known shifts', () => {
    expect(shiftLabelShort(2)).toBe('2-р ээлж')
    expect(shiftLabelShort(5)).toBe('Хот')
  })

  it('uses a short fallback for null/undefined', () => {
    expect(shiftLabelShort(null)).toBe('Ээлжгүй')
  })
})

describe('SHIFT_NUMBERS', () => {
  it('includes 1 through 5', () => {
    expect(SHIFT_NUMBERS).toEqual([1, 2, 3, 4, 5])
  })
})
