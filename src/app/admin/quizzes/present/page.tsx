'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useApp } from '@/lib/context'
import type { DailyQuiz } from '@/types'

function Presentation() {
  const { user, ready, isAdmin } = useApp(); const router = useRouter(); const quizId = useSearchParams().get('id')
  const [quiz, setQuiz] = useState<DailyQuiz | null>(null); const [index, setIndex] = useState(0); const [revealed, setRevealed] = useState(false); const [error, setError] = useState('')
  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    if (!isAdmin || !quizId) { router.push('/admin/quizzes'); return }
    fetch(`/api/daily-quizzes?admin=true&id=${quizId}`).then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); setQuiz(result.data?.[0] ?? null) }).catch(err => setError(err instanceof Error ? err.message : 'Асуумж нээж чадсангүй'))
  }, [ready, user, isAdmin, quizId, router])
  useEffect(() => {
    function keys(event: KeyboardEvent) {
      if (!quiz) return
      if (event.key === 'ArrowRight' && index < quiz.questions.length - 1) { setIndex(value => value + 1); setRevealed(false) }
      if (event.key === 'ArrowLeft' && index > 0) { setIndex(value => value - 1); setRevealed(false) }
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setRevealed(value => !value) }
      if (event.key === 'Escape' && !document.fullscreenElement) router.push('/admin/quizzes')
    }
    window.addEventListener('keydown', keys); return () => window.removeEventListener('keydown', keys)
  }, [quiz, index, router])
  if (error) return <div className="present-loading"><h1>{error}</h1><button onClick={() => router.push('/admin/quizzes')}>Буцах</button></div>
  if (!quiz) return <div className="present-loading"><span className="spinner"/></div>
  const question = quiz.questions[index]
  const questionCount = quiz.questions.length
  function move(direction: number) { const next = index + direction; if (next >= 0 && next < questionCount) { setIndex(next); setRevealed(false) } }
  return <main className="presentation-screen"><div className={`presentation-question ${question.image_url ? 'with-image' : ''}`}>{question.image_url && <div className="presentation-image"><Image src={question.image_url} alt="Асуултын зураг" fill sizes="55vw" style={{objectFit:'contain'}} priority/></div>}<section><h1>{question.text}</h1><div className="presentation-options">{question.options.map((option, optionIndex) => <div className={revealed && optionIndex === question.correct_index ? 'correct' : ''} key={optionIndex}><span>{String.fromCharCode(65 + optionIndex)}</span><strong>{option.text}</strong></div>)}</div></section></div><div className="presentation-controls"><button onClick={() => router.push('/admin/quizzes')}>Гарах</button><button disabled={index===0} onClick={()=>move(-1)}>Өмнөх</button><span>{index+1} / {quiz.questions.length}</span><button className={revealed?'revealed':''} onClick={()=>setRevealed(!revealed)}>{revealed?'Зөв хариуг нуух':'Зөв хариуг харуулах'}</button><button disabled={index===quiz.questions.length-1} onClick={()=>move(1)}>Дараах</button><button onClick={()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}>Бүтэн дэлгэц</button></div></main>
}

export default function PresentationPage(){ return <Suspense fallback={<div className="present-loading"><span className="spinner"/></div>}><Presentation/></Suspense> }
