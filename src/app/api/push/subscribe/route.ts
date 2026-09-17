import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 })
    const body = await req.json()
    const endpoint = body?.endpoint
    const p256dh = body?.keys?.p256dh
    const auth = body?.keys?.auth
    if (!endpoint || !p256dh || !auth) return NextResponse.json({ error: 'Бүртгэлийн мэдээлэл дутуу байна' }, { status: 400 })
    const supabase = createAdminClient()
    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id: session.id, endpoint, p256dh, auth },
      { onConflict: 'endpoint' },
    )
    if (error) throw error
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('Push subscribe failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Бүртгэж чадсангүй' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 })
    const endpoint = new URL(req.url).searchParams.get('endpoint')
    if (!endpoint) return NextResponse.json({ error: 'endpoint шаардлагатай' }, { status: 400 })
    const supabase = createAdminClient()
    const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', session.id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Push unsubscribe failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Цуцлаж чадсангүй' }, { status: 500 })
  }
}
