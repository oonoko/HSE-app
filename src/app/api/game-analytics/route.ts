import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/session'
import { generateCrossword } from '@/lib/crossword'
import { analyzeGame, type GameAttemptLite } from '@/lib/game-analytics'
import { SHIFT_NUMBERS } from '@/lib/shifts'

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
    const { searchParams } = new URL(req.url)
    const gameId = searchParams.get('game_id')
    if (!gameId) return NextResponse.json({ error: 'Тоглоомын ID шаардлагатай' }, { status: 400 })
    const requested = Number(searchParams.get('shift')) || null
    if (requested && !SHIFT_NUMBERS.includes(requested as typeof SHIFT_NUMBERS[number])) return NextResponse.json({ error: 'Ээлж буруу байна' }, { status: 400 })
    const shift = !admin.is_super_admin && admin.shift_number ? admin.shift_number : requested
    const supabase = createAdminClient()

    let driversQuery = supabase.from('users').select('id, sap_id, name, shift_number').eq('role', 'driver')
    if (shift) driversQuery = driversQuery.eq('shift_number', shift)
    const [{ data: game, error: gameError }, { data: drivers, error: driversError }] = await Promise.all([
      supabase.from('safety_games').select('id, title, template, category, content').eq('id', gameId).single(),
      driversQuery,
    ])
    if (gameError) throw gameError
    if (driversError) throw driversError

    // PostgREST returns at most 1000 rows per request, so read the attempts in pages.
    const attempts: GameAttemptLite[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('game_attempts').select('user_id, score, duration_seconds, played_at').eq('game_id', gameId).order('played_at').range(from, from + 999)
      if (error) throw error
      attempts.push(...(data ?? []))
      if ((data?.length ?? 0) < 1000) break
    }

    const content = game.content as { items?: unknown[]; pairs?: unknown[]; words?: { word: string; clue: string }[] }
    const maxScore = game.template === 'word_grid'
      ? generateCrossword(content.words ?? []).placed.length * 100
      : ((game.template === 'match' ? content.pairs : content.items)?.length ?? 0) * 100

    return NextResponse.json({ data: { game: { id: game.id, title: game.title, template: game.template, category: game.category }, shift, ...analyzeGame(attempts, drivers ?? [], maxScore || null) } })
  } catch (error) {
    console.error('Game analytics failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Шинжилгээ авч чадсангүй' }, { status: 500 })
  }
}
