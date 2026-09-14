'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'
import type { DailyQuiz, QuizAttempt } from '@/types'
import { mongoliaDate } from '@/lib/date'

export default function TodayPage() {
  const { user, ready } = useApp()
  const router = useRouter()
  const [quizzes, setQuizzes] = useState<DailyQuiz[]>([])
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    if (user.role === 'admin') { router.push('/admin/quizzes'); return }
    const shift = user.shift_number ? `&shift=${user.shift_number}` : ''
    Promise.all([
      fetch(`/api/daily-quizzes?date=${mongoliaDate()}${shift}`).then(r => r.json()),
      fetch(`/api/quiz-attempts?user_id=${user.id}`).then(r => r.json()),
    ]).then(([quizResult, attemptResult]) => {
      setQuizzes(quizResult.data ?? [])
      setAttempts(attemptResult.data ?? [])
    }).finally(() => setLoading(false))
  }, [ready, user, router])

  if (!user || user.role === 'admin') return null
  const completedToday = attempts.filter(attempt => attempt.completed && attempt.quiz?.active_date === mongoliaDate())

  return (
    <div className="app-container page-enter">
      <section className="welcome-row">
        <div><span className="eyebrow">ӨНӨӨДӨР</span><h1>Сайн байна уу, {user.name.split(' ')[0]}</h1><p>Өнөөдрийн мэдлэг шалгах асуумж</p></div>
        <div className="date-chip"><Icon name="calendar" size={18} /><span>{new Intl.DateTimeFormat('mn-MN', { month: 'short', day: 'numeric' }).format(new Date())}</span></div>
      </section>

      {loading ? <div className="empty-state"><span className="spinner" />Асуумжийг шалгаж байна...</div> : quizzes.length === 0 ? (
        <section className="empty-state card"><Icon name="clipboard" size={38} /><h2>Өнөөдрийн асуумж ороогүй байна</h2><p>Та мэдлэг сэргээх тоглоомоор оноогоо нэмэх боломжтой.</p><Link href="/games" className="btn-secondary">Тоглоом руу орох</Link></section>
      ) : (
        <div className="stack-lg">
          {quizzes.map(quiz => {
            const attempt = attempts.find(item => item.quiz_id === quiz.id)
            return <section key={quiz.id} className="hero-task card">
              <div className="hero-task-top"><span className={`status-pill ${attempt?.completed ? 'success' : 'live'}`}>{attempt?.completed ? 'Дууссан' : 'Өнөөдрийн асуумж'}</span><span className="deadline"><Icon name="clock" size={16} />{quiz.end_time.slice(0, 5)} хүртэл</span></div>
              <h2>{quiz.title}</h2><p>{quiz.topic || 'HSE-ийн мэдлэг шалгах асуумж'}</p>
              <div className="task-meta"><span><strong>{quiz.questions.length}</strong> асуулт</span><span><strong>{quiz.time_limit_seconds}</strong> сек / асуулт</span><span><strong>{quiz.questions.length * 100}</strong> боломжит оноо</span></div>
              {attempt?.completed ? <div className="result-strip"><div><small>Таны оноо</small><strong>{attempt.score}</strong></div><div><small>Зөв</small><strong>{attempt.correct_count}</strong></div><div><small>Алдсан</small><strong>{attempt.wrong_count}</strong></div></div>
                : <Link href={`/quiz?id=${quiz.id}`} className="btn-primary action-link">{attempt ? 'Үргэлжлүүлэх' : 'Асуумж эхлүүлэх'}<Icon name="chevron" size={18} /></Link>}
            </section>
          })}
        </div>
      )}

      <section className="quick-stats">
        <div className="metric-card"><span>Өнөөдөр өгсөн</span><strong>{completedToday.length}</strong></div>
        <div className="metric-card"><span>Нийт оноо</span><strong>{user.total_score.toLocaleString()}</strong></div>
      </section>
    </div>
  )
}
