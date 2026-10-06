'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'
import type { DailyQuiz, QuizAttempt } from '@/types'
import { mongoliaDate } from '@/lib/date'
import { pushSupported, subscribeToPush } from '@/lib/push-client'

function NotifyBanner() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!pushSupported()) return
    if (Notification.permission === 'default' && !localStorage.getItem('hse_push_dismissed')) setVisible(true)
  }, [])
  async function enable() { await subscribeToPush(); setVisible(false) }
  function dismiss() { localStorage.setItem('hse_push_dismissed', '1'); setVisible(false) }
  if (!visible) return null
  return <section className="card notify-banner">
    <Icon name="bell" size={22} />
    <div><strong>Сануулга идэвхжүүлэх үү?</strong><small>Өдрийн асуумж нээгдэхэд мэдэгдэл илгээе.</small></div>
    <div className="button-row"><button className="btn-quiet" onClick={dismiss}>Үгүй</button><button className="btn-primary" onClick={enable}>Идэвхжүүлэх</button></div>
  </section>
}

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

      <NotifyBanner />

      {loading ? <div className="empty-state"><span className="spinner" />Асуумжийг шалгаж байна...</div> : quizzes.length === 0 ? (
        <section className="empty-state card"><Icon name="clipboard" size={38} /><h2>Өнөөдрийн асуумж ороогүй байна</h2><p>Та мэдлэг сэргээх тоглоомоор оноогоо нэмэх боломжтой.</p><Link href="/games" className="btn-secondary">Тоглоом руу орох</Link></section>
      ) : (
        <div className="stack-lg">
          {quizzes.map(quiz => {
            const attempt = attempts.find(item => item.quiz_id === quiz.id)
            const my = quiz.my_status
            const training = quiz.pass_percent != null
            const finished = my ? (my.passed || my.locked || (!training && !!attempt?.completed)) : !!attempt?.completed
            const retry = !!my && training && !my.passed && !my.locked && my.attempts_used > 0 && !my.in_progress
            const pill = my?.passed ? ['success', 'Тэнцсэн'] : my?.locked ? ['live', 'Түгжигдсэн'] : finished ? ['success', 'Дууссан'] : ['live', training ? 'Сургалтын шалгалт' : 'Өнөөдрийн асуумж']
            const final = my?.final ?? (attempt?.completed ? attempt : null)
            return <section key={quiz.id} className="hero-task card">
              <div className="hero-task-top"><span className={`status-pill ${pill[0]}`}>{pill[1]}</span><span className="deadline"><Icon name="clock" size={16} />{quiz.end_time.slice(0, 5)} хүртэл</span></div>
              <h2>{quiz.title}</h2><p>{quiz.topic || 'HSE-ийн мэдлэг шалгах асуумж'}</p>
              <div className="task-meta"><span><strong>{quiz.questions.length}</strong> асуулт</span><span><strong>{quiz.time_limit_seconds}</strong> сек / асуулт</span>{training ? <span>тэнцэх <strong>{quiz.pass_percent}%</strong></span> : <span><strong>{quiz.questions.length * 100}</strong> боломжит оноо</span>}</div>
              {training && my && <span className="attempt-chip">Оролдлого: {my.attempts_used}/{my.attempts_allowed}</span>}
              {my?.locked ? <div className="locked-notice"><strong>Та {my.attempts_allowed} удаа оролдсон ч тэнцсэнгүй.</strong><br />Ахин сургалтад суугаад HSE-ийн ажилтнаас шинэ оролдлого нээлгэнэ үү.</div>
                : final && finished ? <div className="result-strip"><div><small>Таны оноо</small><strong>{final.score}</strong></div><div><small>Зөв</small><strong>{final.correct_count}</strong></div><div><small>Алдсан</small><strong>{final.wrong_count}</strong></div></div>
                : <>
                  {retry && final && <div className="locked-notice" style={{ background: '#fff8ec', borderColor: '#f3d9a4', color: '#8a5a00' }}>Өмнөх оролдлого тэнцсэнгүй ({my!.attempts_left} оролдлого үлдсэн). Дахин оролдоно уу.</div>}
                  <Link href={`/quiz?id=${quiz.id}`} className="btn-primary action-link">{retry ? 'Дахин оролдох' : (my?.in_progress || (attempt && !attempt.completed)) ? 'Үргэлжлүүлэх' : 'Асуумж эхлүүлэх'}<Icon name="chevron" size={18} /></Link>
                </>}
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
