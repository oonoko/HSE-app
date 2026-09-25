import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { DailyQuizQuestion } from '@/types'
import { getSession } from '@/lib/session'
import { mongoliaDate, mongoliaTime } from '@/lib/date'
import { calculatePoints } from '@/lib/scoring'
import { isQuizOpenForDriver } from '@/lib/quiz-window'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')
    if (session.role !== 'admin' && userId && userId !== session.id) return NextResponse.json({ error: 'Хандах эрхгүй' }, { status: 403 })
    const quizId = searchParams.get('quiz_id')
    const supabase = createAdminClient()
    let query = supabase.from('quiz_attempts').select('*, quiz:daily_quizzes(title, topic, active_date), user:users(sap_id, name, shift_number)').order('started_at', { ascending: false })
    if (userId) query = query.eq('user_id', userId)
    if (quizId) query = query.eq('quiz_id', quizId)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Quiz attempts GET failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Шалгалтын түүх авч чадсангүй' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 })
    const body = await req.json()
    const supabase = createAdminClient()

    if (body.action === 'start') {
      if (session.role !== 'admin' && body.user_id !== session.id) return NextResponse.json({ error: 'Хандах эрхгүй' }, { status: 403 })
      const { data: quiz, error: quizError } = await supabase.from('daily_quizzes').select('*').eq('id', body.quiz_id).single()
      if (quizError) throw quizError
      if (session.role !== 'admin') {
        const allowed = isQuizOpenForDriver(quiz, { date: mongoliaDate(), time: mongoliaTime(), shiftNumber: session.shift_number })
        if (!allowed) return NextResponse.json({ error: 'Энэ асуумж одоо ажиллахгүй байна' }, { status: 403 })
      }
      const { data: existing, error: existingError } = await supabase.from('quiz_attempts').select('*').eq('quiz_id', body.quiz_id).eq('user_id', body.user_id).maybeSingle()
      if (existingError) throw existingError
      const safeQuiz = { ...quiz, questions: (quiz.questions as DailyQuizQuestion[]).map(({ correct_index: _correctIndex, ...question }) => question) }
      if (existing?.completed) return NextResponse.json({ data: existing, completed: true })
      if (existing) {
        const { data: answers } = await supabase.from('quiz_answers').select('question_id').eq('attempt_id', existing.id)
        return NextResponse.json({ data: existing, quiz: safeQuiz, answered_question_ids: (answers ?? []).map(item => item.question_id) })
      }
      const { data, error } = await supabase.from('quiz_attempts').insert({ quiz_id: body.quiz_id, user_id: body.user_id }).select('*').single()
      if (error) throw error
      return NextResponse.json({ data, quiz: safeQuiz, answered_question_ids: [] }, { status: 201 })
    }

    if (body.action === 'answer') {
      const { data: attempt, error: attemptError } = await supabase.from('quiz_attempts').select('*, quiz:daily_quizzes(*)').eq('id', body.attempt_id).single()
      if (attemptError) throw attemptError
      if (session.role !== 'admin' && attempt.user_id !== session.id) return NextResponse.json({ error: 'Хандах эрхгүй' }, { status: 403 })
      if (attempt.completed) return NextResponse.json({ error: 'Асуумж аль хэдийн дууссан' }, { status: 409 })
      const questions = attempt.quiz.questions as DailyQuizQuestion[]
      const question = questions.find(item => item.id === body.question_id)
      if (!question) return NextResponse.json({ error: 'Асуулт олдсонгүй' }, { status: 404 })
      const selectedIndex = body.selected_index === null ? null : Number(body.selected_index)
      const responseMs = Math.max(0, Math.min(Number(body.response_ms) || 0, attempt.quiz.time_limit_seconds * 1000))
      const isCorrect = selectedIndex === question.correct_index
      const timeLimitMs = attempt.quiz.time_limit_seconds * 1000
      const points = calculatePoints(isCorrect, responseMs, timeLimitMs)
      const { data, error } = await supabase.from('quiz_answers').insert({
        attempt_id: body.attempt_id,
        question_id: body.question_id,
        selected_index: selectedIndex,
        is_correct: isCorrect,
        response_ms: responseMs,
        points,
      }).select('*').single()
      if (error?.code === '23505') return NextResponse.json({ error: 'Энэ асуултад аль хэдийн хариулсан' }, { status: 409 })
      if (error) throw error
      return NextResponse.json({ data, correct_index: question.correct_index, explanation: question.explanation || '', points })
    }

    if (body.action === 'complete') {
      const { data: attempt, error: attemptError } = await supabase.from('quiz_attempts').select('*, quiz:daily_quizzes(questions)').eq('id', body.attempt_id).single()
      if (attemptError) throw attemptError
      if (session.role !== 'admin' && attempt.user_id !== session.id) return NextResponse.json({ error: 'Хандах эрхгүй' }, { status: 403 })
      if (attempt.completed) return NextResponse.json({ data: attempt })
      const { data: answers, error: answersError } = await supabase.from('quiz_answers').select('*').eq('attempt_id', body.attempt_id)
      if (answersError) throw answersError
      const score = (answers ?? []).reduce((sum, answer) => sum + answer.points, 0)
      const correctCount = (answers ?? []).filter(answer => answer.is_correct).length
      const totalQuestions = (attempt.quiz.questions as DailyQuizQuestion[]).length
      const totalMs = (answers ?? []).reduce((sum, answer) => sum + answer.response_ms, 0)
      const { data, error } = await supabase.from('quiz_attempts').update({
        score,
        max_score: totalQuestions * 100,
        correct_count: correctCount,
        wrong_count: totalQuestions - correctCount,
        total_time_seconds: Math.round(totalMs / 1000),
        completed: true,
        completed_at: new Date().toISOString(),
      }).eq('id', body.attempt_id).select('*').single()
      if (error) throw error
      const { data: user, error: userError } = await supabase.from('users').select('total_score').eq('id', attempt.user_id).single()
      if (userError) throw userError
      await supabase.from('users').update({ total_score: user.total_score + score, last_active: new Date().toISOString() }).eq('id', attempt.user_id)
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Үйлдэл буруу байна' }, { status: 400 })
  } catch (error) {
    console.error('Quiz attempts POST failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Асуумжийн явц хадгалж чадсангүй' }, { status: 500 })
  }
}
