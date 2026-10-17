'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { SHIFT_NUMBERS, shiftLabel } from '@/lib/shifts'
import { OVERRIDE_REASONS, STATUS_LABELS, overrideReasonLabel, type ParticipantStatus } from '@/lib/training'
import { EXPORT_FILTERS, filterResults, type ExportExtras, type ExportFilter } from '@/lib/quiz-filter'
import type { DailyQuizQuestion } from '@/types'

type AttemptDetail = { id: string; attempt_number: number; completed: boolean; passed: boolean | null; percent: number; correct_count: number; wrong_count: number; score: number; started_at: string; completed_at: string | null; overridden: number }
type Row = { user: { id: string; sap_id: string; name: string; shift_number: number | null }; in_roster: boolean; bonus: number; status: ParticipantStatus; attempts_used: number; attempts_allowed: number; final: AttemptDetail | null; attempts: AttemptDetail[] }
type Answer = { attempt_id: string; question_id: string; selected_index: number | null; is_correct: boolean; override_correct: boolean | null; override_reason: string | null; response_ms: number }
type Results = {
  quiz: { id: string; title: string; topic: string | null; active_date: string; target_shift: number | null; pass_percent: number | null; max_attempts: number; questions: DailyQuizQuestion[] }
  training: boolean
  rows: Row[]
  counts: Record<ParticipantStatus, number> & { roster: number; participants: number }
  questionStats: Array<{ id: string; text: string; correct: number; wrong: number; percent: number }>
  answers?: Answer[]
}

const FILTERS: Array<{ key: 'all' | ParticipantStatus; label: string }> = [
  { key: 'all', label: 'Бүгд' }, { key: 'passed', label: 'Тэнцсэн' }, { key: 'failed', label: 'Тэнцээгүй' },
  { key: 'locked', label: 'Түгжигдсэн' }, { key: 'in_progress', label: 'Бөглөж байгаа' }, { key: 'not_started', label: 'Өгөөгүй' },
]

function StatusPill({ status }: { status: ParticipantStatus }) { return <span className={`st-pill st-${status}`}>{STATUS_LABELS[status]}</span> }

