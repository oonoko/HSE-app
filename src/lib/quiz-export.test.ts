import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { buildQuizWorkbook } from './quiz-export'
import type { QuizResults } from './quiz-results'

const questions = [
  { id: 'q1', text: 'Хурдны хязгаар хэд вэ?', options: [{ text: '40' }, { text: '60' }, { text: '90' }] as any, correct_index: 1, explanation: 'Хот доторх хурд' },
  { id: 'q2', text: 'Бүс зүүх шаардлагатай юу?', options: [{ text: 'Тийм' }, { text: 'Үгүй' }, { text: 'Заримдаа' }] as any, correct_index: 0 },
]

const attempt = (id: string, n: number, passed: boolean | null, correct: number) => ({
  id, attempt_number: n, completed: true, passed, percent: Math.round((correct / 2) * 100), correct_count: correct, wrong_count: 2 - correct,
  score: correct * 90, started_at: '2026-10-06T03:00:00Z', completed_at: '2026-10-06T03:05:00Z', overridden: 0,
})

const results: QuizResults = {
  quiz: { id: 'z', title: 'Аюулгүй жолоодлого', topic: 'Сургалт', active_date: '2026-10-06', target_shift: 2, pass_percent: 80, max_attempts: 3, questions },
  training: true,
  rows: [
    { user: { id: 'u1', sap_id: '1001', name: 'Бат Болд', shift_number: 2 }, in_roster: true, bonus: 0, status: 'passed', attempts_used: 1, attempts_allowed: 3, attempts: [attempt('a1', 1, true, 2)], final: attempt('a1', 1, true, 2) },
    { user: { id: 'u2', sap_id: '1002', name: 'Дорж Сувд', shift_number: 2 }, in_roster: true, bonus: 0, status: 'locked', attempts_used: 3, attempts_allowed: 3, attempts: [attempt('b1', 1, false, 1), attempt('b2', 2, false, 0), attempt('b3', 3, false, 1)], final: attempt('b3', 3, false, 1) },
    { user: { id: 'u3', sap_id: '1003', name: 'Нараа Эрдэнэ', shift_number: 2 }, in_roster: true, bonus: 0, status: 'not_started', attempts_used: 0, attempts_allowed: 3, attempts: [], final: null },
  ],
  counts: { roster: 3, participants: 3, passed: 1, failed: 0, locked: 1, in_progress: 0, not_started: 1, completed: 0 },
  questionStats: [{ id: 'q1', text: questions[0].text, correct: 1, wrong: 1, percent: 50 }, { id: 'q2', text: questions[1].text, correct: 1, wrong: 1, percent: 50 }],
  answers: [
    { attempt_id: 'a1', question_id: 'q1', selected_index: 1, is_correct: true, override_correct: null, override_reason: null, overridden_at: null, response_ms: 4200, points: 90 },
    { attempt_id: 'a1', question_id: 'q2', selected_index: 0, is_correct: true, override_correct: null, override_reason: null, overridden_at: null, response_ms: 3000, points: 90 },
    { attempt_id: 'b3', question_id: 'q1', selected_index: 1, is_correct: true, override_correct: null, override_reason: null, overridden_at: null, response_ms: 5000, points: 90 },
    { attempt_id: 'b3', question_id: 'q2', selected_index: 1, is_correct: false, override_correct: null, override_reason: null, overridden_at: null, response_ms: 6000, points: 0 },
  ],
}

describe('buildQuizWorkbook', () => {
  it('writes every sheet with the expected people and results', async () => {
    const buffer = await buildQuizWorkbook(results, new Date('2026-10-06T08:00:00Z'))
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as any)
    expect(wb.worksheets.map(sheet => sheet.name)).toEqual(['Хураангуй', 'Тэнцсэн хүмүүс', 'Оролцогчид', 'Хариултын матриц', 'Бүх оролдлого', 'Асуултууд'])

    const passed = wb.getWorksheet('Тэнцсэн хүмүүс')!
    expect(passed.rowCount).toBe(2)
    expect(passed.getRow(2).getCell(3).value).toBe('Бат Болд')

    const people = wb.getWorksheet('Оролцогчид')!
    expect(people.rowCount).toBe(4)
    expect(people.getRow(3).getCell(7).value).toBe('3/3')

    const matrix = wb.getWorksheet('Хариултын матриц')!
    expect(matrix.getRow(2).getCell(5).value).toBe('B')
    expect(matrix.getRow(3).getCell(6).value).toBe('B')

    const attempts = wb.getWorksheet('Бүх оролдлого')!
    // 2 answered (passed user) + 3 attempts x 2 questions (locked user)
    expect(attempts.rowCount).toBe(1 + 2 + 6)
  })

  it('adds a pie and a bar chart to the summary sheet', async () => {
    const buffer = await buildQuizWorkbook(results)
    const zip = await JSZip.loadAsync(buffer)
    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining(['xl/charts/chart1.xml', 'xl/charts/chart2.xml', 'xl/drawings/drawing1.xml']))
    const pie = await zip.file('xl/charts/chart1.xml')!.async('string')
    const bar = await zip.file('xl/charts/chart2.xml')!.async('string')
    expect(pie).toContain('<c:pieChart>')
    expect(pie).toContain("'Хураангуй'!$A$")
    expect(bar).toContain('<c:barChart>')
    const contentTypes = await zip.file('[Content_Types].xml')!.async('string')
    expect(contentTypes).toContain('/xl/charts/chart1.xml')
    expect(contentTypes).toContain('/xl/drawings/drawing1.xml')
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
    expect(sheet).toContain('<drawing r:id="rIdChartDrawing"/>')
    expect(sheet.indexOf('<drawing')).toBeGreaterThan(sheet.indexOf('</sheetData>'))
  })

  it('still builds a workbook for a quiz with no participants', async () => {
    const empty: QuizResults = { ...results, rows: [], answers: [], counts: { ...results.counts, roster: 0, participants: 0, passed: 0, locked: 0, not_started: 0 }, questionStats: results.questionStats.map(stat => ({ ...stat, correct: 0, wrong: 0, percent: 0 })) }
    const buffer = await buildQuizWorkbook(empty)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as any)
    expect(wb.getWorksheet('Тэнцсэн хүмүүс')!.rowCount).toBe(1)
  })
})
