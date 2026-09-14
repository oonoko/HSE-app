import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  try {
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
