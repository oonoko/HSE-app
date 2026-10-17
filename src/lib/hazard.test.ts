import { describe, expect, it } from 'vitest'
import { isOpen, mapsUrl, maskReporter, validateHazardInput } from './hazard'

const PREFIX = 'https://x.supabase.co/storage/v1/object/public/hazard-images/'
const base = { kind: 'hazard', category: 'road', severity: 'high', location_text: ' Тавантолгой   зам ', description: 'Зам цөмөрсөн байна', image_urls: [], anonymous: false }

describe('validateHazardInput', () => {
  it('accepts a complete report and tidies text', () => {
    const result = validateHazardInput({ ...base, latitude: 43.5, longitude: 105.2, anonymous: true }, PREFIX)
    expect(result).toMatchObject({ ok: true, value: { location_text: 'Тавантолгой зам', latitude: 43.5, longitude: 105.2, anonymous: true } })
  })
  it('rejects unknown choices and short or long text', () => {
    expect(validateHazardInput({ ...base, kind: 'x' }, PREFIX).ok).toBe(false)
    expect(validateHazardInput({ ...base, category: 'x' }, PREFIX).ok).toBe(false)
    expect(validateHazardInput({ ...base, severity: 'x' }, PREFIX).ok).toBe(false)
    expect(validateHazardInput({ ...base, location_text: ' ' }, PREFIX).ok).toBe(false)
    expect(validateHazardInput({ ...base, description: 'ab' }, PREFIX).ok).toBe(false)
    expect(validateHazardInput({ ...base, description: 'a'.repeat(2001) }, PREFIX).ok).toBe(false)
  })
  it('requires both coordinates, in range', () => {
    expect(validateHazardInput({ ...base, latitude: 43 }, PREFIX).ok).toBe(false)
    expect(validateHazardInput({ ...base, latitude: 91, longitude: 10 }, PREFIX).ok).toBe(false)
    expect(validateHazardInput({ ...base, latitude: 'abc', longitude: 10 }, PREFIX).ok).toBe(false)
    expect(validateHazardInput({ ...base, latitude: null, longitude: null }, PREFIX).ok).toBe(true)
  })
  it('limits photos to three from our own storage', () => {
    const ok = [`${PREFIX}a.jpg`, `${PREFIX}b.jpg`, `${PREFIX}c.jpg`]
    expect(validateHazardInput({ ...base, image_urls: ok }, PREFIX).ok).toBe(true)
    expect(validateHazardInput({ ...base, image_urls: [...ok, `${PREFIX}d.jpg`] }, PREFIX).ok).toBe(false)
    expect(validateHazardInput({ ...base, image_urls: ['https://evil.example/a.jpg'] }, PREFIX).ok).toBe(false)
  })
})

describe('helpers', () => {
  it('hides anonymous reporters only', () => {
    const named = { anonymous: false, reporter: { name: 'Бат', sap_id: '1' } }
    expect(maskReporter(named).reporter).toEqual(named.reporter)
    expect(maskReporter({ ...named, anonymous: true }).reporter).toBeNull()
  })
  it('builds a maps link and knows open statuses', () => {
    expect(mapsUrl(43.5, 105.2)).toBe('https://www.google.com/maps?q=43.5,105.2')
    expect(mapsUrl(null, 1)).toBeNull()
    expect(isOpen('new') && isOpen('in_review') && !isOpen('resolved') && !isOpen('rejected')).toBe(true)
  })
})
