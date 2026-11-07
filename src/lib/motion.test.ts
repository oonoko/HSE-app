import { describe, expect, it } from 'vitest'
import { countUpValue, easeOutCubic } from './motion'

describe('countUpValue', () => {
  it('starts at from, ends exactly at to', () => {
    expect(countUpValue(0, 396, 0)).toBe(0)
    expect(countUpValue(0, 396, 1)).toBe(396)
    expect(countUpValue(0, 396, 1.4)).toBe(396)
    expect(countUpValue(0, 396, -1)).toBe(0)
  })
  it('moves fast at first, then slows (ease-out)', () => {
    const early = countUpValue(0, 100, 0.25), late = countUpValue(0, 100, 0.75)
    expect(early).toBeGreaterThan(25)
    expect(late - countUpValue(0, 100, 0.5)).toBeLessThan(countUpValue(0, 100, 0.5) - early)
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 3)
  })
  it('counts down too and never overshoots', () => {
    for (let p = 0; p <= 1; p += 0.05) { const v = countUpValue(500, 120, p); expect(v).toBeLessThanOrEqual(500); expect(v).toBeGreaterThanOrEqual(120) }
  })
})
