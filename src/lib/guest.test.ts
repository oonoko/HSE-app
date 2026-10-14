import { describe, expect, it } from 'vitest'
import { cleanNamePart, guestFullName, isGuest, validNamePart, validSapNumber } from './guest'

describe('guest helpers', () => {
  it('recognises guests by department', () => {
    expect(isGuest({ department: 'Зочин' })).toBe(true)
    expect(isGuest({ department: 'Жолооч' })).toBe(false)
    expect(isGuest({})).toBe(false)
  })
  it('accepts Mongolian and Latin names, rejects junk', () => {
    for (const ok of ['Бат', 'Бат-Эрдэнэ', 'Өлзий', 'John', "O'Neil", 'А']) expect(validNamePart(ok), ok).toBe(true)
    for (const bad of ['', '12', '<b>', 'Бат;DROP', 'x'.repeat(41), '-Бат']) expect(validNamePart(bad), bad).toBe(false)
  })
  it('cleans whitespace and joins last name then first name', () => {
    expect(cleanNamePart('  Бат   Болд ')).toBe('Бат Болд')
    expect(guestFullName('Дорж', 'Сүхээ')).toBe('Дорж Сүхээ')
  })
  it('validates SAP numbers', () => {
    expect(validSapNumber('1234567')).toBe(true)
    expect(validSapNumber('12')).toBe(false)
    expect(validSapNumber('12ab')).toBe(false)
  })
})
