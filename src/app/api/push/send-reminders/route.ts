import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush, isGoneError } from '@/lib/push'
import { mongoliaDate, mongoliaTime } from '@/lib/date'

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
    const { data: attempts, error: attemptsError } = await supabase.from('quiz_attempts').select('user_id, quiz_id').in('quiz_id', quizIds).eq('completed', true)
    if (attemptsError) throw attemptsError
    const completedByQuiz = new Map<string, Set<string>>()
    for (const a of attempts ?? []) {
      if (!completedByQuiz.has(a.quiz_id)) completedByQuiz.set(a.quiz_id, new Set())
      completedByQuiz.get(a.quiz_id)!.add(a.user_id)
    }

    const pendingUserIds = new Set<string>()
    for (const quiz of openQuizzes) {
      const done = completedByQuiz.get(quiz.id) ?? new Set()
      for (const driver of drivers ?? []) {
        if (quiz.target_shift && driver.shift_number !== quiz.target_shift) continue
        if (!done.has(driver.id)) pendingUserIds.add(driver.id)
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
