'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'

type QuizAttempt = { id: string; score: number; max_score: number; completed_at: string; quiz?: { title: string; topic?: string; active_date: string } }
type GameAttempt = { id: string; score: number; played_at: string; game?: { title: string; template: string } }
type ProfileData = {
  user: { id: string; name: string; sap_id: string; shift_number?: number; total_score: number }
  quiz_attempts: QuizAttempt[]
  game_attempts: GameAttempt[]
  rank: number | null
  shift_rank: number | null
}

function TrendChart({ points }: { points: { date: string; value: number }[] }) {
  if (points.length < 2) return <div className="empty-mini">Графикт хамгийн багадаа 2 оролдлого хэрэгтэй.</div>
  const w = 640, h = 200, pad = 26
  const step = (w - 2 * pad) / (points.length - 1)
  const xs = points.map((_, i) => pad + i * step)
  const ys = points.map(p => h - pad - (Math.max(0, Math.min(100, p.value)) / 100) * (h - 2 * pad))
  const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${xs[xs.length - 1].toFixed(1)},${h - pad} L${xs[0].toFixed(1)},${h - pad} Z`
  return <svg viewBox={`0 0 ${w} ${h}`} className="trend-chart" preserveAspectRatio="none">
    {[0, 25, 50, 75, 100].map(v => <line key={v} x1={pad} x2={w - pad} y1={h - pad - (v / 100) * (h - 2 * pad)} y2={h - pad - (v / 100) * (h - 2 * pad)} stroke="#eef2f7" strokeWidth={1} />)}
    <path d={areaPath} fill="#eaf2fd" />
    <path d={linePath} fill="none" stroke="#164f99" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r={i === xs.length - 1 ? 6 : 4} fill={i === xs.length - 1 ? '#f15a24' : '#164f99'} />)}
  </svg>
}

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, ready, isAdmin } = useApp()
  const router = useRouter()
  const [data, setData] = useState<ProfileData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    if (!isAdmin) { router.push('/'); return }
    fetch(`/api/profile?user_id=${id}`).then(r => r.json()).then(result => {
      if (result.error) throw new Error(result.error)
      setData(result.data)
    }).catch(err => setError(err instanceof Error ? err.message : 'Мэдээлэл авч чадсангүй'))
  }, [ready, user, isAdmin, router, id])

  if (!user || !isAdmin) return null
  if (error) return <div className="app-container admin-page"><div className="empty-state card"><h2>Алдаа гарлаа</h2><p>{error}</p></div></div>
  if (!data) return <div className="empty-state"><span className="spinner" /></div>

  const quizPoints = [...data.quiz_attempts]
    .sort((a, b) => a.completed_at.localeCompare(b.completed_at))
    .map(a => ({ date: a.completed_at, value: a.max_score ? Math.round((a.score / a.max_score) * 100) : 0 }))

  const first = quizPoints[0]?.value
  const latest = quizPoints[quizPoints.length - 1]?.value
  const delta = first !== undefined && latest !== undefined ? latest - first : 0
  const trend = delta > 5 ? 'improved' : delta < -5 ? 'declined' : 'stable'
  const trendLabel = trend === 'improved' ? 'Сайжирсан' : trend === 'declined' ? 'Муудсан' : 'Тогтвортой'

  const gameTotal = data.game_attempts.reduce((sum, a) => sum + a.score, 0)

  return <div className="app-container admin-page page-enter">
    <div className="page-heading-row">
      <div><span className="eyebrow">ЖОЛООЧИЙН ДЭЛГЭРЭНГҮЙ</span><h1>{data.user.name}</h1><p>SAP {data.user.sap_id} · {data.user.shift_number ? `${data.user.shift_number}-р ээлж` : 'Ээлж оноогоогүй'}</p></div>
      <Link href="/admin/my-shift" className="btn-secondary">Буцах</Link>
    </div>

    <div className="kpi-grid">
      <div><span>Нийт асуумж</span><strong>{quizPoints.length}</strong></div>
      <div><span>Эхний оноо</span><strong>{first !== undefined ? `${first}%` : '—'}</strong></div>
      <div><span>Сүүлийн оноо</span><strong>{latest !== undefined ? `${latest}%` : '—'}</strong></div>
      <div className={trend === 'improved' ? 'positive' : trend === 'declined' ? 'negative' : ''}><span>Ерөнхий чиг хандлага</span><strong>{trendLabel}</strong></div>
    </div>

    <section className="card dashboard-card" style={{ marginTop: 14 }}>
      <div className="section-heading"><div><span className="eyebrow">АСУУМЖИЙН ОНООНЫ ЯВЦ</span><h2>Хугацааны явцын график</h2></div></div>
      <TrendChart points={quizPoints} />
    </section>

    <section className="card dashboard-card" style={{ marginTop: 14 }}>
      <div className="section-heading"><div><span className="eyebrow">ТҮҮХ</span><h2>Асуумжийн оролдлогууд</h2></div></div>
      {data.quiz_attempts.length === 0 ? <div className="empty-mini">Асуумж өгөөгүй байна.</div> : data.quiz_attempts.map(a => <div className="activity-row" key={a.id}>
        <div className="activity-icon quiz"><Icon name="clipboard" size={19} /></div>
        <div><strong>{a.quiz?.title || 'Өдрийн асуумж'}</strong><small>{new Intl.DateTimeFormat('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(a.completed_at))}</small></div>
        <b>{a.max_score ? Math.round((a.score / a.max_score) * 100) : 0}%</b>
      </div>)}
    </section>

    <section className="card dashboard-card" style={{ marginTop: 14 }}>
      <div className="section-heading"><div><span className="eyebrow">ТОГЛООМ</span><h2>Нийт {gameTotal} оноо · {data.game_attempts.length} оролдлого</h2></div></div>
      {data.game_attempts.length === 0 ? <div className="empty-mini">Тоглоом тоглоогүй байна.</div> : data.game_attempts.map(a => <div className="activity-row" key={a.id}>
        <div className="activity-icon game"><Icon name="game" size={19} /></div>
        <div><strong>{a.game?.title || 'Тоглоом'}</strong><small>{new Intl.DateTimeFormat('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(a.played_at))}</small></div>
        <b>+{a.score}</b>
      </div>)}
    </section>
  </div>
}
