import ExcelJS from 'exceljs'
import { TREND_LABELS, type Trend } from '@/lib/driver-report'
import { attentionReasons, groupGames, groupTopics, verdictCounts, type ShiftDriverReport } from '@/lib/shift-report'
import { shiftLabel } from '@/lib/shifts'
import { addChartsToWorkbook, type ChartSpec } from '@/lib/xlsx-charts'

const HEADER_FILL = 'FF164F99'
const TREND_STYLE: Record<Trend, { fill: string; font: string; chart: string }> = {
  improved: { fill: 'FFC6EFCE', font: 'FF006100', chart: '19A66A' },
  stable: { fill: 'FFDDEBF7', font: 'FF1F4E78', chart: '164F99' },
  declined: { fill: 'FFFFC7CE', font: 'FF9C0006', chart: 'DC3E45' },
  unknown: { fill: 'FFEDEDED', font: 'FF595959', chart: '9AA7B8' },
}
const TREND_ORDER: Trend[] = ['improved', 'stable', 'declined', 'unknown']

function header(sheet: ExcelJS.Worksheet, titles: string[], widths: number[]) {
  sheet.columns = widths.map(width => ({ width }))
  const row = sheet.addRow(titles)
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  row.height = 28
  row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } } })
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

function trendCell(cell: ExcelJS.Cell, trend: Trend) {
  const style = TREND_STYLE[trend]
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } }
  cell.font = { bold: true, color: { argb: style.font } }
}

