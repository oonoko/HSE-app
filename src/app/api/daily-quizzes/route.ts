import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { DailyQuizQuestion } from '@/types'
import { getSession, requireAdmin } from '@/lib/session'
import { mongoliaDate, mongoliaTime } from '@/lib/date'

function validateQuestions(questions: DailyQuizQuestion[]) {
  return Array.isArray(questions) && questions.length > 0 && questions.every(question =>
    question.id && question.text?.trim() && question.options?.length === 3 &&
    question.options.every(option => option.text?.trim()) &&
    Number.isInteger(question.correct_index) && question.correct_index >= 0 && question.correct_index <= 2
  )
}

function hideAnswers<T extends { questions?: DailyQuizQuestion[] }>(quiz: T) {
  return {
    ...quiz,
    questions: (quiz.questions ?? []).map(({ correct_index: _correctIndex, ...question }) => question),
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const admin = searchParams.get('admin') === 'true'
    const session = admin ? await requireAdmin() : await getSession()
    if (!session) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 })
    const date = admin ? searchParams.get('date') : mongoliaDate()
    const id = searchParams.get('id')
    const supabase = createAdminClient()

    let query = supabase.from('daily_quizzes').select('*').order('active_date', { ascending: false })
    if (id) query = query.eq('id', id)
    if (!admin) {
      query = query.eq('active_date', date || mongoliaDate()).in('status', ['scheduled', 'active'])
      query = session.shift_number
        ? query.or(`target_shift.is.null,target_shift.eq.${session.shift_number}`)
        : query.is('target_shift', null)
    }

    const { data, error } = await query
    if (error) throw error
    const currentTime = mongoliaTime()
    const available = admin ? data : (data ?? []).filter(quiz => quiz.start_time.slice(0, 5) <= currentTime && quiz.end_time.slice(0, 5) >= currentTime)
    return NextResponse.json({ data: admin ? available : (available ?? []).map(hideAnswers) })
  } catch (error) {
    console.error('Daily quizzes GET failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Асуумж авч чадсангүй' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
    const body = await req.json()
    if (!body.title?.trim() || !body.active_date || !validateQuestions(body.questions)) {
      return NextResponse.json({ error: 'Гарчиг, огноо болон бүрэн асуултууд шаардлагатай' }, { status: 400 })
    }
    const payload = {
      title: body.title.trim(),
      topic: body.topic?.trim() || null,
      active_date: body.active_date,
      start_time: body.start_time || '00:00',
      end_time: body.end_time || '23:59',
      time_limit_seconds: Math.min(60, Math.max(10, Number(body.time_limit_seconds) || 60)),
      target_shift: body.target_shift || null,
      status: body.status || 'scheduled',
      questions: body.questions,
      created_by: admin.id,
      updated_at: new Date().toISOString(),
    }
    const supabase = createAdminClient()
    const operation = body.id
      ? supabase.from('daily_quizzes').update(payload).eq('id', body.id)
      : supabase.from('daily_quizzes').insert(payload)
    const { data, error } = await operation.select('*').single()
    if (error) throw error
    return NextResponse.json({ data }, { status: body.id ? 200 : 201 })
  } catch (error) {
    console.error('Daily quizzes POST failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Асуумж хадгалж чадсангүй' }, { status: 500 })
  }
}
