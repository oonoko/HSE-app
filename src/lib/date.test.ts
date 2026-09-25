import { describe, expect, it } from 'vitest'
import { mongoliaDate, mongoliaTime } from './date'

describe('mongoliaDate', () => {
  it('formats as YYYY-MM-DD in the Asia/Ulaanbaatar timezone', () => {
    // 2026-01-01T15:30:00Z is 2026-01-01T23:30:00+08:00 in Ulaanbaatar — still the same day
    expect(mongoliaDate(new Date('2026-01-01T15:30:00Z'))).toBe('2026-01-01')
    // 2026-01-01T17:00:00Z is 2026-01-02T01:00:00+08:00 — rolled into the next day locally
    expect(mongoliaDate(new Date('2026-01-01T17:00:00Z'))).toBe('2026-01-02')
  })
})

describe('mongoliaTime', () => {
  it('formats as 24-hour HH:mm in the Asia/Ulaanbaatar timezone', () => {
    expect(mongoliaTime(new Date('2026-01-01T04:15:00Z'))).toBe('12:15')
  })
})