export async function buildShiftWorkbook(rows: ShiftDriverReport[], shift: number | null, generatedAt = new Date()): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'HSE Safety'
  wb.created = generatedAt
  const scope = shift ? shiftLabel(shift) : 'Бүх ээлж'
  const sorted = [...rows].sort((a, b) => (a.driver.shift_number ?? 99) - (b.driver.shift_number ?? 99) || b.driver.total_score - a.driver.total_score)
  const counts = verdictCounts(rows)
  const active = rows.filter(row => row.report.quizSummary.count > 0 || row.report.gameSummary.plays > 0).length
  const quizTakers = rows.filter(row => row.report.quizSummary.count > 0)
  const avgQuiz = quizTakers.length ? Math.round(quizTakers.reduce((sum, row) => sum + row.report.quizSummary.avgPercent, 0) / quizTakers.length) : 0

  // ---- Overview ------------------------------------------------------------
  const overview = wb.addWorksheet('Ерөнхий')
  overview.columns = [{ width: 34 }, { width: 16 }, { width: 3 }]
  overview.getCell('A1').value = `${scope} — хөгжлийн нэгдсэн тайлан`
  overview.getCell('A1').font = { bold: true, size: 16, color: { argb: HEADER_FILL } }
  overview.mergeCells('A1:B1')
  const lines: Array<[string, string | number]> = [
    ['Тайлан гаргасан', generatedAt.toISOString().slice(0, 16).replace('T', ' ') + ' (UTC)'],
    ['Нийт жолооч', rows.length], ['Идэвхтэй (асуумж эсвэл тоглоом)', active], ['Огт оролцоогүй', rows.length - active],
    ['Асуумж өгсөн хүн', quizTakers.length], ['Асуумжийн дундаж зөв хариулт (%)', avgQuiz],
    ['Анхаарах шаардлагатай', rows.filter(row => attentionReasons(row.report).length > 0).length],
  ]
  lines.forEach(([label, value]) => { const row = overview.addRow([label, value]); row.getCell(1).font = { bold: true } })
  overview.addRow([])
  const verdictHeader = overview.addRow(['Ерөнхий дүгнэлт', 'Хүний тоо']); verdictHeader.font = { bold: true }
  const verdictFirst = overview.rowCount + 1
  for (const trend of TREND_ORDER) { const row = overview.addRow([TREND_LABELS[trend], counts[trend]]); trendCell(row.getCell(1), trend) }
  const verdictLast = overview.rowCount

  // ---- Per driver ----------------------------------------------------------
  const people = wb.addWorksheet('Жолооч бүрээр')
  header(people, ['Нэр', 'SAP', 'Ээлж', 'Нийт оноо', 'Эрэмбэ', 'Асуумж', 'Дундаж зөв %', 'Эхний %', 'Сүүлийн %', 'Өөрчлөлт', 'Тэнцсэн', 'Тэнцээгүй / түгжигдсэн', 'Дахин өгсөн', 'Тоглолт', 'Тоглоомын оноо', 'Тоглоомд сайжирсан', 'Ерөнхий дүгнэлт'], [30, 10, 12, 11, 9, 9, 12, 10, 11, 11, 9, 14, 11, 9, 13, 13, 24])
  for (const { driver, rank, report } of sorted) {
    const q = report.quizSummary, g = report.gameSummary
    const row = people.addRow([driver.name, driver.sap_id, shiftLabel(driver.shift_number), driver.total_score, rank ?? '', q.count, q.count ? q.avgPercent / 100 : '', q.firstPercent !== null ? q.firstPercent / 100 : '', q.latestPercent !== null ? q.latestPercent / 100 : '', q.change ?? '', q.passed, q.failed, q.retakes, g.plays, g.totalScore, g.improved, TREND_LABELS[report.overall]])
    ;[7, 8, 9].forEach(col => { row.getCell(col).numFmt = '0%' })
    trendCell(row.getCell(17), report.overall)
  }
  people.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 17 } }

  // ---- Attention -----------------------------------------------------------
  const attention = wb.addWorksheet('Анхаарах хүмүүс')
  header(attention, ['Нэр', 'SAP', 'Ээлж', 'Шалтгаан', 'Дундаж зөв %', 'Дүгнэлт'], [30, 10, 12, 64, 12, 24])
  let flagged = 0
  for (const { driver, report } of sorted) {
    const reasons = attentionReasons(report)
    if (reasons.length === 0) continue
    flagged += 1
    const row = attention.addRow([driver.name, driver.sap_id, shiftLabel(driver.shift_number), reasons.join('; '), report.quizSummary.count ? report.quizSummary.avgPercent / 100 : '', TREND_LABELS[report.overall]])
    row.getCell(5).numFmt = '0%'; row.getCell(4).alignment = { wrapText: true, vertical: 'top' }
    trendCell(row.getCell(6), report.overall)
  }
  if (flagged === 0) attention.addRow(['Анхаарах шаардлагатай хүн алга'])

  // ---- Topics --------------------------------------------------------------
  const topicSheet = wb.addWorksheet('Сэдвээр')
  header(topicSheet, ['Сэдэв', 'Хүн', 'Хариулт', 'Зөв', 'Зөв хувь'], [36, 10, 12, 10, 12])
  const topics = groupTopics(rows)
  for (const topic of topics) { const row = topicSheet.addRow([topic.topic, topic.drivers, topic.answered, topic.correct, topic.percent / 100]); row.getCell(5).numFmt = '0%' }
  if (topics.length === 0) topicSheet.addRow(['Өгөгдөл алга'])

  // ---- Games ---------------------------------------------------------------
  const gameSheet = wb.addWorksheet('Тоглоомоор')
  header(gameSheet, ['Тоглоом', 'Тоглосон хүн', 'Нийт тоглолт', 'Дахин тоглосон', 'Эхний дундаж', 'Сүүлийн дундаж', 'Өөрчлөлт', 'Сайжирсан', 'Муудсан'], [30, 12, 12, 13, 13, 14, 11, 11, 10])
  const gameRows = groupGames(rows)
  for (const game of gameRows) gameSheet.addRow([game.title, game.players, game.plays, game.repeaters, game.repeaters ? game.avgFirst : '', game.repeaters ? game.avgLatest : '', game.repeaters ? game.avgLatest - game.avgFirst : '', game.improved, game.declined])
  if (gameRows.length === 0) gameSheet.addRow(['Өгөгдөл алга'])

  const raw = await wb.xlsx.writeBuffer()
  const charts: ChartSpec[] = [{
    type: 'pie', title: 'Ерөнхий дүгнэлтийн харьцаа', seriesName: 'Хүн', sheet: 'Ерөнхий',
    categoryRange: `$A$${verdictFirst}:$A$${verdictLast}`, valueRange: `$B$${verdictFirst}:$B$${verdictLast}`,
    categories: TREND_ORDER.map(trend => TREND_LABELS[trend]), values: TREND_ORDER.map(trend => counts[trend]),
    colors: TREND_ORDER.map(trend => TREND_STYLE[trend].chart), anchor: { col: 3, row: 1, cols: 8, rows: 17 },
  }]
  return addChartsToWorkbook(Buffer.from(raw as ArrayBuffer), 'Ерөнхий', charts)
}
