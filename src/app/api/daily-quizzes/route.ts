import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { DailyQuizQuestion } from '@/types'
import { getSession, requireAdmin } from '@/lib/session'
import { mongoliaDate, mongoliaTime } from '@/lib/date'
import { DEFAULT_MAX_ATTEMPTS, pickFinalAttempts, summarizeAttempts, type AttemptLite } from '@/lib/training'
import { rethresholdAttempts, syncRoster } from '@/lib/quiz-finalize'

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

    let query = supabase.from('daily_quizzes').select(admin ? '*, quiz_attendees(user_id)' : '*').order('active_date', { ascending: false })
    if (id) query = query.eq('id', id)
    if (!admin) {
      query = query.eq('active_date', date || mongoliaDate()).in('status', ['scheduled', 'active'])
      query = session.shift_number
        ? query.or(`target_shift.is.null,target_shift.eq.${session.shift_number}`)
        : query.is('target_shift', null)
    } else if (!session.is_super_admin && session.shift_number) {
      query = query.or(`target_shift.is.null,target_shift.eq.${session.shift_number}`)
    }

    const { data, error } = await query
    if (error) throw error
    const quizzes = (data ?? []) as unknown as Array<Record<string, any>>

    if (admin) {
      return NextResponse.json({
        data: quizzes.map(({ quiz_attendees, ...quiz }) => ({ ...quiz, attendee_ids: ((quiz_attendees ?? []) as Array<{ user_id: string }>).map(row => row.user_id) })),
      })
    }

    const currentTime = mongoliaTime()
    const open = quizzes.filter(quiz => quiz.start_time.slice(0, 5) <= currentTime && quiz.end_time.slice(0, 5) >= currentTime)
    if (open.length === 0) return NextResponse.json({ data: [] })

    const quizIds = open.map(quiz => quiz.id)
    const [{ data: roster, error: rosterError }, { data: mine, error: mineError }] = await Promise.all([
      supabase.from('quiz_attendees').select('quiz_id, user_id, attempts_bonus').in('quiz_id', quizIds),
      supabase.from('quiz_attempts').select('id, quiz_id, user_id, attempt_number, completed, passed, score, max_score, correct_count, wrong_count').eq('user_id', session.id).in('quiz_id', quizIds),
    ])
    if (rosterError) throw rosterError
    if (mineError) throw mineError

    const visible = open
      .filter(quiz => {
        const rows = (roster ?? []).filter(row => row.quiz_id === quiz.id)
        return rows.length === 0 || rows.some(row => row.user_id === session.id)
      })
      .map(quiz => {
        const attempts = (mine ?? []).filter(attempt => attempt.quiz_id === quiz.id)
        const bonus = (roster ?? []).find(row => row.quiz_id === quiz.id && row.user_id === session.id)?.attempts_bonus ?? 0
        const summary = summarizeAttempts({ pass_percent: quiz.pass_percent ?? null, max_attempts: quiz.max_attempts ?? 1 }, attempts as AttemptLite[], bonus)
        const final = pickFinalAttempts(attempts)[0] ?? null
        return {
          ...hideAnswers(quiz as { questions?: DailyQuizQuestion[] }),
          my_status: {
            attempts_used: summary.used,
            attempts_allowed: summary.allowed,
            attempts_left: summary.left,
            passed: summary.passed,
            locked: summary.locked,
            in_progress: summary.inProgress,
            final: final && { score: final.score, max_score: final.max_score, correct_count: final.correct_count, wrong_count: final.wrong_count, passed: final.passed },
          },
        }
      })
    return NextResponse.json({ data: visible })
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

    const hasPassPercent = body.pass_percent !== null && body.pass_percent !== undefined && body.pass_percent !== ''
    const passPercent = hasPassPercent ? Math.round(Number(body.pass_percent)) : null
    if (passPercent !== null && !(passPercent >= 1 && passPercent <= 100)) {
      return NextResponse.json({ error: 'Тэнцэх хувь 1-100 хооронд байна' }, { status: 400 })
    }
    const maxAttempts = passPercent === null ? 1 : Math.min(10, Math.max(1, Math.round(Number(body.max_attempts) || DEFAULT_MAX_ATTEMPTS)))
    const attendeeIds: string[] = passPercent === null || !Array.isArray(body.attendee_ids)
      ? []
      : Array.from(new Set(body.attendee_ids.filter((value: unknown): value is string => typeof value === 'string')))

    const supabase = createAdminClient()
    let existing: { target_shift: number | null; pass_percent: number | null } | null = null
    if (body.id) {
      const { data, error } = await supabase.from('daily_quizzes').select('target_shift, pass_percent').eq('id', body.id).single()
      if (error) throw error
      existing = data
    }
    if (!admin.is_super_admin && admin.shift_number) {
      if (body.target_shift && Number(body.target_shift) !== admin.shift_number) {
        return NextResponse.json({ error: 'Зөвхөн өөрийн ээлжид зориулсан асуумж үүсгэнэ' }, { status: 403 })
      }
      if (existing && existing.target_shift !== admin.shift_number) {
        return NextResponse.json({ error: 'Зөвхөн өөрийн ээлжийн асуумжийг засна' }, { status: 403 })
      }
    }
    const payload = {
      title: body.title.trim(),
      topic: body.topic?.trim() || null,
      active_date: body.active_date,
      start_time: body.start_time || '00:00',
      end_time: body.end_time || '23:59',
      time_limit_seconds: Math.min(60, Math.max(10, Number(body.time_limit_seconds) || 60)),
      target_shift: (!admin.is_super_admin && admin.shift_number) ? admin.shift_number : (body.target_shift || null),
      status: body.status || 'scheduled',
      questions: body.questions,
      pass_percent: passPercent,
      max_attempts: maxAttempts,
      created_by: admin.id,
      updated_at: new Date().toISOString(),
    }
    const operation = body.id
      ? supabase.from('daily_quizzes').update(payload).eq('id', body.id)
      : supabase.from('daily_quizzes').insert(payload)
    const { data, error } = await operation.select('*').single()
    if (error) throw error

    await syncRoster(supabase, data.id, attendeeIds, admin)
    if (existing && existing.pass_percent !== passPercent) await rethresholdAttempts(supabase, data.id, passPercent)

    return NextResponse.json({ data }, { status: body.id ? 200 : 201 })
  } catch (error) {
    console.error('Daily quizzes POST failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Асуумж хадгалж чадсангүй' }, { status: 500 })
  }
}
