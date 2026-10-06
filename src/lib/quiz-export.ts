import ExcelJS from 'exceljs'
import type { QuizResults, ParticipantRow, AnswerDetail } from '@/lib/quiz-results'
import { STATUS_LABELS, effectiveCorrect, overrideReasonLabel, type ParticipantStatus } from '@/lib/training'
import { shiftLabel, shiftLabelShort } from '@/lib/shifts'
import { addChartsToWorkbook, type ChartSpec } from '@/lib/xlsx-charts'

const HEADER_FILL = 'FF164F99'
const STATUS_STYLE: Record<ParticipantStatus, { fill: string; font: string; chart: string }> = {
  passed: { fill: 'FFC6EFCE', font: 'FF006100', chart: '19A66A' },
  completed: { fill: 'FFC6EFCE', font: 'FF006100', chart: '19A66A' },
  failed: { fill: 'FFFFEB9C', font: 'FF9C5700', chart: 'F5A623' },
  locked: { fill: 'FFFFC7CE', font: 'FF9C0006', chart: 'DC3E45' },
  in_progress: { fill: 'FFDDEBF7', font: 'FF1F4E78', chart: '164F99' },
  not_started: { fill: 'FFEDEDED', font: 'FF595959', chart: '9AA7B8' },
}

function stamp(iso: string | null | undefined) {
  if (!iso) return ''
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  row.height = 26
  row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } } })
}

function statusCell(cell: ExcelJS.Cell, status: ParticipantStatus) {
  const style = STATUS_STYLE[status]
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } }
  cell.font = { bold: true, color: { argb: style.font } }
}

function letter(index: number | null | undefined) {
  return index === null || index === undefined ? '—' : String.fromCharCode(65 + index)
}

function finalAnswers(results: QuizResults, row: ParticipantRow) {
  const byQuestion = new Map<string, AnswerDetail>()
  if (!row.final) return byQuestion
  for (const answer of results.answers) if (answer.attempt_id === row.final.id) byQuestion.set(answer.question_id, answer)
  return byQuestion
}

