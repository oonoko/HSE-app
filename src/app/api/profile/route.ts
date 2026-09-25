import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 })
    const userId = new URL(req.url).searchParams.get('user_id')
    if (!userId) return NextResponse.json({ error: 'user_id шаардлагатай' }, { status: 400 })
    if (session.role !== 'admin' && userId !== session.id) return NextResponse.json({ error: 'Хандах эрхгүй' }, { status: 403 })
    const supabase = createAdminClient()
    if (session.role === 'admin' && !session.is_super_admin && userId !== session.id && session.shift_number) {
      const { data: target, error: targetError } = await supabase.from('users').select('shift_number').eq('id', userId).single()
      if (targetError) throw targetError
      if (target.shift_number !== session.shift_number) return NextResponse.json({ error: 'Зөвхөн өөрийн ээлжийн жолоочийг харна' }, { status: 403 })
    }
    const [{ data: user, error: userError }, { data: quizzes, error: quizError }, { data: games, error: gameError }, { data: drivers, error: driversError }] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).single(),
      supabase.from('quiz_attempts').select('*, quiz:daily_quizzes(title, topic, active_date)').eq('user_id', userId).eq('completed', true).order('completed_at', { ascending: false }),
      supabase.from('game_attempts').select('*, game:safety_games(title, template, category)').eq('user_id', userId).order('played_at', { ascending: false }),
      supabase.from('users').select('id, total_score, shift_number').eq('role', 'driver').order('total_score', { ascending: false }),
    ])
    if (userError) throw userError
    if (quizError) throw quizError
    if (gameError) throw gameError
    if (driversError) throw driversError
    const allDrivers = drivers ?? []
    const rank = allDrivers.findIndex(item => item.id === userId) + 1
    const shiftDrivers = allDrivers.filter(item => item.shift_number === user.shift_number)
    const shiftRank = shiftDrivers.findIndex(item => item.id === userId) + 1
    return NextResponse.json({
      data: {
        user,
        quiz_attempts: quizzes ?? [],
        game_attempts: games ?? [],
        rank: rank || null,
        shift_rank: shiftRank || null,
        total_drivers: allDrivers.length,
        shift_drivers: shiftDrivers.length,
      },
    })
  } catch (error) {
    console.error('Profile GET failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Профайлын мэдээлэл авч чадсангүй' }, { status: 500 })
  }
}
