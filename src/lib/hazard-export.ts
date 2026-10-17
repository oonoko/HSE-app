import ExcelJS from 'exceljs'
import { HAZARD_CATEGORIES, HAZARD_SEVERITIES, HAZARD_STATUSES, categoryLabel, kindLabel, mapsUrl, severityLabel, statusLabel } from '@/lib/hazard'
import { shiftLabel } from '@/lib/shifts'
import { addChartsToWorkbook, type ChartSpec } from '@/lib/xlsx-charts'

export type HazardRow = {
  id: string; kind: string; category: string; severity: string; status: string; location_text: string
  latitude: number | null; longitude: number | null; description: string; image_urls: string[]; anonymous: boolean
  shift_number: number | null; admin_note: string | null; handled_at: string | null; created_at: string
  reporter?: { name: string; sap_id: string } | null
}

const HEADER_FILL = 'FF164F99'
const STATUS_COLORS: Record<string, { fill: string; font: string; chart: string }> = {
  new: { fill: 'FFFFEB9C', font: 'FF9C5700', chart: 'F5A623' },
  in_review: { fill: 'FFDDEBF7', font: 'FF1F4E78', chart: '164F99' },
  resolved: { fill: 'FFC6EFCE', font: 'FF006100', chart: '19A66A' },
  rejected: { fill: 'FFEDEDED', font: 'FF595959', chart: '9AA7B8' },
}
const SEVERITY_COLORS: Record<string, { fill: string; font: string }> = {
  low: { fill: 'FFEDEDED', font: 'FF595959' }, medium: { fill: 'FFFFEB9C', font: 'FF9C5700' },
  high: { fill: 'FFFFD9B3', font: 'FF9C3A00' }, critical: { fill: 'FFFFC7CE', font: 'FF9C0006' },
}

function stamp(iso: string | null | undefined) {
  if (!iso) return ''
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

function colour(cell: ExcelJS.Cell, style: { fill: string; font: string } | undefined) {
  if (!style) return
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } }
  cell.font = { bold: true, color: { argb: style.font } }
}

export async function buildHazardWorkbook(rows: HazardRow[], scopeLabel: string, generatedAt = new Date()): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'HSE Safety'
  wb.created = generatedAt

  const summary = wb.addWorksheet('Хураангуй')
  summary.columns = [{ width: 34 }, { width: 14 }, { width: 3 }]
  summary.getCell('A1').value = `Аюулын мэдээллийн тайлан — ${scopeLabel}`
  summary.getCell('A1').font = { bold: true, size: 16, color: { argb: HEADER_FILL } }
  summary.mergeCells('A1:B1')
  const open = rows.filter(row => row.status === 'new' || row.status === 'in_review').length
  const urgent = rows.filter(row => (row.severity === 'high' || row.severity === 'critical') && (row.status === 'new' || row.status === 'in_review')).length
  ;[['Тайлан гаргасан', stamp(generatedAt.toISOString())], ['Нийт мэдээлэл', rows.length], ['Шийдвэрлэгдээгүй', open], ['Шийдвэрлэгдээгүй өндөр / маш ноцтой', urgent]]
    .forEach(([label, value]) => { const row = summary.addRow([label, value]); row.getCell(1).font = { bold: true } })

  const table = (title: string, entries: Array<[string, number]>) => {
    summary.addRow([])
    const head = summary.addRow([title, 'Тоо']); head.font = { bold: true }
    const first = summary.rowCount + 1
    entries.forEach(entry => summary.addRow(entry))
    return { first, last: summary.rowCount }
  }
  const statusEntries = HAZARD_STATUSES.map(s => [s.label, rows.filter(row => row.status === s.value).length] as [string, number])
  const statusRange = table('Төлөв', statusEntries)
  table('Ноцтой байдал', HAZARD_SEVERITIES.map(s => [s.label, rows.filter(row => row.severity === s.value).length] as [string, number]))
  const categoryEntries = HAZARD_CATEGORIES.map(c => [c.label, rows.filter(row => row.category === c.value).length] as [string, number])
  const categoryRange = table('Ангилал', categoryEntries)

  const sheet = wb.addWorksheet('Бүх мэдээлэл')
  sheet.columns = [8, 17, 22, 28, 13, 30, 14, 52, 24, 14, 16, 40, 17, 40].map(width => ({ width }))
  const head = sheet.addRow(['№', 'Огноо', 'Төрөл', 'Ангилал', 'Ноцтой байдал', 'Байршил', 'Газрын зураг', 'Тайлбар', 'Илгээгч', 'Ээлж', 'Төлөв', 'HSE-ийн тайлбар', 'Шийдвэрлэсэн', 'Зураг'])
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  head.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  head.height = 28
  head.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } } })
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  rows.forEach((item, index) => {
    const link = mapsUrl(item.latitude, item.longitude)
    const row = sheet.addRow([
      index + 1, stamp(item.created_at), kindLabel(item.kind), categoryLabel(item.category), severityLabel(item.severity), item.location_text,
      link ? { text: 'Газрын зураг', hyperlink: link } : '', item.description,
      item.anonymous ? 'Нууц' : (item.reporter ? `${item.reporter.name} (${item.reporter.sap_id})` : '—'), item.shift_number ? shiftLabel(item.shift_number) : '—',
      statusLabel(item.status), item.admin_note ?? '', stamp(item.handled_at), item.image_urls.join('\n'),
    ])
    row.alignment = { vertical: 'top', wrapText: true }
    colour(row.getCell(5), SEVERITY_COLORS[item.severity])
    colour(row.getCell(11), STATUS_COLORS[item.status])
  })
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 14 } }

  const raw = await wb.xlsx.writeBuffer()
  const charts: ChartSpec[] = [
    {
      type: 'pie', title: 'Төлөвийн харьцаа', seriesName: 'Тоо', sheet: 'Хураангуй',
      categoryRange: `$A$${statusRange.first}:$A$${statusRange.last}`, valueRange: `$B$${statusRange.first}:$B$${statusRange.last}`,
      categories: statusEntries.map(entry => entry[0]), values: statusEntries.map(entry => entry[1]),
      colors: HAZARD_STATUSES.map(s => STATUS_COLORS[s.value].chart), anchor: { col: 3, row: 1, cols: 8, rows: 16 },
    },
    {
      type: 'bar', title: 'Ангиллаар', seriesName: 'Тоо', sheet: 'Хураангуй',
      categoryRange: `$A$${categoryRange.first}:$A$${categoryRange.last}`, valueRange: `$B$${categoryRange.first}:$B$${categoryRange.last}`,
      categories: categoryEntries.map(entry => entry[0]), values: categoryEntries.map(entry => entry[1]),
      colors: ['164F99'], anchor: { col: 3, row: 18, cols: 10, rows: 18 },
    },
  ]
  return addChartsToWorkbook(Buffer.from(raw as ArrayBuffer), 'Хураангуй', charts)
}