export async function buildQuizWorkbook(results: QuizResults, generatedAt = new Date()): Promise<Buffer> {
  const { quiz, rows, counts, questionStats, training } = results
  const questions = quiz.questions
  const wb = new ExcelJS.Workbook()
  wb.creator = 'HSE Safety'
  wb.created = generatedAt

  // ---- Summary -------------------------------------------------------------
  const summary = wb.addWorksheet('Хураангуй')
  summary.columns = [{ width: 30 }, { width: 46 }, { width: 12 }, { width: 12 }, { width: 20 }, { width: 3 }]
  summary.getCell('A1').value = quiz.title
  summary.getCell('A1').font = { bold: true, size: 16, color: { argb: HEADER_FILL } }
  summary.mergeCells('A1:E1')
  const info: Array<[string, string | number]> = [
    ['Сэдэв', quiz.topic || '—'],
    ['Огноо', quiz.active_date],
    ['Зорилтот ээлж', quiz.target_shift ? shiftLabel(quiz.target_shift) : 'Бүх ээлж'],
    ['Тэнцэх хувь', training ? `${quiz.pass_percent}%` : 'Тэнцэх босгогүй'],
    ['Оролдлогын тоо', training ? quiz.max_attempts : 1],
    ['Ирцээр бүртгэсэн', counts.roster],
    ['Тайлан гаргасан', stamp(generatedAt.toISOString())],
  ]
  info.forEach(([label, value], i) => {
    const row = summary.getRow(3 + i)
    row.getCell(1).value = label
    row.getCell(1).font = { bold: true }
    row.getCell(2).value = value
    row.getCell(2).alignment = { horizontal: 'left' }
  })

  const statusOrder: ParticipantStatus[] = training ? ['passed', 'failed', 'locked', 'in_progress', 'not_started'] : ['completed', 'in_progress', 'not_started']
  const statusHeaderRow = 3 + info.length + 1
  styleHeader(summary.getRow(statusHeaderRow))
  summary.getRow(statusHeaderRow).values = ['Төлөв', '', 'Тоо', 'Хувь']
  styleHeader(summary.getRow(statusHeaderRow))
  statusOrder.forEach((status, i) => {
    const row = summary.getRow(statusHeaderRow + 1 + i)
    row.getCell(1).value = STATUS_LABELS[status]
    statusCell(row.getCell(1), status)
    row.getCell(3).value = counts[status]
    row.getCell(4).value = counts.participants ? Math.round((counts[status] / counts.participants) * 1000) / 10 : 0
    row.getCell(4).numFmt = '0.0"%"'
  })
  const statusFirst = statusHeaderRow + 1
  const statusLast = statusHeaderRow + statusOrder.length
  const totalRow = summary.getRow(statusLast + 1)
  totalRow.getCell(1).value = 'Нийт'
  totalRow.getCell(1).font = { bold: true }
  totalRow.getCell(3).value = counts.participants
  totalRow.getCell(3).font = { bold: true }
  if (training) {
    const decided = counts.passed + counts.failed + counts.locked
    const rateRow = summary.getRow(statusLast + 2)
    rateRow.getCell(1).value = 'Тэнцсэн хувь (шалгалт өгсөн дундаас)'
    rateRow.getCell(1).font = { bold: true }
    rateRow.getCell(3).value = decided ? Math.round((counts.passed / decided) * 1000) / 10 : 0
    rateRow.getCell(3).numFmt = '0.0"%"'
  }

  const questionHeaderRow = statusLast + (training ? 4 : 3)
  summary.getRow(questionHeaderRow).values = ['Асуулт', 'Асуултын текст', 'Зөв', 'Буруу', 'Зөв хариултын %']
  styleHeader(summary.getRow(questionHeaderRow))
  questionStats.forEach((stat, i) => {
    const row = summary.getRow(questionHeaderRow + 1 + i)
    row.getCell(1).value = `Асуулт ${i + 1}`
    row.getCell(2).value = stat.text
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' }
    row.getCell(3).value = stat.correct
    row.getCell(4).value = stat.wrong
    row.getCell(5).value = stat.percent
    row.getCell(5).numFmt = '0"%"'
  })
  const qFirst = questionHeaderRow + 1
  const qLast = questionHeaderRow + questionStats.length

  // ---- Passed list ---------------------------------------------------------
  const passedStatus: ParticipantStatus = training ? 'passed' : 'completed'
  const passedSheet = wb.addWorksheet(training ? 'Тэнцсэн хүмүүс' : 'Өгсөн хүмүүс')
  passedSheet.columns = [{ width: 6 }, { width: 12 }, { width: 30 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 20 }]
  passedSheet.getRow(1).values = ['№', 'SAP', 'Овог нэр', 'Ээлж', 'Оролдлого', 'Үр дүн %', 'Дууссан огноо']
  styleHeader(passedSheet.getRow(1))
  rows.filter(row => row.status === passedStatus).forEach((row, i) => {
    passedSheet.addRow([i + 1, row.user.sap_id, row.user.name, shiftLabelShort(row.user.shift_number), `${row.final?.attempt_number ?? row.attempts_used}-р`, row.final?.percent ?? 0, stamp(row.final?.completed_at)])
  })
  passedSheet.views = [{ state: 'frozen', ySplit: 1 }]

  // ---- All participants ----------------------------------------------------
  const people = wb.addWorksheet('Оролцогчид')
  people.columns = [{ width: 6 }, { width: 12 }, { width: 30 }, { width: 14 }, { width: 14 }, { width: 32 }, { width: 14 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 20 }, { width: 14 }]
  people.getRow(1).values = ['№', 'SAP', 'Овог нэр', 'Ээлж', 'Ирцэд бүртгэлтэй', 'Төлөв', 'Оролдлого', 'Үр дүн %', 'Зөв', 'Буруу', 'Оноо', 'Дууссан огноо', 'Admin засвар']
  styleHeader(people.getRow(1))
  rows.forEach((row, i) => {
    const added = people.addRow([
      i + 1, row.user.sap_id, row.user.name, shiftLabelShort(row.user.shift_number), row.in_roster ? 'Тийм' : 'Үгүй', STATUS_LABELS[row.status],
      `${row.attempts_used}/${row.attempts_allowed}`, row.final?.percent ?? '', row.final?.correct_count ?? '', row.final?.wrong_count ?? '', row.final?.score ?? '',
      stamp(row.final?.completed_at), row.attempts.some(attempt => attempt.overridden > 0) ? 'Тийм' : '',
    ])
    statusCell(added.getCell(6), row.status)
  })
  people.views = [{ state: 'frozen', ySplit: 1 }]
  people.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + rows.length, column: 13 } }

  // ---- Answer matrix -------------------------------------------------------
  const matrix = wb.addWorksheet('Хариултын матриц')
  const fixed = 4
  matrix.columns = [{ width: 12 }, { width: 28 }, { width: 14 }, { width: 14 }, ...questions.map(() => ({ width: 11 })), { width: 8 }, { width: 8 }, { width: 10 }, { width: 22 }]
  matrix.getRow(1).values = ['SAP', 'Овог нэр', 'Ээлж', 'Оролдлого', ...questions.map((_, i) => `Асуулт ${i + 1}`), 'Зөв', 'Буруу', 'Үр дүн %', 'Төлөв']
  styleHeader(matrix.getRow(1))
  for (const row of rows) {
    const answers = finalAnswers(results, row)
    const cells: Array<string | number> = [row.user.sap_id, row.user.name, shiftLabelShort(row.user.shift_number), row.final ? `${row.final.attempt_number}-р` : '—']
    questions.forEach(question => {
      const answer = answers.get(question.id)
      cells.push(answer ? `${letter(answer.selected_index)}${answer.override_correct !== null ? '*' : ''}` : '—')
    })
    cells.push(row.final?.correct_count ?? '', row.final?.wrong_count ?? '', row.final?.percent ?? '', STATUS_LABELS[row.status])
    const added = matrix.addRow(cells)
    questions.forEach((question, i) => {
      const answer = answers.get(question.id)
      const cell = added.getCell(fixed + 1 + i)
      cell.alignment = { horizontal: 'center' }
      if (!answer) return
      const ok = effectiveCorrect(answer)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ok ? 'FFC6EFCE' : 'FFFFC7CE' } }
      cell.font = { bold: true, color: { argb: ok ? 'FF006100' : 'FF9C0006' } }
    })
    statusCell(added.getCell(fixed + questions.length + 4), row.status)
  }
  const legendRow = matrix.rowCount + 2
  matrix.getCell(legendRow, 1).value = 'Тайлбар: ногоон = зөв, улаан = буруу, * = admin засварласан, — = хариулаагүй. Үсэг нь сонгосон хувилбар (A/B/C). Асуултын дугаарыг "Асуултууд" хуудаснаас харна.'
  matrix.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }]

  // ---- Every attempt, long format -----------------------------------------
  const detail = wb.addWorksheet('Бүх оролдлого')
  detail.columns = [{ width: 18 }, { width: 12 }, { width: 28 }, { width: 14 }, { width: 11 }, { width: 10 }, { width: 50 }, { width: 28 }, { width: 28 }, { width: 11 }, { width: 14 }, { width: 14 }, { width: 30 }, { width: 12 }]
  detail.getRow(1).values = ['Эхэлсэн огноо', 'SAP', 'Овог нэр', 'Ээлж', 'Оролдлого', 'Асуулт', 'Асуултын текст', 'Сонгосон хариулт', 'Зөв хариулт', 'Үр дүн', 'Анхны үр дүн', 'Admin засвар', 'Засварын шалтгаан', 'Хугацаа (сек)']
  styleHeader(detail.getRow(1))
  for (const row of rows) {
    for (const attempt of row.attempts) {
      questions.forEach((question, i) => {
        const answer = results.answers.find(item => item.attempt_id === attempt.id && item.question_id === question.id)
        if (!answer && !attempt.completed) return
        const ok = answer ? effectiveCorrect(answer) : false
        const added = detail.addRow([
          stamp(attempt.started_at), row.user.sap_id, row.user.name, shiftLabelShort(row.user.shift_number), attempt.attempt_number, i + 1, question.text,
          answer ? (answer.selected_index === null ? 'Хугацаа дууссан' : `${letter(answer.selected_index)}. ${question.options[answer.selected_index]?.text ?? ''}`) : 'Хариулаагүй',
          `${letter(question.correct_index)}. ${question.options[question.correct_index]?.text ?? ''}`,
          answer ? (ok ? 'Зөв' : 'Буруу') : 'Буруу',
          answer ? (answer.is_correct ? 'Зөв' : 'Буруу') : '',
          answer && answer.override_correct !== null ? 'Тийм' : '',
          answer ? overrideReasonLabel(answer.override_reason) : '',
          answer ? Math.round(answer.response_ms / 100) / 10 : '',
        ])
        const result = added.getCell(10)
        result.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ok ? 'FFC6EFCE' : 'FFFFC7CE' } }
        result.font = { bold: true, color: { argb: ok ? 'FF006100' : 'FF9C0006' } }
      })
    }
  }
  detail.views = [{ state: 'frozen', ySplit: 1 }]
  detail.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, detail.rowCount), column: 14 } }

  // ---- Questions reference -------------------------------------------------
  const reference = wb.addWorksheet('Асуултууд')
  reference.columns = [{ width: 10 }, { width: 60 }, { width: 28 }, { width: 28 }, { width: 28 }, { width: 14 }, { width: 40 }]
  reference.getRow(1).values = ['Асуулт', 'Асуултын текст', 'A', 'B', 'C', 'Зөв хариулт', 'Тайлбар']
  styleHeader(reference.getRow(1))
  questions.forEach((question, i) => {
    reference.addRow([`Асуулт ${i + 1}`, question.text, question.options[0]?.text, question.options[1]?.text, question.options[2]?.text, letter(question.correct_index), question.explanation ?? ''])
  })
  reference.eachRow((row, number) => { if (number > 1) row.alignment = { wrapText: true, vertical: 'top' } })

  const raw = await wb.xlsx.writeBuffer()
  const charts: ChartSpec[] = [
    {
      type: 'pie', title: 'Төлөвийн харьцаа', seriesName: 'Тоо', sheet: 'Хураангуй',
      categoryRange: `$A$${statusFirst}:$A$${statusLast}`, valueRange: `$C$${statusFirst}:$C$${statusLast}`,
      categories: statusOrder.map(status => STATUS_LABELS[status]), values: statusOrder.map(status => counts[status]),
      colors: statusOrder.map(status => STATUS_STYLE[status].chart),
      anchor: { col: 6, row: 1, cols: 8, rows: 17 },
    },
  ]
  if (questions.length > 0) {
    charts.push({
      type: 'bar', title: 'Асуулт бүрийн зөв хариултын хувь (%)', seriesName: 'Зөв хариултын %', sheet: 'Хураангуй',
      categoryRange: `$A$${qFirst}:$A$${qLast}`, valueRange: `$E$${qFirst}:$E$${qLast}`,
      categories: questionStats.map((_, i) => `Асуулт ${i + 1}`), values: questionStats.map(stat => stat.percent),
      colors: ['164F99'], percentAxis: true,
      anchor: { col: 6, row: 20, cols: Math.max(8, Math.min(18, questions.length + 4)), rows: 18 },
    })
  }
  return addChartsToWorkbook(Buffer.from(raw as ArrayBuffer), 'Хураангуй', charts)
}
