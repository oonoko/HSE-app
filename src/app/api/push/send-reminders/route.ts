import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush, isGoneError } from '@/lib/push'
import { mongoliaDate, mongoliaTime } from '@/lib/date'
import { nextAttemptState, type AttemptLite } from '@/lib/training'

export async function GET(req: NextRequest) {
  try {
    if (process.env.CRON_SECRET) {
      const auth = req.headers.get('authorization')
      if (auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Хандах эрхгүй' }, { status: 401 })
    }
    const supabase = createAdminClient()
    const date = mongoliaDate()
    const time = mongoliaTime()

    const { data: quizzes, error: quizError } = await supabase.from('daily_quizzes').select('*').eq('active_date', date).in('status', ['scheduled', 'active'])
    if (quizError) throw quizError
    const openQuizzes = (quizzes ?? []).filter(q => q.start_time.slice(0, 5) <= time && q.end_time.slice(0, 5) >= time)
    if (openQuizzes.length === 0) return NextResponse.json({ data: { quizzes_checked: 0, drivers_notified: 0 } })

    const { data: drivers, error: driversError } = await supabase.from('users').select('id, shift_number').eq('role', 'driver')
    if (driversError) throw driversError

    const quizIds = openQuizzes.map(q => q.id)
    const [{ data: roster, error: rosterError }, { data: attempts, error: attemptsError }] = await Promise.all([
      supabase.from('quiz_attendees').select('quiz_id, user_id, attempts_bonus').in('quiz_id', quizIds),
      supabase.from('quiz_attempts').select('quiz_id, user_id, id, attempt_number, completed, passed').in('quiz_id', quizIds),
    ])
    if (rosterError) throw rosterError
    if (attemptsError) throw attemptsError

    const pendingUserIds = new Set<string>()
    for (const quiz of openQuizzes) {
      const quizRoster = (roster ?? []).filter(row => row.quiz_id === quiz.id)
      const bonusOf = new Map(quizRoster.map(row => [row.user_id, row.attempts_bonus ?? 0]))
      const audience = quizRoster.length > 0
        ? (drivers ?? []).filter(driver => bonusOf.has(driver.id))
        : (drivers ?? []).filter(driver => !quiz.target_shift || driver.shift_number === quiz.target_shift)
      for (const driver of audience) {
        const mine = (attempts ?? []).filter(attempt => attempt.quiz_id === quiz.id && attempt.user_id === driver.id) as AttemptLite[]
        const state = nextAttemptState({ pass_percent: quiz.pass_percent ?? null, max_attempts: quiz.max_attempts ?? 1 }, mine, bonusOf.get(driver.id) ?? 0)
        if (state.kind === 'new' || state.kind === 'resume') pendingUserIds.add(driver.id)
      }
    }
    if (pendingUserIds.size === 0) return NextResponse.json({ data: { quizzes_checked: openQuizzes.length, drivers_notified: 0 } })

    const { data: subs, error: subsError } = await supabase.from('push_subscriptions').select('*').in('user_id', Array.from(pendingUserIds))
    if (subsError) throw subsError

    let sent = 0, removed = 0
    await Promise.all((subs ?? []).map(async sub => {
      try {
        await sendPush(sub, { title: 'HSE Safety', body: 'Өнөөдрийн мэдлэг шалгах асуумжаа өгөөрэй.', url: '/' })
        sent++
      } catch (err) {
        if (isGoneError(err)) { await supabase.from('push_subscriptions').delete().eq('id', sub.id); removed++ }
        else console.error('Push send failed:', err instanceof Error ? err.message : err)
      }
    }))

    return NextResponse.json({ data: { quizzes_checked: openQuizzes.length, drivers_pending: pendingUserIds.size, subscriptions_sent: sent, subscriptions_removed: removed } })
  } catch (error) {
    console.error('Send reminders failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Сануулга илгээж чадсангүй' }, { status: 500 })
  }
}
