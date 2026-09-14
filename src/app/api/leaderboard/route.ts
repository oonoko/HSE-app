import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/session'

function periodStart(period: string) {
  const mongoliaNow = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const year = mongoliaNow.getUTCFullYear()
  const month = String(mongoliaNow.getUTCMonth() + 1).padStart(2, '0')
  const day = String(mongoliaNow.getUTCDate()).padStart(2, '0')
  const localDate = period === 'month' ? `${year}-${month}-01` : `${year}-${month}-${day}`
  return new Date(`${localDate}T00:00:00+08:00`).toISOString()
}

export async function GET(req: NextRequest) {
  try {
    if (!await getSession()) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const currentUserId = searchParams.get('user_id')
    const period = searchParams.get('period') === 'month' ? 'month' : 'today'
    const shift = searchParams.get('shift')
    const start = periodStart(period)
    const supabase = createAdminClient()

    let usersQuery = supabase.from('users').select('id, sap_id, name, department, shift_number').eq('role', 'driver')
    if (shift) usersQuery = usersQuery.eq('shift_number', Number(shift))

    const [{ data: users, error: usersError }, { data: quizzes, error: quizError }, { data: games, error: gameError }] = await Promise.all([
      usersQuery,
      supabase.from('quiz_attempts').select('user_id, score').eq('completed', true).gte('completed_at', start),
      supabase.from('game_attempts').select('user_id, score').gte('played_at', start),
    ])
    if (usersError) throw usersError
    if (quizError) throw quizError
    if (gameError) throw gameError

    const scores: Record<string, { score: number; count: number }> = {}
    for (const attempt of [...(quizzes ?? []), ...(games ?? [])]) {
      scores[attempt.user_id] ??= { score: 0, count: 0 }
      scores[attempt.user_id].score += attempt.score
      scores[attempt.user_id].count += 1
    }

    const entries = (users ?? [])
      .map(user => ({
        user_id: user.id,
        sap_id: user.sap_id,
        name: user.name,
        department: user.department,
        shift_number: user.shift_number,
        total_score: scores[user.id]?.score ?? 0,
        sessions_completed: scores[user.id]?.count ?? 0,
        is_current_user: currentUserId === user.id,
      }))
      .sort((a, b) => b.total_score - a.total_score || a.name.localeCompare(b.name))
      .map((entry, index) => ({ ...entry, rank: index + 1 }))

    return NextResponse.json({ data: entries, period, start })
  } catch (error) {
    console.error('Leaderboard GET failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Онооны мэдээлэл авч чадсангүй' }, { status: 500 })
  }
}
