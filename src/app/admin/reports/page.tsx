'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import type { User, DailySession, HazardImage } from '@/types'

export default function AdminReportsPage() {
  const { user, ready, lang, isAdmin } = useApp()
  const router = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [workers, setWorkers] = useState<User[]>([])
  const [sessions, setSessions] = useState<DailySession[]>([])
  const [images, setImages] = useState<HazardImage[]>([])

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    if (!isAdmin) { router.push('/'); return }
    Promise.all([
      fetch('/api/users').then(r => r.json()),
      fetch('/api/sessions?all=true').then(r => r.json()),
      fetch('/api/images').then(r => r.json()),
    ]).then(([usersResult, sessionsResult, imagesResult]) => {
      setWorkers((usersResult.data ?? []).filter((item: User) => item.role !== 'admin'))
      setSessions(sessionsResult.data ?? [])
      setImages(imagesResult.data ?? [])
    }).finally(() => setLoaded(true))
  }, [ready, user, isAdmin, router])

  if (!user || !isAdmin || !loaded) return null

  const totalWorkers = workers.length
  const totalImages = images.length
  const completedToday = sessions.filter(s => {
    const today = new Date().toISOString().split('T')[0]
    return s.date === today && s.completed
  }).length
  const completionRate = totalWorkers > 0 ? Math.round((completedToday / totalWorkers) * 100) : 0

  // Хамгийн олон илрүүлэгдсэн аюулуудын тооцоо (mock)
  const hazardCounts = images.flatMap(img => img.hazards).reduce<Record<string, number>>((acc, h) => {
    acc[h.label] = (acc[h.label] ?? 0) + 1
    return acc
  }, {})

  const topHazards = Object.entries(hazardCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Хэлтсийн статистик
  const deptStats = workers.reduce<Record<string, { count: number; score: number }>>((acc, u) => {
    if (!acc[u.department]) acc[u.department] = { count: 0, score: 0 }
    acc[u.department].count++
    acc[u.department].score += u.total_score
    return acc
  }, {})

  return (
    <div style={{ padding: '0 16px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0d2d6b', marginBottom: 4 }}>
        📊 {lang === 'mn' ? 'Тайлан' : 'Reports'}
      </h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
        {lang === 'mn' ? 'Нийт статистик' : 'Overall statistics'}
      </p>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {[
          { icon: '👥', value: totalWorkers, label: lang === 'mn' ? 'Нийт жолооч' : 'Total drivers', color: '#0d2d6b' },
          { icon: '🖼️', value: totalImages, label: lang === 'mn' ? 'Нийт зураг' : 'Total images', color: '#1a4fbe' },
          { icon: '✅', value: completedToday, label: lang === 'mn' ? 'Өнөөдөр дуусгасан' : 'Completed today', color: '#22c55e' },
          { icon: '📈', value: `${completionRate}%`, label: lang === 'mn' ? 'Гүйцэтгэлийн хувь' : 'Completion rate', color: '#e8601a' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{k.icon}</div>
            <div style={{ fontWeight: 900, fontSize: 26, color: k.color }}>{k.value}</div>
            <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Today completion progress */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontWeight: 700, color: '#0d2d6b' }}>
            {lang === 'mn' ? 'Өнөөдрийн гүйцэтгэл' : "Today's completion"}
          </span>
          <span style={{ fontWeight: 700, color: '#e8601a' }}>{completedToday}/{totalWorkers}</span>
        </div>
        <div className="progress-bar" style={{ height: 10 }}>
          <div className="progress-fill" style={{ width: `${completionRate}%` }} />
        </div>
        <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 6 }}>
          {completionRate}% · {totalWorkers - completedToday} {lang === 'mn' ? 'дутуу' : 'remaining'}
        </div>
      </div>

      {/* Top hazards */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <h3 style={{ fontWeight: 700, fontSize: 15, color: '#0d2d6b', marginBottom: 12 }}>
          ⚠️ {lang === 'mn' ? 'Нийтлэг аюулууд' : 'Common hazards'}
        </h3>
        {topHazards.map(([label, count], i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#92400e' }}>
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
              <div className="progress-bar" style={{ marginTop: 4 }}>
                <div className="progress-fill" style={{ width: `${(count / topHazards[0][1]) * 100}%` }} />
              </div>
            </div>
            <div style={{ fontWeight: 700, color: '#e8601a', fontSize: 14 }}>{count}</div>
          </div>
        ))}
      </div>

      {/* Department stats */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <h3 style={{ fontWeight: 700, fontSize: 15, color: '#0d2d6b', marginBottom: 12 }}>
          🏢 {lang === 'mn' ? 'Хэлтсийн статистик' : 'Department stats'}
        </h3>
        {Object.entries(deptStats).map(([dept, stat]) => (
          <div key={dept} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{dept}</div>
              <div style={{ color: '#9ca3af', fontSize: 12 }}>
                {stat.count} {lang === 'mn' ? 'жолооч' : 'drivers'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, color: '#e8601a', fontSize: 15 }}>
                {Math.round(stat.score / stat.count)} avg
              </div>
              <div style={{ color: '#9ca3af', fontSize: 11 }}>pts/person</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
