import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession, requireAdmin } from '@/lib/session'

async function getReport(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const gameId = searchParams.get('game_id')
  if (!gameId) return NextResponse.json({ error: 'Тоглоомын ID шаардлагатай' }, { status: 400 })
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const shift = (!admin.is_super_admin && admin.shift_number) ? String(admin.shift_number) : searchParams.get('shift')
  const start = new Date(`${date}T00:00:00+08:00`).toISOString()
  const end = new Date(`${date}T23:59:59+08:00`).toISOString()
  const supabase = createAdminClient()

  let usersQuery = supabase.from('users').select('id, sap_id, name, shift_number').eq('role', 'driver')
  if (shift) usersQuery = usersQuery.eq('shift_number', Number(shift))
  const [{ data: game, error: gameError }, { data: users, error: usersError }, { data: attempts, error: attemptsError }] = await Promise.all([
    supabase.from('safety_games').select('id, title, template, category').eq('id', gameId).single(),
    usersQuery,
    supabase.from('game_attempts').select('*').eq('game_id', gameId).gte('played_at', start).lte('played_at', end),
  ])
  if (gameError) throw gameError
  if (usersError) throw usersError
  if (attemptsError) throw attemptsError

  const attemptByUser = new Map((attempts ?? []).map(a => [a.user_id, a]))
  const players = (users ?? [])
    .filter(u => attemptByUser.has(u.id))
    .map(u => ({ ...u, ...attemptByUser.get(u.id) }))
    .sort((a, b) => b.score - a.score)
  const missing = (users ?? []).filter(u => !attemptByUser.has(u.id))

  return NextResponse.json({ data: { game, date, shift: shift ? Number(shift) : null, players, missing } })
}

export async function GET(req: NextRequest) {
  try {
    if (new URL(req.url).searchParams.get('admin') === 'true') return await getReport(req)
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')
    if (session.role !== 'admin' && userId && userId !== session.id) return NextResponse.json({ error: 'Хандах эрхгүй' }, { status: 403 })
    const supabase = createAdminClient()
    let query = supabase.from('game_attempts').select('*, game:safety_games(title, template, category)').order('played_at', { ascending: false })
    if (userId) query = query.eq('user_id', userId)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Game attempts GET failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Тоглоомын түүх авч чадсангүй' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 })
    const body = await req.json()
    if (session.role !== 'admin' && body.user_id !== session.id) return NextResponse.json({ error: 'Хандах эрхгүй' }, { status: 403 })
    if (!body.game_id || !body.user_id) return NextResponse.json({ error: 'Тоглоом болон хэрэглэгч шаардлагатай' }, { status: 400 })
    const supabase = createAdminClient()
    const { data: game, error: gameError } = await supabase.from('safety_games').select('template, content, active').eq('id', body.game_id).single()
    if (gameError) throw gameError
    if (!game.active) return NextResponse.json({ error: 'Энэ тоглоом хаалттай байна' }, { status: 409 })
    const content = game.content as { items?: unknown[]; pairs?: unknown[]; grid?: number }
    const maxScore = game.template === 'puzzle'
      ? Math.min(16, Math.max(4, Math.pow(Number(content.grid) || 3, 2))) * 100
      : ((game.template === 'match' ? content.pairs : content.items)?.length ?? 0) * 100
    const score = Math.min(maxScore, Math.max(0, Math.round(Number(body.score) || 0)))
    const { data, error } = await supabase.from('game_attempts').insert({
      game_id: body.game_id,
      user_id: body.user_id,
      score,
      duration_seconds: Math.max(0, Math.round(Number(body.duration_seconds) || 0)),
    }).select('*').single()
    if (error) throw error
    const { data: user, error: userError } = await supabase.from('users').select('total_score').eq('id', body.user_id).single()
    if (userError) throw userError
    await supabase.from('users').update({ total_score: user.total_score + score, last_active: new Date().toISOString() }).eq('id', body.user_id)
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('Game attempts POST failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Тоглоомын оноо хадгалж чадсангүй' }, { status: 500 })
  }
}
