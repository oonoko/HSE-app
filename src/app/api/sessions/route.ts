import { NextRequest, NextResponse } from 'next/server'
import { getUserSessions } from '@/lib/mock-data'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const all = searchParams.get('all') === 'true'

  if (!userId && !all) {
    return NextResponse.json({ error: 'user_id шаардлагатай' }, { status: 400 })
  }

  const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true'

  if (isMock) {
    if (all) {
      const { MOCK_SESSIONS } = await import('@/lib/mock-data')
      return NextResponse.json({ data: MOCK_SESSIONS })
    }
    const sessions = getUserSessions(userId!)
    return NextResponse.json({ data: sessions })
  }

  try {
    const supabase = createAdminClient()
    let query = supabase
      .from('daily_sessions')
      .select('*, image:hazard_images(*, location:locations(*))')
      .order('date', { ascending: false })

    if (userId) query = query.eq('user_id', userId)
    const { data, error } = await query

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Sessions GET failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Сургалтын түүх авч чадсангүй' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_id, image_id, score, completed } = body

    if (!user_id || !image_id) {
      return NextResponse.json({ error: 'user_id болон image_id шаардлагатай' }, { status: 400 })
    }

    const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true'
    if (isMock) {
      const session = {
        id: `session-${Date.now()}`,
        user_id, image_id, score: score ?? 0,
        completed: completed ?? false,
        date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
      }
      return NextResponse.json({ data: session })
    }

    const supabase = createAdminClient()
    const date = body.date ?? new Date().toISOString().split('T')[0]
    const { data: existing, error: lookupError } = await supabase
      .from('daily_sessions')
      .select('*')
      .eq('user_id', user_id)
      .eq('image_id', image_id)
      .eq('date', date)
      .maybeSingle()
    if (lookupError) throw lookupError

    let session
    if (existing) {
      const { data, error } = await supabase
        .from('daily_sessions')
        .update({
          score: score ?? existing.score,
          completed: completed ?? existing.completed,
          completed_at: completed ? new Date().toISOString() : existing.completed_at,
        })
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error) throw error
      session = data
    } else {
      const { data: created, error: createError } = await supabase
        .from('daily_sessions')
        .insert({ user_id, image_id, date, score: 0, completed: false })
        .select('*')
        .single()
      if (createError) throw createError

      if (completed) {
        const { data, error } = await supabase
          .from('daily_sessions')
          .update({ score: score ?? 0, completed: true, completed_at: new Date().toISOString() })
          .eq('id', created.id)
          .select('*')
          .single()
        if (error) throw error
        session = data
      } else {
        session = created
      }
    }

    return NextResponse.json({ data: session })
  } catch (error) {
    console.error('Sessions POST failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
