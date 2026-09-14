'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'
import type { DailyQuiz, QuizAttempt } from '@/types'

type Feedback = { selected: number | null; correct: number; isCorrect: boolean; points: number; explanation: string }

function QuizRunner() {
  const { user, ready } = useApp()
  const router = useRouter()
  const quizId = useSearchParams().get('id')
  const [quiz, setQuiz] = useState<DailyQuiz | null>(null)
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [index, setIndex] = useState(0)
  const [remaining, setRemaining] = useState(60)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [score, setScore] = useState(0)
  const [result, setResult] = useState<QuizAttempt | null>(null)
  const [error, setError] = useState('')
  const startedAt = useRef(Date.now())
  const answering = useRef(false)

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    if (!quizId) { router.push('/'); return }
    fetch('/api/quiz-attempts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', quiz_id: quizId, user_id: user.id }) })
      .then(r => r.json()).then(data => {
        if (data.error) throw new Error(data.error)
        if (data.completed) { setResult(data.data); return }
        setAttempt(data.data); setQuiz(data.quiz)
        const answered = new Set<string>(data.answered_question_ids ?? [])
        const next = (data.quiz.questions as Array<{ id: string }>).findIndex(question => !answered.has(question.id))
        setIndex(next < 0 ? 0 : next); setRemaining(data.quiz.time_limit_seconds); startedAt.current = Date.now()
      }).catch(err => setError(err.message))
  }, [ready, user, quizId, router])

  const finish = useCallback(async () => {
    if (!attempt) return
    const response = await fetch('/api/quiz-attempts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'complete', attempt_id: attempt.id }) })
    const data = await response.json()
    if (data.data) setResult(data.data)
  }, [attempt])

  const nextQuestion = useCallback(() => {
    if (!quiz) return
    setFeedback(null); answering.current = false
    if (index + 1 >= quiz.questions.length) { void finish(); return }
    setIndex(value => value + 1); setRemaining(quiz.time_limit_seconds); startedAt.current = Date.now()
  }, [quiz, index, finish])

  const answer = useCallback(async (selected: number | null) => {
    if (!quiz || !attempt || feedback || answering.current) return
    answering.current = true
    const question = quiz.questions[index]
    const responseMs = Math.min(quiz.time_limit_seconds * 1000, Date.now() - startedAt.current)
    try {
      const response = await fetch('/api/quiz-attempts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'answer', attempt_id: attempt.id, question_id: question.id, selected_index: selected, response_ms: responseMs }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setScore(value => value + data.points)
      setFeedback({ selected, correct: data.correct_index, isCorrect: data.data.is_correct, points: data.points, explanation: data.explanation })
      setTimeout(nextQuestion, 1500)
    } catch (err) { answering.current = false; setError(err instanceof Error ? err.message : 'Хариулт хадгалж чадсангүй') }
  }, [quiz, attempt, feedback, index, nextQuestion])

  useEffect(() => {
    if (!quiz || feedback || result) return
    const timer = setInterval(() => {
      const left = Math.max(0, quiz.time_limit_seconds - Math.floor((Date.now() - startedAt.current) / 1000))
      setRemaining(left)
      if (left === 0) { clearInterval(timer); void answer(null) }
    }, 250)
    return () => clearInterval(timer)
  }, [quiz, index, feedback, result, answer])

  if (error) return <div className="app-container"><div className="empty-state card"><h2>Асуумж нээж чадсангүй</h2><p>{error}</p><button className="btn-secondary" onClick={() => router.push('/')}>Буцах</button></div></div>
  if (result) return <ResultView result={result} onDone={() => router.push('/leaderboard')} />
  if (!quiz || !attempt) return <div className="empty-state"><span className="spinner" />Асуумж бэлдэж байна...</div>

  const question = quiz.questions[index]
  const progress = (index / quiz.questions.length) * 100
  return <div className="quiz-screen page-enter">
    <header className="quiz-top"><div><span className="eyebrow">{quiz.title}</span><strong>{index + 1} / {quiz.questions.length}</strong></div><div className={`timer-ring ${remaining <= 10 ? 'urgent' : ''}`}><span>{remaining}</span><small>сек</small></div></header>
    <div className="timer-track"><span style={{ width: `${(remaining / quiz.time_limit_seconds) * 100}%` }} /></div>
    <main className="question-card">
      {question.image_url && <div className="question-image"><Image src={question.image_url} alt="Асуултын зураг" fill sizes="(max-width: 700px) 100vw, 700px" style={{ objectFit: 'cover' }} /></div>}
      <span className="question-number">АСУУЛТ {index + 1}</span><h1>{question.text}</h1>
      <div className="answer-list">{question.options.map((option, optionIndex) => {
        let state = ''
        if (feedback) {
          if (optionIndex === feedback.correct) state = 'correct'
          else if (optionIndex === feedback.selected) state = 'wrong'
          else state = 'dimmed'
        }
        return <button key={optionIndex} disabled={!!feedback} className={`answer-button ${state}`} onClick={() => answer(optionIndex)}><span>{String.fromCharCode(65 + optionIndex)}</span><strong>{option.text}</strong>{state === 'correct' && <Icon name="check" />}</button>
      })}</div>
      {feedback?.isCorrect && <div className="confetti-burst" aria-hidden="true">{Array.from({ length: 12 }).map((_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}</div>}
      {feedback && <div className={`feedback-panel ${feedback.isCorrect ? 'correct' : 'wrong'}`}><strong>{feedback.isCorrect ? `Зөв · +${feedback.points} оноо` : 'Буруу хариулт'}</strong>{feedback.explanation && <p>{feedback.explanation}</p>}</div>}
    </main>
    <div className="quiz-progress"><span style={{ width: `${progress}%` }} /></div>
  </div>
}

function ResultView({ result, onDone }: { result: QuizAttempt; onDone: () => void }) {
  const percent = result.max_score ? Math.round(result.score / result.max_score * 100) : 0
  return <div className="app-container result-page page-enter"><div className="result-mark"><Icon name="check" size={42} /></div><span className="eyebrow">АСУУМЖ ДУУССАН</span><h1>{result.score.toLocaleString()} оноо</h1><p>Боломжит онооны {percent}%</p><div className="result-grid"><div><small>Зөв</small><strong>{result.correct_count}</strong></div><div><small>Алдсан</small><strong>{result.wrong_count}</strong></div><div><small>Хугацаа</small><strong>{result.total_time_seconds} сек</strong></div></div><button className="btn-primary" onClick={onDone}>Өнөөдрийн rank харах</button></div>
}

export default function QuizPage() { return <Suspense fallback={<div className="empty-state">Ачааллаж байна...</div>}><QuizRunner /></Suspense> }
