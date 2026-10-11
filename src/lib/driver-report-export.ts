import ExcelJS from 'exceljs'
import type { DriverReportPayload } from '@/lib/driver-report-data'
import { STATUS_LABELS, overrideReasonLabel } from '@/lib/training'
import { TREND_LABELS } from '@/lib/driver-report'
import { PROGRESS_LABELS } from '@/lib/game-analytics'
import { shiftLabel } from '@/lib/shifts'

const HEADER_FILL = 'FF164F99'
const GOOD = { fill: 'FFC6EFCE', font: 'FF006100' }
const BAD = { fill: 'FFFFC7CE', font: 'FF9C0006' }

function stamp(iso: string | null | undefined) {
  if (!iso) return ''
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

function header(sheet: ExcelJS.Worksheet, titles: string[], widths: number[]) {
  sheet.columns = widths.map(width => ({ width }))
  const row = sheet.addRow(titles)
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  row.height = 26
  row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } } })
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

function mark(cell: ExcelJS.Cell, good: boolean) {
  const style = good ? GOOD : BAD
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } }
  cell.font = { bold: true, color: { argb: style.font } }
}

export async function buildDriverWorkbook(payload: DriverReportPayload, generatedAt = new Date()): Promise<Buffer> {
  const { user, report } = payload
  const wb = new ExcelJS.Workbook()
  wb.creator = 'HSE Safety'
  wb.created = generatedAt

  const summary = wb.addWorksheet('Хураангуй')
  summary.columns = [{ width: 34 }, { width: 40 }]
  summary.getCell('A1').value = `${user.name} — хөгжлийн тайлан`
  summary.getCell('A1').font = { bold: true, size: 16, color: { argb: HEADER_FILL } }
  summary.mergeCells('A1:B1')
  const q = report.quizSummary, g = report.gameSummary
  const info: Array<[string, string | number]> = [
    ['SAP', user.sap_id], ['Ээлж', shiftLabel(user.shift_number)], ['Хэлтэс', user.department ?? ''],
    ['Нийт оноо', user.total_score], ['Нийт эрэмбэ', payload.rank ? `${payload.rank} / ${payload.total_drivers}` : '—'],
    ['Ээлжийн эрэмбэ', payload.shift_rank ? `${payload.shift_rank} / ${payload.shift_drivers}` : '—'],
    ['Тайлан гаргасан', stamp(generatedAt.toISOString())],
    ['', ''],
    ['Ерөнхий дүгнэлт', TREND_LABELS[report.overall]],
    ['', ''],
    ['Асуумж өгсөн тоо', q.count], ['Тэнцсэн сургалтын шалгалт', q.passed], ['Тэнцээгүй / түгжигдсэн', q.failed],
    ['Нийт оролдлого / дахин өгсөн', `${q.attemptsTotal} / ${q.retakes}`],
    ['Дундаж зөв хариулт (%)', q.avgPercent], ['Эхний асуумж (%)', q.firstPercent ?? '—'], ['Сүүлийн асуумж (%)', q.latestPercent ?? '—'],
    ['Асуумжийн өөрчлөлт (оноо)', q.change ?? '—'], ['Асуумжийн чиг хандлага', TREND_LABELS[q.trend]],
    ['', ''],
    ['Тоглосон тоглоом', g.games], ['Нийт тоглолт', g.plays], ['Тоглоомын нийт оноо', g.totalScore],
    ['Сайжирсан / тогтвортой / муудсан', `${g.improved} / ${g.stable} / ${g.declined}`],
  ]
  info.forEach(([label, value]) => { const row = summary.addRow([label, value]); row.getCell(1).font = { bold: true } })
  summary.addRow([]); summary.addRow(['Тэмдэглэл', 'Хувь нь зөв хариултын тоог асуултын тоонд харьцуулсан. Админ засварласан хариултыг зөв гэж тооцсон. Дахин өгсөн шалгалтад тэнцсэн (эсвэл хамгийн өндөр) оролдлогыг авсан.']).getCell(2).alignment = { wrapText: true }

  const quizzes = wb.addWorksheet('Асуумж')
  header(quizzes, ['Өдөр', 'Асуумж', 'Сэдэв', 'Төрөл', 'Төлөв', 'Оролдлого', 'Тооцсон оролдлого', 'Зөв', 'Буруу', 'Зөв хувь', 'Тэнцэх хувь', 'Нэмэгдсэн оноо'], [12, 34, 20, 18, 26, 11, 14, 8, 8, 10, 11, 14])
  for (const entry of report.quizzes) {
    const row = quizzes.addRow([entry.date, entry.title, entry.topic ?? '', entry.training ? 'Сургалтын шалгалт' : 'Өдрийн асуумж', STATUS_LABELS[entry.status], entry.attempts_used, `${entry.final.number}-р`, entry.final.correct, entry.final.wrong, entry.final.percent / 100, entry.pass_percent ? entry.pass_percent / 100 : '', entry.final.credited])
    row.getCell(10).numFmt = '0%'; row.getCell(11).numFmt = '0%'
    if (entry.status === 'passed') mark(row.getCell(5), true)
    if (entry.status === 'failed' || entry.status === 'locked') mark(row.getCell(5), false)
  }

  const answers = wb.addWorksheet('Хариултууд')
  header(answers, ['Өдөр', 'Асуумж', '№', 'Асуулт', 'Сонгосон хариулт', 'Зөв хариулт', 'Үр дүн', 'Админ засвар'], [12, 30, 5, 56, 30, 30, 10, 34])
  for (const entry of report.quizzes) {
    entry.answers.forEach((answer, index) => {
      const row = answers.addRow([entry.date, entry.title, index + 1, answer.text, answer.selected_index === null ? 'Хариулаагүй' : answer.options[answer.selected_index] ?? '', answer.options[answer.correct_index] ?? '', answer.correct ? 'Зөв' : 'Буруу', answer.overridden ? `Засагдсан: ${overrideReasonLabel(answer.override_reason)}` : ''])
      row.getCell(4).alignment = { wrapText: true, vertical: 'top' }
      mark(row.getCell(7), answer.correct)
    })
  }

  const attempts = wb.addWorksheet('Бүх оролдлого')
  header(attempts, ['Өдөр', 'Асуумж', 'Оролдлого №', 'Зөв', 'Буруу', 'Зөв хувь', 'Төлөв', 'Дууссан цаг'], [12, 34, 12, 8, 8, 10, 14, 18])
  for (const entry of report.quizzes) {
    for (const attempt of entry.attempts) {
      const row = attempts.addRow([entry.date, entry.title, attempt.number, attempt.correct, attempt.wrong, attempt.percent / 100, attempt.passed === null ? '' : attempt.passed ? 'Тэнцсэн' : 'Тэнцээгүй', stamp(attempt.completed_at)])
      row.getCell(6).numFmt = '0%'
      if (attempt.passed !== null) mark(row.getCell(7), attempt.passed)
    }
  }

  const weak = wb.addWorksheet('Сул асуултууд')
  header(weak, ['Асуумж', 'Сэдэв', 'Асуулт', 'Сонгосон хариулт', 'Зөв хариулт'], [30, 20, 56, 30, 30])
  for (const item of report.weakQuestions) weak.addRow([item.quiz_title, item.topic ?? '', item.text, item.chosen_text, item.correct_text]).getCell(3).alignment = { wrapText: true, vertical: 'top' }
  if (report.weakQuestions.length === 0) weak.addRow(['Алдсан асуулт байхгүй'])

  const topics = wb.addWorksheet('Сэдвээр')
  header(topics, ['Сэдэв', 'Хариулсан', 'Зөв', 'Зөв хувь'], [34, 12, 10, 10])
  for (const topic of report.topics) { const row = topics.addRow([topic.topic, topic.answered, topic.correct, topic.percent / 100]); row.getCell(4).numFmt = '0%' }

  const gameSheet = wb.addWorksheet('Тоглоом')
  header(gameSheet, ['Тоглоом', 'Тоглолт', 'Эхний', 'Сүүлийн', 'Шилдэг', 'Дундаж', 'Өөрчлөлт', 'Өөрчлөлт %', 'Төлөв'], [30, 10, 10, 10, 10, 10, 12, 12, 24])
  for (const game of report.games) {
    const row = gameSheet.addRow([game.title, game.plays, game.first, game.latest, game.best, game.average, game.plays > 1 ? game.change : '', game.plays > 1 ? game.changePercent / 100 : '', PROGRESS_LABELS[game.status]])
    row.getCell(8).numFmt = '0%'
    if (game.status === 'improved') mark(row.getCell(9), true)
    if (game.status === 'declined') mark(row.getCell(9), false)
  }
  gameSheet.addRow([])
  const hist = gameSheet.addRow(['Тоглолт бүр']); hist.font = { bold: true }
  gameSheet.addRow(['Тоглоом', 'Огноо', 'Оноо', 'Хугацаа (сек)']).font = { bold: true }
  for (const game of report.games) for (const play of game.history) gameSheet.addRow([game.title, stamp(play.played_at), play.score, play.duration_seconds])

  return Buffer.from(await wb.xlsx.writeBuffer())
}
