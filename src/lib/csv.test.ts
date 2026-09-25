import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'

describe('parseCsv', () => {
  it('splits a simple header + rows', () => {
    const result = parseCsv('sap_id,name,shift_number\n1234567,Бат Бат,1\n7654321,Дорж Дорж,2')
    expect(result).toEqual([
      ['sap_id', 'name', 'shift_number'],
      ['1234567', 'Бат Бат', '1'],
      ['7654321', 'Дорж Дорж', '2'],
    ])
  })

  it('keeps commas inside quoted fields intact', () => {
    const result = parseCsv('sap_id,name\n1234567,"Бат, Болд"')
    expect(result[1]).toEqual(['1234567', 'Бат, Болд'])
  })

  it('unescapes doubled quotes inside a quoted field', () => {
    const result = parseCsv('sap_id,name\n1234567,"Ту""нхаг"')
    expect(result[1]).toEqual(['1234567', 'Ту"нхаг'])
  })

  it('handles CRLF and bare LF line endings the same way', () => {
    const crlf = parseCsv('a,b\r\n1,2\r\n')
    const lf = parseCsv('a,b\n1,2\n')
    expect(crlf).toEqual(lf)
  })

  it('drops blank lines', () => {
    const result = parseCsv('a,b\n\n1,2\n\n')
    expect(result).toEqual([['a', 'b'], ['1', '2']])
  })

  it('returns an empty array for empty input', () => {
    expect(parseCsv('')).toEqual([])
  })
})
