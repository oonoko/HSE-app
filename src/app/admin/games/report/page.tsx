'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'
import type { SafetyGame } from '@/types'
import { mongoliaDate } from '@/lib/date'

type Player = { id: string; sap_id: string; name: string; shift_number?: number; score: number; duration_seconds: number; played_at: string }
type ReportData = { game: SafetyGame; date: string; shift: number | null; players: Player[]; missing: Array<{ id: string; sap_id: string; name: string; shift_number?: number }> }

function GameReport() {
  const { user, ready, isAdmin } = useApp()
  const router = useRouter()
  const gameId = useSearchParams().get('id')
  const [games, setGames] = useState<SafetyGame[]>([])
  const [selectedId, setSelectedId] = useState(gameId || '')
  const [date, setDate] = useState(mongoliaDate())
  const [shift, setShift] = useState('')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    if (!isAdmin) { router.push('/'); return }
    fetch('/api/games?admin=true').then(r => r.json()).then(result => {
      const list: SafetyGame[] = result.data ?? []
      setGames(list)
      if (!selectedId && list.length) setSelectedId(list[0].id)
    })
  }, [ready, user, isAdmin, router]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready || !isAdmin || !selectedId) return
    setLoading(true); setError('')
    fetch(`/api/game-attempts?admin=true&game_id=${selectedId}&date=${date}${shift ? `&shift=${shift}` : ''}`)
      .then(r => r.json())
      .then(result => { if (result.error) throw new Error(result.error); setData(result.data) })
      .catch(err => setError(err instanceof Error ? err.message : 'Тайлан авч чадсангүй'))
      .finally(() => setLoading(false))
  }, [ready, isAdmin, selectedId, date, shift])

  if (!user || !isAdmin) return null

  return <div className="app-container admin-page page-enter">
    <div className="page-heading-row"><div><span className="eyebrow">МЭДЛЭГ СЭРГЭЭХ</span><h1>Тоглоомын тайлан</h1><p>Тоглоом, өдөр, ээлж сонгоод хэн хэрхэн тоглосныг харна.</p></div><Link href="/admin/games" className="btn-secondary">Буцах</Link></div>
    <div className="filter-bar">
      <label>Тоглоом<select className="input-field" value={selectedId} onChange={e => setSelectedId(e.target.value)}>{games.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
      <label>Огноо<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      {user.is_super_admin?<label>Ээлж<select value={shift} onChange={e => setShift(e.target.value)}><option value="">Бүх ээлж</option>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}-р ээлж</option>)}</select></label>:<label>Ээлж<input className="input-field" value={`${user.shift_number}-р ээлж`} disabled/></label>}
    </div>

    {error && <div className="form-error">{error}</div>}
    {loading || !data ? <div className="empty-state"><span className="spinner" /></div> : <>
      <div className="kpi-grid"><div><span>Тоглосон</span><strong>{data.players.length}</strong></div><div><span>Тоглоогүй</span><strong>{data.missing.length}</strong></div><div><span>Дундаж оноо</span><strong>{data.players.length ? Math.round(data.players.reduce((s, p) => s + p.score, 0) / data.players.length) : 0}</strong></div></div>

      <section className="card driver-table">
        <div className="section-heading"><div><span className="eyebrow">ТОГЛОСОН</span><h2>{data.players.length} жолооч</h2></div></div>
        {data.players.length === 0 ? <div className="empty-mini">Энэ өдөр хэн ч тоглоогүй байна.</div> : data.players.map(p => <div className="driver-row" key={p.id}>
          <div className="driver-avatar">{p.name[0]}</div>
          <div><strong>{p.name}</strong><small>SAP {p.sap_id} · {p.shift_number ? `${p.shift_number}-р ээлж` : 'Ээлжгүй'}</small></div>
          <div className="score-compare"><small>Хугацаа</small><b>{p.duration_seconds}с</b></div>
          <div className="score-compare"><small>Цаг</small><b>{new Intl.DateTimeFormat('mn-MN', { hour: '2-digit', minute: '2-digit' }).format(new Date(p.played_at))}</b></div>
          <span className="trend improved">{p.score}</span>
        </div>)}
      </section>

      {data.missing.length > 0 && <section className="card driver-table">
        <div className="section-heading"><div><span className="eyebrow">ТОГЛООГҮЙ</span><h2>{data.missing.length} жолооч</h2></div></div>
        {data.missing.map(m => <div className="driver-row" key={m.id}>
          <div className="driver-avatar">{m.name[0]}</div>
          <div><strong>{m.name}</strong><small>SAP {m.sap_id} · {m.shift_number ? `${m.shift_number}-р ээлж` : 'Ээлжгүй'}</small></div>
        </div>)}
      </section>}
    </>}
  </div>
}

export default function GameReportPage() { return <Suspense fallback={<div className="empty-state"><span className="spinner" /></div>}><GameReport /></Suspense> }
