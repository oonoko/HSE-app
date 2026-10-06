import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/session'
import { finalizeAttempt } from '@/lib/quiz-finalize'
import { isOverrideReason } from '@/lib/training'

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
    const body = await req.json()
    const clearing = body.correct === null
    if (!body.attempt_id || !body.question_id || (!clearing && typeof body.correct !== 'boolean')) {
      return NextResponse.json({ error: 'Мэдээлэл дутуу байна' }, { status: 400 })
    }
    if (!clearing && !isOverrideReason(body.reason)) {
      return NextResponse.json({ error: 'Засварын шалтгааныг сонгоно уу' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempts')
      .select('id, completed, user:users(shift_number)')
      .eq('id', body.attempt_id)
      .single()
    if (attemptError) throw attemptError
    const driverShift = (attempt.user as unknown as { shift_number: number | null } | null)?.shift_number ?? null
    if (!admin.is_super_admin && admin.shift_number && driverShift !== admin.shift_number) {
      return NextResponse.json({ error: 'Зөвхөн өөрийн ээлжийн жолоочийн хариултыг засна' }, { status: 403 })
    }
    if (!attempt.completed) return NextResponse.json({ error: 'Дуусаагүй оролдлогыг засах боломжгүй' }, { status: 409 })

    const { data: answer, error: answerError } = await supabase
      .from('quiz_answers')
      .select('id')
      .eq('attempt_id', body.attempt_id)
      .eq('question_id', body.question_id)
      .maybeSingle()
    if (answerError) throw answerError
    if (!answer) return NextResponse.json({ error: 'Энэ асуултад хариулт бүртгэгдээгүй байна' }, { status: 404 })

    const patch = clearing
      ? { override_correct: null, override_reason: null, overridden_by: null, overridden_at: null }
      : { override_correct: body.correct as boolean, override_reason: body.reason as string, overridden_by: admin.id, overridden_at: new Date().toISOString() }
    const { error: patchError } = await supabase.from('quiz_answers').update(patch).eq('id', answer.id)
    if (patchError) throw patchError

    const updated = await finalizeAttempt(supabase, body.attempt_id)
    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Answer override failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Хариултыг засаж чадсангүй' }, { status: 500 })
  }
}