export default function QuizResults({ id, embedded = false }: { id: string; embedded?: boolean }) {
  const [results, setResults] = useState<Results | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | ParticipantStatus>('all')
  const [search, setSearch] = useState('')
  const [openUser, setOpenUser] = useState<string | null>(null)
  const [detail, setDetail] = useState<Results | null>(null)
  const [attemptNo, setAttemptNo] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [exportFilter, setExportFilter] = useState<ExportFilter>('all')
  const [showPeople, setShowPeople] = useState(false)

  const load = useCallback(() => {
    fetch(`/api/quizzes/${id}/results`).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); setResults(data.data) }).catch(err => setError(err.message))
  }, [id])
  const loadDetail = useCallback((userId: string) => {
    fetch(`/api/quizzes/${id}/results?user_id=${userId}`).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); setDetail(data.data) }).catch(err => setError(err.message))
  }, [id])

  useEffect(() => { load() }, [load])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (results?.rows ?? []).filter(row => (filter === 'all' || row.status === filter) && (!needle || row.user.name.toLowerCase().includes(needle) || row.user.sap_id.includes(needle)))
  }, [results, filter, search])

  if (error && !results) return <div className="empty-state card"><h2>Үр дүн нээж чадсангүй</h2><p>{error}</p></div>
  if (!results) return <div className="empty-state"><span className="spinner" />Үр дүн ачааллаж байна...</div>

  const { quiz, training, counts } = results
  const passedRows = results.rows.filter(row => row.status === 'passed')
  const submittedRows = results.rows.filter(row => row.attempts.some(attempt => attempt.completed))
  const nameList = training ? passedRows : submittedRows
  const selected = results.rows.find(row => row.user.id === openUser) ?? null

  function openDetails(row: Row) {
    setOpenUser(row.user.id); setDetail(null)
    const last = row.attempts[row.attempts.length - 1]
    setAttemptNo(row.final?.attempt_number ?? last?.attempt_number ?? null)
    loadDetail(row.user.id)
  }

  async function overrideAnswer(attemptId: string, questionId: string, correct: boolean | null, reason: string) {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/quiz-attempts/override', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attempt_id: attemptId, question_id: questionId, correct, reason }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      load(); if (openUser) loadDetail(openUser)
    } catch (err) { setError(err instanceof Error ? err.message : 'Засаж чадсангүй') } finally { setBusy(false) }
  }

  async function grantAttempts(userId: string) {
    if (!confirm(`Энэ хүнд ${quiz.max_attempts} оролдлого нэмж өгөх үү?`)) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/quizzes/${id}/attendees`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'grant', user_id: userId }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Оролдлого нэмж чадсангүй') } finally { setBusy(false) }
  }

  const attemptAnswers = (attemptId: string) => (detail?.answers ?? []).filter(answer => answer.attempt_id === attemptId)
  const currentAttempt = selected?.attempts.find(attempt => attempt.attempt_number === attemptNo) ?? null

  return <div className={embedded ? 'results-embedded' : 'app-container admin-page page-enter'}>
    {embedded ? <div className="detail-head"><p className="hint-text">{training ? `Тэнцэх ${quiz.pass_percent}% · ${quiz.max_attempts} оролдлого` : 'Асуумжийн үр дүн'} — хүн дарж хариултыг нь засна.</p><ExportControl id={id} results={results} training={training} value={exportFilter} onChange={setExportFilter} /></div> :
    <div className="page-heading-row"><div><span className="eyebrow">{training ? 'СУРГАЛТЫН ДАРААХ ШАЛГАЛТ' : 'АСУУМЖИЙН ҮР ДҮН'}</span><h1>{quiz.title}</h1><p>{quiz.active_date} · {quiz.target_shift ? shiftLabel(quiz.target_shift) : 'Бүх ээлж'}{training && ` · тэнцэх ${quiz.pass_percent}% · ${quiz.max_attempts} оролдлого`}</p></div>
      <div className="list-actions"><Link className="btn-secondary" href="/admin/quizzes">Жагсаалт</Link><ExportControl id={id} results={results} training={training} value={exportFilter} onChange={setExportFilter} /></div></div>}
    {error && <div className="form-error">{error}</div>}

    <div className="res-kpis">
      {training && <div className="res-kpi"><small>Ирц</small><strong>{counts.roster || counts.participants}</strong></div>}
      {training ? <>
        <div className="res-kpi good"><small>Тэнцсэн</small><strong>{counts.passed}</strong></div>
        <div className="res-kpi warn"><small>Тэнцээгүй</small><strong>{counts.failed}</strong></div>
        <div className="res-kpi bad"><small>Түгжигдсэн</small><strong>{counts.locked}</strong></div>
        <div className="res-kpi"><small>Өгөөгүй</small><strong>{counts.not_started + counts.in_progress}</strong></div>
      </> : <>
        <div className="res-kpi"><small>Оролцогч</small><strong>{counts.participants}</strong></div>
        <div className="res-kpi good"><small>Өгсөн</small><strong>{counts.completed}</strong></div>
        <div className="res-kpi"><small>Өгөөгүй</small><strong>{counts.not_started + counts.in_progress}</strong></div>
      </>}
    </div>

    <NameList title={training ? 'Тэнцсэн хүмүүс' : 'Шалгалт өгсөн хүмүүс'} viewLabel={training ? 'Тэнцсэн хүмүүсийг харах' : 'Шалгалт өгсөн хүмүүсийг харах'} rows={nameList} />

    <section className="card res-section">
      <div className="people-head"><h2>Оролцогчид <span className="name-count neutral">{results.rows.length}</span></h2>
        <button type="button" className={showPeople ? 'btn-secondary' : 'btn-primary'} aria-expanded={showPeople} onClick={() => setShowPeople(value => !value)}>{showPeople ? 'Жагсаалтыг нуух' : 'Оролцогчдыг харах'}</button></div>
      {showPeople && <>
      <div className="res-filters">{FILTERS.filter(item => training || !['failed', 'locked'].includes(item.key)).map(item => <button key={item.key} className={filter === item.key ? 'on' : ''} onClick={() => setFilter(item.key)}>{item.label}</button>)}</div>
      <input className="input-field" placeholder="Нэр эсвэл SAP хайх" value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 12 }} />
      <div className="res-table-wrap"><table className="res-table"><thead><tr><th>Нэр</th><th>SAP</th><th>Ээлж</th><th>Төлөв</th><th>Оролдлого</th><th>Зөв / алдсан</th><th>Хувь</th></tr></thead>
        <tbody>{rows.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>Хүн олдсонгүй</td></tr> : rows.map(row => <tr key={row.user.id} className="clickable" onClick={() => openDetails(row)}>
          <td><strong>{row.user.name}</strong></td><td>{row.user.sap_id}</td><td>{shiftLabel(row.user.shift_number)}</td><td><StatusPill status={row.status} /></td>
          <td>{row.attempts_used}/{row.attempts_allowed}</td><td>{row.final ? `${row.final.correct_count} / ${row.final.wrong_count}` : '—'}</td><td>{row.final ? `${row.final.percent}%` : '—'}</td></tr>)}</tbody></table></div>
      </>}
    </section>

    {selected && <section className="card res-section">
      <div className="detail-head"><div><h2>{selected.user.name}</h2><p className="hint-text">SAP {selected.user.sap_id} · {shiftLabel(selected.user.shift_number)} · <StatusPill status={selected.status} /></p></div>
        <div className="list-actions">{training && selected.status === 'locked' && <button className="btn-primary" disabled={busy} onClick={() => grantAttempts(selected.user.id)}>Оролдлого нэмэх</button>}<button className="btn-secondary" onClick={() => setOpenUser(null)}>Хаах</button></div></div>
      {selected.status === 'locked' && <div className="locked-notice">Энэ хүн бүх оролдлогоо ашиглаж тэнцээгүй тул «ахин сургалтад суу» гэсэн мэдэгдэл харна. Дахин сургалтад суусны дараа «Оролдлого нэмэх» дарна уу.</div>}
      {selected.attempts.length === 0 ? <p className="hint-text">Хараахан өгөөгүй байна.</p> : <>
        <div className="attempt-tabs">{selected.attempts.map(attempt => <button key={attempt.id} className={attempt.attempt_number === attemptNo ? 'on' : ''} onClick={() => setAttemptNo(attempt.attempt_number)}>{attempt.attempt_number}-р оролдлого · {attempt.completed ? `${attempt.percent}%` : 'дуусаагүй'}{attempt.passed ? ' ✓' : ''}</button>)}</div>
        {currentAttempt && (!detail ? <div className="empty-state"><span className="spinner" />Ачааллаж байна...</div> : quiz.questions.map((question, qi) => {
          const answer = attemptAnswers(currentAttempt.id).find(item => item.question_id === question.id)
          const overridden = answer?.override_correct != null
          const effective = answer ? (overridden ? answer.override_correct : answer.is_correct) : null
          return <OverrideRow key={question.id} index={qi} question={question} answer={answer} overridden={overridden} effective={effective} editable={currentAttempt.completed} busy={busy}
            onApply={(correct, reason) => overrideAnswer(currentAttempt.id, question.id, correct, reason)} />
        }))}
      </>}
    </section>}

    <section className="card res-section">
      <h2>Асуулт бүрийн зөв хариултын хувь</h2>
      <div className="q-bars">{results.questionStats.map((stat, i) => <div key={stat.id} className={`q-bar ${stat.percent < 50 ? 'low' : ''}`}><span>{i + 1}. {stat.text} — <strong>{stat.percent}%</strong> ({stat.correct} зөв / {stat.wrong} буруу)</span><div className="track"><i style={{ width: `${stat.percent}%` }} /></div></div>)}</div>
    </section>
  </div>
}

function OverrideRow({ index, question, answer, overridden, effective, editable, busy, onApply }: {
  index: number; question: DailyQuizQuestion; answer?: Answer; overridden: boolean; effective: boolean | null; editable: boolean; busy: boolean
  onApply: (correct: boolean | null, reason: string) => void
}) {
  const [reason, setReason] = useState<string>(answer?.override_reason ?? OVERRIDE_REASONS[0].value)
  useEffect(() => { setReason(answer?.override_reason ?? OVERRIDE_REASONS[0].value) }, [answer?.override_reason])
  const state = effective === null ? '' : effective ? 'ok' : 'no'
  return <div className={`answer-row ${state}`}>
    <h4>{index + 1}. {question.text}{overridden && <span className="override-badge">Админ засав: {overrideReasonLabel(answer?.override_reason)}</span>}</h4>
    <div className="answer-opts">{question.options.map((option, oi) => <div key={oi} className={`${oi === question.correct_index ? 'is-correct' : ''} ${answer?.selected_index === oi ? 'is-picked' : ''}`}>{String.fromCharCode(65 + oi)}. {option.text}{answer?.selected_index === oi && ' ← сонгосон'}{oi === question.correct_index && ' ✓ зөв'}</div>)}
      {answer && answer.selected_index === null && <div>Хугацаа дууссан / хариулаагүй</div>}{!answer && <div>Хариулаагүй</div>}</div>
    {editable && answer && <div className="override-box">
      <strong>Хариуг засах:</strong>
      <select value={reason} onChange={e => setReason(e.target.value)}>{OVERRIDE_REASONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
      {effective ? <button className="btn-secondary" disabled={busy} onClick={() => onApply(false, reason)}>Буруу болгох</button> : <button className="btn-primary" disabled={busy} onClick={() => onApply(true, reason)}>Зөв болгох</button>}
      {overridden && <button className="text-button" disabled={busy} onClick={() => onApply(null, '')}>Буцаах</button>}
    </div>}
  </div>
}

function ExportControl({ id, results, training, value, onChange }: { id: string; results: Results; training: boolean; value: ExportFilter; onChange: (value: ExportFilter) => void }) {
  const [shift, setShift] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const options = EXPORT_FILTERS.filter(item => training || !item.training)
  const shiftsPresent = SHIFT_NUMBERS.filter(n => results.rows.some(row => row.user.shift_number === n))
  const extras: ExportExtras = { shift: shift ? Number(shift) : null, from: from || null, to: to || null }
  const count = filterResults(results as never, value, extras).rows.length
  const params = new URLSearchParams()
  if (value !== 'all') params.set('filter', value)
  if (shift) params.set('shift', shift)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString()
  const touched = !!(shift || from || to)
  return <div className="export-control">
    <div className="export-row">
      <label>Хэн<select className="input-field" value={value} onChange={e => onChange(e.target.value as ExportFilter)}>{options.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      {shiftsPresent.length > 1 && <label>Ээлж<select className="input-field" value={shift} onChange={e => setShift(e.target.value)}><option value="">Бүх ээлж</option>{shiftsPresent.map(n => <option key={n} value={n}>{shiftLabel(n)}</option>)}</select></label>}
      <label>Дуусгасан цагаас хойш<input type="datetime-local" className="input-field" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label>Дуусгасан цагаас өмнө<input type="datetime-local" className="input-field" value={to} onChange={e => setTo(e.target.value)} /></label>
    </div>
    <div className="export-row">
      <span className="export-count">Файлд орох хүн: <strong>{count}</strong>{(from || to) && ' · цагийг Монголын цагаар, шалгалтаа дуусгасан хүмүүсийг л тооцно'}</span>
      {touched && <button type="button" className="text-button" onClick={() => { setShift(''); setFrom(''); setTo('') }}>Шүүлтүүр арилгах</button>}
      <a className="btn-primary" href={`/api/quizzes/${id}/export${query ? `?${query}` : ''}`}>Excel татах</a>
    </div>
  </div>
}

// A long list (70+ names) stays folded until asked for; once open it is searchable, filterable by shift and copyable.
function NameList({ title, viewLabel, rows }: { title: string; viewLabel: string; rows: Row[] }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [shift, setShift] = useState('')
  const [copied, setCopied] = useState(false)
  const shifts = SHIFT_NUMBERS.filter(n => rows.some(row => row.user.shift_number === n))
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter(row => (!shift || String(row.user.shift_number) === shift) && (!needle || row.user.name.toLowerCase().includes(needle) || row.user.sap_id.includes(needle)))
  }, [rows, search, shift])

  async function copy() {
    const text = visible.map((row, i) => `${i + 1}. ${row.user.name} (${row.user.sap_id})`).join('\n')
    try { await navigator.clipboard.writeText(text) } catch {
      const area = document.createElement('textarea'); area.value = text; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove()
    }
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }

  return <section className="card res-section name-list">
    <div className="name-list-head">
      <strong>{title}</strong><span className="name-count">{rows.length}</span>
    </div>
    <div className="name-view-row"><button type="button" className={open ? 'btn-secondary' : 'btn-primary'} aria-expanded={open} onClick={() => setOpen(value => !value)} disabled={rows.length === 0}>{open ? 'Жагсаалтыг нуух' : viewLabel}</button></div>
    {rows.length === 0 && <p className="hint-text" style={{ padding: '0 18px 16px' }}>Одоогоор байхгүй.</p>}
    {open && rows.length > 0 && (<>
      <div className="name-tools">
        <input className="input-field" placeholder="Нэр эсвэл SAP хайх" value={search} onChange={e => setSearch(e.target.value)} />
        {shifts.length > 1 && <select className="input-field" value={shift} onChange={e => setShift(e.target.value)}><option value="">Бүх ээлж</option>{shifts.map(n => <option key={n} value={n}>{shiftLabel(n)}</option>)}</select>}
        <button type="button" className="btn-secondary" onClick={copy} disabled={visible.length === 0}>{copied ? 'Хуулагдлаа ✓' : 'Нэрсийг хуулах'}</button>
      </div>
      <p className="roster-count">{visible.length === rows.length ? `${rows.length} хүн` : `${visible.length} / ${rows.length} хүн харагдаж байна`}</p>
      <ol className="name-rows">{visible.map((row, i) => <li key={row.user.id}>
        <span className="name-no">{i + 1}</span>
        <span className="name-main"><strong>{row.user.name}</strong><small>SAP {row.user.sap_id} · {shiftLabel(row.user.shift_number)}</small></span>
        {row.final && <span className="name-pct">{row.final.percent}%</span>}
      </li>)}{visible.length === 0 && <li className="name-empty">Хүн олдсонгүй</li>}</ol>
    </>)}
  </section>
}
