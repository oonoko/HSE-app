'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/lib/context'
import { SHIFT_NUMBERS, shiftLabel } from '@/lib/shifts'
import { PROGRESS_LABELS, type GameAnalysis, type ProgressStatus } from '@/lib/game-analytics'
import type { SafetyGame } from '@/types'

type Data = GameAnalysis & { game: { id: string; title: string }; shift: number | null }
const FILTERS: Array<{ key: 'all' | ProgressStatus; label: string }> = [
  { key: 'all', label: 'Бүгд' }, { key: 'improved', label: 'Сайжирсан' }, { key: 'declined', label: 'Муудсан' }, { key: 'stable', label: 'Тогтвортой' }, { key: 'single', label: 'Нэг удаа' },
]
const shortDate = (date: string) => date.slice(5).replace('-', '/')
const signed = (value: number) => (value > 0 ? `+${value}` : String(value))

function TimelineChart({ points, maxScore }: { points: Data['timeline']; maxScore: number | null }) {
  if (points.length === 0) return <p className="hint-text">Өгөгдөл алга.</p>
  const w = 640, h = 220, pad = { l: 44, r: 16, t: 14, b: 30 }
  const top = Math.max(maxScore ?? 0, ...points.map(point => point.avgScore), 100)
  const x = (i: number) => pad.l + (points.length === 1 ? (w - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (w - pad.l - pad.r))
  const y = (value: number) => pad.t + (1 - value / top) * (h - pad.t - pad.b)
  const line = points.map((point, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(point.avgScore).toFixed(1)}`).join(' ')
  return <svg viewBox={`0 0 ${w} ${h}`} className="ga-chart" role="img" aria-label="Өдөр бүрийн дундаж оноо">
    {[0, .5, 1].map(f => <g key={f}><line x1={pad.l} x2={w - pad.r} y1={y(top * f)} y2={y(top * f)} stroke="#dce4ef" /><text x={pad.l - 6} y={y(top * f) + 4} textAnchor="end" fontSize="11" fill="#67748a">{Math.round(top * f)}</text></g>)}
    <path d={line} fill="none" stroke="#164f99" strokeWidth="3" strokeLinejoin="round" />
    {points.map((point, i) => <g key={point.date}><circle cx={x(i)} cy={y(point.avgScore)} r="5" fill="#f15a24" /><text x={x(i)} y={y(point.avgScore) - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="#162033">{point.avgScore}</text><text x={x(i)} y={h - 10} textAnchor="middle" fontSize="11" fill="#67748a">{shortDate(point.date)}</text></g>)}
  </svg>
}

function Compare({ label, first, latest, top }: { label: string; first: number; latest: number; top: number }) {
  return <div className="ga-compare"><strong>{label}</strong>
    <div><small>Эхний тоглолт</small><div className="track"><i style={{ width: `${Math.min(100, first / top * 100)}%` }} /></div><b>{first}</b></div>
    <div><small>Сүүлийн тоглолт</small><div className="track"><i className="now" style={{ width: `${Math.min(100, latest / top * 100)}%` }} /></div><b>{latest}</b></div></div>
}

function Analysis() {
  const { user, ready, isAdmin } = useApp()
  const router = useRouter()
  const initial = useSearchParams().get('id') || ''
  const [games, setGames] = useState<SafetyGame[]>([])
  const [gameId, setGameId] = useState(initial)
  const [shift, setShift] = useState('')
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | ProgressStatus>('all')

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    if (!isAdmin) { router.push('/'); return }
    fetch('/api/games?admin=true').then(r => r.json()).then(result => { const list = (result.data ?? []) as SafetyGame[]; setGames(list); setGameId(current => current || list[0]?.id || '') })
  }, [ready, user, isAdmin, router])

  useEffect(() => {
    if (!gameId) return
    setLoading(true); setError('')
    fetch(`/api/game-analytics?game_id=${gameId}${shift ? `&shift=${shift}` : ''}`).then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error); setData(body.data) })
      .catch(err => { setData(null); setError(err.message) }).finally(() => setLoading(false))
  }, [gameId, shift])

  const rows = useMemo(() => (data?.drivers ?? []).filter(row => filter === 'all' || row.status === filter), [data, filter])
  if (!user || !isAdmin) return null

  const top = Math.max(data?.totals.maxScore ?? 0, data?.progress.avgFirst ?? 0, data?.progress.avgLatest ?? 0, 100)
  return <div className="app-container admin-page page-enter">
    <div className="page-heading-row"><div><span className="eyebrow">ТОГЛООМЫН ШИНЖИЛГЭЭ</span><h1>Хэрхэн сайжирч байна вэ</h1><p>Эхний тоглолтоос сүүлийн тоглолт хүртэлх өөрчлөлт.</p></div>
      <div className="list-actions"><Link className="btn-secondary" href="/admin/games">Тоглоомууд</Link>{gameId && <Link className="btn-secondary" href={`/admin/games/report?id=${gameId}`}>Өдрийн тайлан</Link>}</div></div>
    <div className="form-grid" style={{ marginBottom: 16 }}>
      <label>Тоглоом<select className="input-field" value={gameId} onChange={e => setGameId(e.target.value)}>{games.map(game => <option key={game.id} value={game.id}>{game.title}</option>)}</select></label>
      {user.is_super_admin ? <label>Ээлж<select className="input-field" value={shift} onChange={e => setShift(e.target.value)}><option value="">Бүх ээлж</option>{SHIFT_NUMBERS.map(n => <option key={n} value={n}>{shiftLabel(n)}</option>)}</select></label> : <label>Ээлж<input className="input-field" value={shiftLabel(user.shift_number)} disabled /></label>}
    </div>
    {error && <div className="form-error">{error}</div>}
    {loading && !data ? <div className="empty-state"><span className="spinner" />Ачааллаж байна...</div> : data && <>
      <div className="res-kpis">
        <div className="res-kpi"><small>Тоглосон хүн</small><strong>{data.totals.players}<span className="ga-sub"> / {data.totals.drivers}</span></strong></div>
        <div className="res-kpi"><small>Нийт тоглолт</small><strong>{data.totals.plays}</strong></div>
        <div className="res-kpi"><small>Дундаж оноо</small><strong>{data.totals.avgScore}</strong></div>
        <div className="res-kpi"><small>Дундаж хугацаа</small><strong>{data.totals.avgDuration}<span className="ga-sub"> сек</span></strong></div>
        <div className="res-kpi warn"><small>Тоглоогүй</small><strong>{data.totals.notPlayed}</strong></div>
      </div>

      <section className="card res-section"><h2>Өөрчлөлт (дахин тоглосон {data.progress.repeaters} хүн)</h2>
        {data.progress.repeaters === 0 ? <p className="hint-text">Дахин тоглосон хүн алга, харьцуулах өгөгдөл хараахан байхгүй.</p> : <>
          <div className="res-kpis" style={{ margin: '0 0 14px' }}>
            <div className="res-kpi good"><small>Сайжирсан</small><strong>{data.progress.improved}</strong></div>
            <div className="res-kpi"><small>Тогтвортой</small><strong>{data.progress.stable}</strong></div>
            <div className="res-kpi bad"><small>Муудсан</small><strong>{data.progress.declined}</strong></div>
            <div className={`res-kpi ${data.progress.avgChange >= 0 ? 'good' : 'bad'}`}><small>Дундаж өөрчлөлт</small><strong>{signed(data.progress.avgChange)}</strong></div>
          </div>
          <Compare label="Дундаж оноо" first={data.progress.avgFirst} latest={data.progress.avgLatest} top={top} />
          <p className="hint-text">Эхний болон сүүлийн тоглолтын оноог харьцуулсан. Эхний ононоос 10%-иас дээш өөрчлөгдвөл «сайжирсан» эсвэл «муудсан» гэж тооцно.</p></>}
      </section>

      <section className="card res-section"><h2>Өдөр бүрийн дундаж оноо</h2><TimelineChart points={data.timeline} maxScore={data.totals.maxScore} />
        <div className="res-table-wrap"><table className="res-table"><thead><tr><th>Өдөр</th><th>Тоглолт</th><th>Хүн</th><th>Дундаж оноо</th><th>Дундаж хугацаа</th></tr></thead><tbody>{data.timeline.map(point => <tr key={point.date}><td>{point.date}</td><td>{point.plays}</td><td>{point.players}</td><td>{point.avgScore}</td><td>{point.avgDuration} сек</td></tr>)}</tbody></table></div></section>

      {data.shifts.length > 1 && <section className="card res-section"><h2>Ээлжээр</h2><div className="res-table-wrap"><table className="res-table"><thead><tr><th>Ээлж</th><th>Тоглосон</th><th>Тоглолт</th><th>Дахин тоглосон</th><th>Эхний дундаж</th><th>Сүүлийн дундаж</th><th>Өөрчлөлт</th></tr></thead><tbody>{data.shifts.map(item => <tr key={String(item.shift)}><td><strong>{shiftLabel(item.shift)}</strong></td><td>{item.players}</td><td>{item.plays}</td><td>{item.repeaters}</td><td>{item.repeaters ? item.avgFirst : '—'}</td><td>{item.repeaters ? item.avgLatest : '—'}</td><td className={item.change > 0 ? 'ga-up' : item.change < 0 ? 'ga-down' : ''}>{item.repeaters ? signed(item.change) : '—'}</td></tr>)}</tbody></table></div></section>}

      <section className="card res-section"><h2>Хүн бүрээр</h2>
        <div className="res-filters">{FILTERS.map(item => <button key={item.key} className={filter === item.key ? 'on' : ''} onClick={() => setFilter(item.key)}>{item.label}</button>)}</div>
        <div className="res-table-wrap"><table className="res-table"><thead><tr><th>Нэр</th><th>SAP</th><th>Ээлж</th><th>Тоглолт</th><th>Эхний</th><th>Сүүлийн</th><th>Шилдэг</th><th>Өөрчлөлт</th><th>Төлөв</th></tr></thead>
          <tbody>{rows.length === 0 ? <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)' }}>Хүн олдсонгүй</td></tr> : rows.map(row => <tr key={row.id}>
            <td><strong>{row.name}</strong></td><td>{row.sap_id}</td><td>{shiftLabel(row.shift_number)}</td><td>{row.plays}</td><td>{row.first}</td><td>{row.latest}</td><td>{row.best}</td>
            <td className={row.status === 'improved' ? 'ga-up' : row.status === 'declined' ? 'ga-down' : ''}>{row.plays > 1 ? `${signed(row.change)} (${signed(row.changePercent)}%)` : '—'}</td>
            <td><span className={`st-pill ga-${row.status}`}>{PROGRESS_LABELS[row.status]}</span></td></tr>)}</tbody></table></div></section>
    </>}
  </div>
}

export default function GameAnalysisPage() { return <Suspense fallback={<div className="empty-state">Ачааллаж байна...</div>}><Analysis /></Suspense> }
