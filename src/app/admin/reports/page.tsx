'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'
import type { User } from '@/types'

type ReportsData = {
  total_quizzes: number
  total_quiz_attempts: number
  avg_quiz_percent: number
  total_games: number
  total_game_attempts: number
  recent_attempts: Array<{ id: string; score: number; max_score: number; completed_at: string; user?: { name: string; sap_id: string; shift_number?: number }; quiz?: { title: string } }>
}

export default function AdminReportsPage() {
  const { user, ready, isAdmin } = useApp()
  const router = useRouter()
  const [drivers, setDrivers] = useState<User[]>([])
  const [reports, setReports] = useState<ReportsData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    if (!isAdmin) { router.push('/'); return }
    Promise.all([
      fetch('/api/users').then(r => r.json()),
      fetch('/api/reports').then(r => r.json()),
    ]).then(([usersResult, reportsResult]) => {
      if (usersResult.error) throw new Error(usersResult.error)
      if (reportsResult.error) throw new Error(reportsResult.error)
      setDrivers((usersResult.data as User[]).filter(item => item.role === 'driver'))
      setReports(reportsResult.data)
    }).catch(err => setError(err instanceof Error ? err.message : 'Мэдээлэл авч чадсангүй'))
  }, [ready, user, isAdmin, router])

  if (!user || !isAdmin) return null
  if (error) return <div className="app-container admin-page"><div className="empty-state card"><h2>Алдаа гарлаа</h2><p>{error}</p></div></div>
  if (!reports) return <div className="empty-state"><span className="spinner" /></div>

  const leaders = [...drivers].sort((a, b) => b.total_score - a.total_score).slice(0, 10)
  const shiftStats = [1, 2, 3, 4].map(n => {
    const shiftDrivers = drivers.filter(d => d.shift_number === n)
    const avg = shiftDrivers.length ? Math.round(shiftDrivers.reduce((s, d) => s + d.total_score, 0) / shiftDrivers.length) : 0
    return { shift: n, count: shiftDrivers.length, avg }
  })
  const unassigned = drivers.filter(d => !d.shift_number).length

  return <div className="app-container admin-page page-enter">
    <div className="page-heading-row">
      <div><span className="eyebrow">ЕРӨНХИЙ ТАЙЛАН</span><h1>Тайлан</h1><p>Бүх цаг үеийн нэгтгэсэн статистик</p></div>
      <Link href="/admin/dashboard" className="btn-secondary">Өдрийн dashboard</Link>
    </div>

    <div className="kpi-grid">
      <div><span>Нийт жолооч</span><strong>{drivers.length}</strong></div>
      <div><span>Нийт асуумж</span><strong>{reports.total_quizzes}</strong></div>
      <div><span>Дундаж хувь</span><strong>{reports.avg_quiz_percent}%</strong></div>
      <div><span>Тоглолт</span><strong>{reports.total_game_attempts}</strong></div>
    </div>

    <section className="dashboard-grid">
      <div className="card dashboard-card">
        <div className="section-heading"><div><span className="eyebrow">ТОП ЖОЛООЧИД</span><h2>Бүх цаг үеийн онооны эрэмбэ</h2></div></div>
        {leaders.length === 0 ? <div className="empty-mini">Жолооч байхгүй</div> : <>
          <div className="top-three">{leaders.slice(0, 3).map((x, i) => <div className={`top-person place-${i + 1}`} key={x.id}><span>{i + 1}</span><strong>{x.name}</strong><small>{x.shift_number ? `${x.shift_number}-р ээлж` : 'Ээлжгүй'}</small><b>{x.total_score.toLocaleString()}</b></div>)}</div>
          <div className="rank-table">{leaders.slice(3).map((x, i) => <div key={x.id}><span>{i + 4}</span><div><strong>{x.name}</strong><small>SAP {x.sap_id} · {x.shift_number ? `${x.shift_number}-р ээлж` : 'Ээлжгүй'}</small></div><b>{x.total_score.toLocaleString()}</b></div>)}</div>
        </>}
      </div>

      <div className="card dashboard-card">
        <div className="section-heading"><div><span className="eyebrow">ЭЭЛЖ БҮРЭЭР</span><h2>Ээлжийн харьцуулалт</h2></div></div>
        {shiftStats.map(s => <div className="analysis-row" key={s.shift}>
          <strong>{s.shift}-р ээлж</strong><small>{s.count} жолооч</small>
          <div className="accuracy"><span style={{ width: `${Math.min(100, s.avg / 10)}%` }} /><b>{s.avg} дундаж оноо</b></div>
        </div>)}
        {unassigned > 0 && <div className="empty-mini">{unassigned} жолооч ээлж оноогдоогүй байна.</div>}
      </div>
    </section>

    <section className="card dashboard-card" style={{ marginTop: 14 }}>
      <div className="section-heading"><div><span className="eyebrow">СҮҮЛИЙН ҮЙЛ АЖИЛЛАГАА</span><h2>Сүүлд дууссан асуумжууд</h2></div></div>
      {reports.recent_attempts.length === 0 ? <div className="empty-mini">Оролдлого алга.</div> : reports.recent_attempts.map(a => <div className="activity-row" key={a.id}>
        <div className="activity-icon"><Icon name="clipboard" size={19} /></div>
        <div><strong>{a.user?.name || 'Тодорхойгүй'}</strong><small>{a.quiz?.title || 'Асуумж'} · {new Intl.DateTimeFormat('mn-MN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(a.completed_at))}</small></div>
        <b>{a.max_score ? Math.round((a.score / a.max_score) * 100) : 0}%</b>
      </div>)}
    </section>
  </div>
}
