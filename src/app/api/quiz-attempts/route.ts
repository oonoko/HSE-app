import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { DailyQuizQuestion } from '@/types'
import { getSession } from '@/lib/session'
import { mongoliaDate, mongoliaTime } from '@/lib/date'
import { calculatePoints } from '@/lib/scoring'
import { isQuizOpenForDriver } from '@/lib/quiz-window'
import { isTrainingQuiz, nextAttemptState, summarizeAttempts, type AttemptLite } from '@/lib/training'
import { finalizeAttempt } from '@/lib/quiz-finalize'

type Supabase = ReturnType<typeof createAdminClient>
type QuizRow = { id: string; title: string; pass_percent?: number | null; max_attempts?: number | null; questions: DailyQuizQuestion[]; [key: string]: unknown }

function rulesOf(quiz: QuizRow) {
  return { pass_percent: quiz.pass_percent ?? null, max_attempts: quiz.max_attempts ?? 1 }
}

function metaOf(quiz: QuizRow, attempts: AttemptLite[], bonus: number) {
  const summary = summarizeAttempts(rulesOf(quiz), attempts, bonus)
  return {
    title: quiz.title,
    training: isTrainingQuiz(rulesOf(quiz)),
    pass_percent: quiz.pass_percent ?? null,
    attempts_used: summary.used,
    attempts_allowed: summary.allowed,
    attempts_left: summary.left,
    passed: summary.passed,
    locked: summary.locked,
  }
}

async function loadRosterBonus(supabase: Supabase, quizId: string, userId: string) {
  const { data, error } = await supabase.from('quiz_attendees').select('user_id, attempts_bonus').eq('quiz_id', quizId)
  if (error) throw error
  const roster = data ?? []
  const mine = roster.find(row => row.user_id === userId)
  return { restricted: roster.length > 0, listed: !!mine, bonus: mine?.attempts_bonus ?? 0 }
}

async function loadAttempts(supabase: Supabase, quizId: string, userId: string) {
  const { data, error } = await supabase.from('quiz_attempts').select('*').eq('quiz_id', quizId).eq('user_id', userId).order('attempt_number')
  if (error) throw error
  return data ?? []
}

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
      const roster = await loadRosterBonus(supabase, quiz.id, body.user_id)
      if (session.role !== 'admin' && roster.restricted && !roster.listed) {
        return NextResponse.json({ error: 'Та энэ сургалтын ирцэнд бүртгэгдээгүй байна' }, { status: 403 })
      }

      const safeQuiz = { ...quiz, questions: (quiz.questions as DailyQuizQuestion[]).map(({ correct_index: _correctIndex, ...question }) => question) }

      for (let pass = 0; pass < 2; pass++) {
        const attempts = await loadAttempts(supabase, quiz.id, body.user_id)
        const state = nextAttemptState(rulesOf(quiz), attempts as AttemptLite[], roster.bonus)
        const meta = metaOf(quiz, attempts as AttemptLite[], roster.bonus)

        if (state.kind === 'locked') return NextResponse.json({ locked: true, meta })
        if (state.kind === 'passed' || state.kind === 'finished') {
          return NextResponse.json({ data: attempts.find(item => item.id === state.attempt.id), completed: true, meta })
        }
        if (state.kind === 'resume') {
          const { data: answers } = await supabase.from('quiz_answers').select('question_id').eq('attempt_id', state.attempt.id)
          return NextResponse.json({ data: attempts.find(item => item.id === state.attempt.id), quiz: safeQuiz, answered_question_ids: (answers ?? []).map(item => item.question_id), meta })
        }
        const { data, error } = await supabase.from('quiz_attempts').insert({ quiz_id: quiz.id, user_id: body.user_id, attempt_number: state.attemptNumber }).select('*').single()
        if (error?.code === '23505') continue
        if (error) throw error
        return NextResponse.json({ data, quiz: safeQuiz, answered_question_ids: [], meta }, { status: 201 })
      }
      return NextResponse.json({ error: 'Оролдлого эхлүүлж чадсангүй, дахин оролдоно уу' }, { status: 409 })
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
      if (isTrainingQuiz(rulesOf(attempt.quiz))) {
        // Pass/fail exam: don't reveal the key mid-attempt, otherwise a retake is just memorisation.
        return NextResponse.json({ hidden: true, recorded: true })
      }
      return NextResponse.json({ data, correct_index: question.correct_index, explanation: question.explanation || '', points })
    }

    if (body.action === 'complete') {
      const { data: attempt, error: attemptError } = await supabase.from('quiz_attempts').select('*, quiz:daily_quizzes(*)').eq('id', body.attempt_id).single()
      if (attemptError) throw attemptError
      if (session.role !== 'admin' && attempt.user_id !== session.id) return NextResponse.json({ error: 'Хандах эрхгүй' }, { status: 403 })
      const finished = attempt.completed ? attempt : await finalizeAttempt(supabase, body.attempt_id, { markCompleted: true })
      const roster = await loadRosterBonus(supabase, attempt.quiz_id, attempt.user_id)
      const attempts = await loadAttempts(supabase, attempt.quiz_id, attempt.user_id)
      return NextResponse.json({ data: finished, meta: metaOf(attempt.quiz, attempts as AttemptLite[], roster.bonus) })
    }

    return NextResponse.json({ error: 'Үйлдэл буруу байна' }, { status: 400 })
  } catch (error) {
    console.error('Quiz attempts POST failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Асуумжийн явц хадгалж чадсангүй' }, { status: 500 })
  }
}
