'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import type { DailySession } from '@/types'

export default function HistoryPage() {
  const { user, ready, lang, uiText } = useApp()
  const router = useRouter()
  const [sessions, setSessions] = useState<DailySession[]>([])

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    fetch(`/api/sessions?user_id=${encodeURIComponent(user.id)}`)
      .then(r => r.json())
      .then(result => setSessions(result.data ?? []))
      .catch(() => setSessions([]))
  }, [ready, user, router])

  if (!user) return null

  const totalSessions = sessions.length
  const completedSessions = sessions.filter(s => s.completed).length
  const totalScore = sessions.reduce((sum, s) => sum + s.score, 0)

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    if (lang === 'mn') {
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
    }
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div style={{ padding: '0 16px' }}>
      {/* Title */}
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0d2d6b', marginBottom: 4 }}>
        📋 {uiText.history}
      </h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>
        {lang === 'mn' ? 'Сургалтын бүртгэл' : 'Training record'}
      </p>

      {/* Stats header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 10, marginBottom: 20,
      }}>
        {[
          { icon: '📚', value: totalSessions, label: lang === 'mn' ? 'Нийт' : 'Total' },
          { icon: '✅', value: completedSessions, label: lang === 'mn' ? 'Дуусгасан' : 'Done' },
          { icon: '⭐', value: totalScore, label: lang === 'mn' ? 'Оноо' : 'Score' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 20, color: '#0d2d6b' }}>{s.value}</div>
            <div style={{ color: '#9ca3af', fontSize: 11 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Session list */}
      {sessions.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ color: '#6b7280' }}>
            {lang === 'mn' ? 'Шалгалтын түүх байхгүй' : 'No quiz history yet'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sessions.map(session => {
            const img = session.image
            return (
              <div key={session.id} className="card" style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
                {/* Thumbnail */}
                <div style={{
                  width: 60, height: 60, borderRadius: 10, overflow: 'hidden',
                  background: '#e2e8f0', flexShrink: 0,
                }}>
                  {img && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                    {img ? (lang === 'mn' ? img.title : (img.title_en ?? img.title)) : session.image_id}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: 12 }}>
                    📅 {formatDate(session.date)} · 📍 {img?.location?.name ?? '—'}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{
                      background: session.completed ? '#dcfce7' : '#fef3c7',
                      color: session.completed ? '#166534' : '#92400e',
                      borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                    }}>
                      {session.completed
                        ? (lang === 'mn' ? '✅ Дуусгасан' : '✅ Completed')
                        : (lang === 'mn' ? '⏳ Дутуу' : '⏳ Incomplete')}
                    </span>
                  </div>
                </div>

                {/* Score */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 20, color: '#e8601a' }}>+{session.score}</div>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>pts</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
