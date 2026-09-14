import { NextRequest, NextResponse } from 'next/server'
import { getUserById } from '@/lib/mock-data'
import { createAdminClient } from '@/lib/supabase/admin'
import { scryptSync, timingSafeEqual } from 'crypto'
import { attachSession, clearSession } from '@/lib/session'

const failedAttempts = new Map<string, { count: number; blockedUntil: number }>()

function verifyAdminPin(pin: string) {
  const salt = process.env.ADMIN_PIN_SALT
  const expectedHex = process.env.ADMIN_PIN_HASH
  if (!salt || !expectedHex) return false
  const actual = scryptSync(pin, salt, 64)
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function POST(req: NextRequest) {
  try {
    const { sap_id, pin, lookup, confirm } = await req.json()
    const normalizedSapId = String(sap_id ?? '').trim()

    if (!normalizedSapId) {
      return NextResponse.json({ error: 'SAP ID шаардлагатай' }, { status: 400 })
    }

    const isMock = process.env.NEXT_PUBLIC_MOCK_MODE === 'true'

    if (isMock) {
      const user = getUserById(normalizedSapId)
      if (!user) {
        return NextResponse.json({ error: 'SAP ID олдсонгүй' }, { status: 401 })
      }
      return attachSession(NextResponse.json({ user }), user)
    }

    const supabase = createAdminClient()
    const { data: user, error } = await supabase
      .from('users')
      .select('id, sap_id, name, name_en, department, department_en, location_id, role, total_score, avatar_url, created_at, last_active, shift_number, is_super_admin')
      .eq('sap_id', normalizedSapId)
      .maybeSingle()

    if (error) {
      console.error('Supabase auth lookup failed:', error.message)
      return NextResponse.json({ error: 'Өгөгдлийн сантай холбогдож чадсангүй' }, { status: 500 })
    }

    if (!user) {
      return NextResponse.json({ error: 'SAP ID олдсонгүй' }, { status: 401 })
    }

    if (lookup) return NextResponse.json({ user, requires_pin: user.role === 'admin' })

    if (user.role === 'admin') {
      if (!pin) return NextResponse.json({ user, requires_pin: true })
      const state = failedAttempts.get(normalizedSapId)
      if (state?.blockedUntil && state.blockedUntil > Date.now()) {
        return NextResponse.json({ error: 'Олон удаа буруу оролдлоо. 15 минутын дараа дахин оролдоно уу.' }, { status: 429 })
      }
      if (!verifyAdminPin(String(pin))) {
        const count = (state?.count ?? 0) + 1
        failedAttempts.set(normalizedSapId, { count, blockedUntil: count >= 5 ? Date.now() + 15 * 60 * 1000 : 0 })
        return NextResponse.json({ error: 'PIN буруу байна' }, { status: 401 })
      }
      failedAttempts.delete(normalizedSapId)
    }

    if (user.role !== 'admin' && !confirm) return NextResponse.json({ user, requires_pin: false })
    return attachSession(NextResponse.json({ user, requires_pin: false }), user)
  } catch (error) {
    console.error('Auth route error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Supabase тохиргоо дутуу байна' }, { status: 500 })
  }
}

export async function DELETE() {
  return clearSession(NextResponse.json({ ok: true }))
}
