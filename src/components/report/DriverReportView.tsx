'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { shiftLabel } from '@/lib/shifts'
import { STATUS_LABELS, overrideReasonLabel } from '@/lib/training'
import { PROGRESS_LABELS } from '@/lib/game-analytics'
import { TREND_LABELS, type DriverReport, type Trend } from '@/lib/driver-report'

export type DriverReportData = {
  user: { id: string; sap_id: string; name: string; shift_number: number | null; department: string | null; total_score: number }
  rank: number | null; shift_rank: number | null; total_drivers: number; shift_drivers: number
  report: DriverReport
}

const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat('mn-MN', { timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso)) : '—')
const signed = (value: number) => (value > 0 ? `+${value}` : String(value))
const trendClass = (trend: Trend) => (trend === 'improved' ? 'positive' : trend === 'declined' ? 'negative' : '')

function PercentChart({ points }: { points: Array<{ label: string; value: number }> }) {
  if (points.length < 2) return <div className="empty-mini">Графикт хамгийн багадаа 2 асуумж хэрэгтэй.</div>
  const w = 640, h = 210, pad = { l: 34, r: 16, t: 14, b: 28 }
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (w - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - v / 100) * (h - pad.t - pad.b)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  return <svg viewBox={`0 0 ${w} ${h}`} className="ga-chart" role="img" aria-label="Асуумж бүрийн зөв хариултын хувь">
    {[0, 50, 100].map(v => <g key={v}><line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="#dce4ef" /><text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#67748a">{v}%</text></g>)}
    <path d={line} fill="none" stroke="#164f99" strokeWidth="3" strokeLinejoin="round" />
    {points.map((p, i) => <g key={i}><circle cx={x(i)} cy={y(p.value)} r="5" fill={i === points.length - 1 ? '#f15a24' : '#164f99'} /><text x={x(i)} y={y(p.value) - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="#162033">{p.value}%</text><text x={x(i)} y={h - 8} textAnchor="middle" fontSize="10" fill="#67748a">{p.label}</text></g>)}
  </svg>
}


function encouragement(report: DriverReport): string {
  const q = report.quizSummary, g = report.gameSummary
  if (q.count === 0 && g.plays === 0) return 'Асуумж өгч, тоглоом тоглосноор хөгжлөө эндээс харна.'
  if (report.overall === 'improved') return `Сайн байна! ${q.change !== null && q.change > 0 ? `Асуумжийн зөв хариулт ${q.change} оноогоор өссөн. ` : ''}${g.improved > 0 ? `${g.improved} тоглоом дээр сайжирсан. ` : ''}Ингэж үргэлжлүүлээрэй.`
  if (report.overall === 'declined') return 'Сүүлийн үр дүн өмнөхөөсөө бага байна. Доорх «Алдсан асуултууд»-ыг давтаж үзээд дахин оролдоорой.'
  if (report.overall === 'stable') return 'Үр дүн тогтвортой байна. Алдсан асуултуудаа давтаад дараагийн шатанд гараарай.'
  return 'Одоогоор харьцуулах өгөгдөл цөөн байна. Өдөр бүрийн асуумж, тоглоомоо тогтмол өгч хөгжлөө хараарай.'
}

export default function DriverReportView({ data, mode, userId }: { data: DriverReportData; mode: 'admin' | 'driver'; userId: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const id = userId
  const { report, user: driver } = data
  const q = report.quizSummary, g = report.gameSummary

  return <div className={`app-container ${mode === 'admin' ? 'admin-page ' : ''}page-enter driver-report`}>
    <div className="page-heading-row">
      <div><span className="eyebrow">{mode === 'admin' ? 'ХУВЬ ХҮНИЙ ХӨГЖЛИЙН ТАЙЛАН' : 'МИНИЙ ХӨГЖИЛ'}</span><h1>{driver.name}</h1>
        <p>SAP {driver.sap_id} · {shiftLabel(driver.shift_number)}{driver.department ? ` · ${driver.department}` : ''} · {driver.total_score.toLocaleString()} оноо{data.rank ? ` · нийт ${data.rank}/${data.total_drivers}` : ''}{data.shift_rank ? ` · ээлжид ${data.shift_rank}/${data.shift_drivers}` : ''}</p></div>
      <div className="list-actions no-print"><Link href={mode === 'admin' ? '/admin/my-shift' : '/profile'} className="btn-secondary">Буцах</Link><button className="btn-secondary" onClick={() => window.print()}>Хэвлэх / PDF</button><a className="btn-primary" href={`/api/drivers/${id}/export`}>Excel татах</a></div>
    </div>

    <div className="kpi-grid">
      <div className={trendClass(report.overall)}><span>Ерөнхий дүгнэлт</span><strong>{TREND_LABELS[report.overall]}</strong></div>
      <div><span>Асуумж өгсөн</span><strong>{q.count}</strong><small>{q.attemptsTotal} оролдлого · {q.retakes} дахин</small></div>
      <div><span>Дундаж зөв хариулт</span><strong>{q.count ? `${q.avgPercent}%` : '—'}</strong></div>
      <div className={q.change === null ? '' : q.change >= 0 ? 'positive' : 'negative'}><span>Эхнээс сүүлд хүртэл</span><strong>{q.change === null ? '—' : `${signed(q.change)} оноо`}</strong><small>{q.firstPercent !== null && q.change !== null ? `${q.firstPercent}% → ${q.latestPercent}%` : ''}</small></div>
    </div>

    {mode === 'driver' && <section className="card dashboard-card encourage" style={{ marginTop: 14 }}><strong>{encouragement(report)}</strong></section>}

    <section className="card dashboard-card" style={{ marginTop: 14 }}>
      <div className="section-heading"><div><span className="eyebrow">АСУУМЖ</span><h2>Зөв хариултын хувь, асуумж бүрээр</h2></div></div>
      <PercentChart points={report.quizzes.map(entry => ({ label: entry.date.slice(5).replace('-', '/'), value: entry.final.percent }))} />
      <p className="hint-text">Хувь нь зөв хариултын тоог асуултын тоонд харьцуулсан (хариулах хурдаас хамаарахгүй). Дахин өгсөн шалгалтад тэнцсэн, эс бөгөөс хамгийн өндөр оролдлогыг авсан. Админ засварласан хариултыг зөв гэж тооцсон.</p>
    </section>

    <section className="card dashboard-card" style={{ marginTop: 14 }}>
      <div className="section-heading"><div><span className="eyebrow">ТҮҮХ</span><h2>Асуумжийн дэлгэрэнгүй</h2></div></div>
      {report.quizzes.length === 0 ? <div className="empty-mini">Асуумж өгөөгүй байна.</div> : <div className="res-table-wrap"><table className="res-table"><thead><tr><th>Өдөр</th><th>Асуумж</th><th>Төлөв</th><th>Оролдлого</th><th>Зөв / буруу</th><th>Хувь</th><th className="no-print"></th></tr></thead><tbody>
        {report.quizzes.map(entry => <Fragment key={entry.quiz_id}>
          <tr>
            <td>{entry.date}</td><td><strong>{entry.title}</strong>{entry.topic && <small style={{ display: 'block', color: 'var(--muted)' }}>{entry.topic}</small>}</td>
            <td><span className={`st-pill st-${entry.status}`}>{STATUS_LABELS[entry.status]}</span></td>
            <td>{entry.attempts.map(a => `${a.number}-р: ${a.percent}%`).join(' → ')}</td><td>{entry.final.correct} / {entry.final.wrong}</td><td><strong>{entry.final.percent}%</strong></td>
            <td className="no-print"><button className="text-button" onClick={() => setOpen(open === entry.quiz_id ? null : entry.quiz_id)}>{open === entry.quiz_id ? 'Хаах' : 'Хариулт'}</button></td></tr>
          {open === entry.quiz_id && <tr><td colSpan={7}>{entry.answers.map((answer, i) => <div key={answer.question_id} className={`answer-row ${answer.correct ? 'ok' : 'no'}`}>
            <h4>{i + 1}. {answer.text}{answer.overridden && <span className="override-badge">Админ засав: {overrideReasonLabel(answer.override_reason)}</span>}</h4>
            <div className="answer-opts">{answer.options.map((option, oi) => <div key={oi} className={`${oi === answer.correct_index ? 'is-correct' : ''} ${answer.selected_index === oi ? 'is-picked' : ''}`}>{String.fromCharCode(65 + oi)}. {option}{answer.selected_index === oi && ' ← сонгосон'}{oi === answer.correct_index && ' ✓ зөв'}</div>)}{answer.selected_index === null && <div>Хариулаагүй</div>}</div></div>)}</td></tr>}
        </Fragment>)}</tbody></table></div>}
    </section>

    {report.topics.length > 0 && <section className="card dashboard-card" style={{ marginTop: 14 }}>
      <div className="section-heading"><div><span className="eyebrow">СЭДЭВ</span><h2>Сэдвээр зөв хариултын хувь</h2></div></div>
      <div className="q-bars">{report.topics.map(topic => <div key={topic.topic} className={`q-bar ${topic.percent < 60 ? 'low' : ''}`}><span>{topic.topic} — <strong>{topic.percent}%</strong> ({topic.correct}/{topic.answered})</span><div className="track"><i style={{ width: `${topic.percent}%` }} /></div></div>)}</div>
    </section>}

    <section className="card dashboard-card" style={{ marginTop: 14 }}>
      <div className="section-heading"><div><span className="eyebrow">ДУТУУ ТАЛ</span><h2>Алдсан асуултууд ({report.weakQuestions.length})</h2></div></div>
      {report.weakQuestions.length === 0 ? <div className="empty-mini">{q.count ? 'Сүүлийн оролдлогуудад алдсан асуулт алга.' : 'Өгөгдөл алга.'}</div> : report.weakQuestions.map(item => <div className="answer-row no" key={`${item.quiz_id}-${item.question_id}`}>
        <h4>{item.text}</h4>{item.correct_text ? <div className="answer-opts"><div className="is-picked">Сонгосон: {item.chosen_text}</div><div className="is-correct">Зөв хариулт: {item.correct_text}</div></div> : <p className="hint-text" style={{ margin: 0 }}>Дахин оролдох боломжтой тул зөв хариултыг нуусан. Сургалтын материалаа давтаарай.</p>}<small style={{ color: 'var(--muted)' }}>{item.quiz_title}</small></div>)}
    </section>

    <section className="card dashboard-card" style={{ marginTop: 14 }}>
      <div className="section-heading"><div><span className="eyebrow">ТОГЛООМ</span><h2>{g.totalScore.toLocaleString()} оноо · {g.plays} тоглолт · {g.games} тоглоом</h2></div></div>
      {report.games.length === 0 ? <div className="empty-mini">Тоглоом тоглоогүй байна.</div> : <div className="res-table-wrap"><table className="res-table"><thead><tr><th>Тоглоом</th><th>Тоглолт</th><th>Эхний</th><th>Сүүлийн</th><th>Шилдэг</th><th>Дундаж</th><th>Өөрчлөлт</th><th>Төлөв</th></tr></thead><tbody>
        {report.games.map(game => <tr key={game.game_id}><td><strong>{game.title}</strong><small style={{ display: 'block', color: 'var(--muted)' }}>{game.history.map(p => p.score).join(' → ')}</small></td><td>{game.plays}</td><td>{game.first}</td><td>{game.latest}</td><td>{game.best}</td><td>{game.average}</td>
          <td className={game.status === 'improved' ? 'ga-up' : game.status === 'declined' ? 'ga-down' : ''}>{game.plays > 1 ? `${signed(game.change)} (${signed(game.changePercent)}%)` : '—'}</td><td><span className={`st-pill ga-${game.status}`}>{PROGRESS_LABELS[game.status]}</span></td></tr>)}</tbody></table></div>}
    </section>
  </div>
}
