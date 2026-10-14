import { NextRequest, NextResponse } from 'next/server'
import { getUserById } from '@/lib/mock-data'
import { createAdminClient } from '@/lib/supabase/admin'
import { scryptSync, timingSafeEqual } from 'crypto'
import { attachSession, clearSession } from '@/lib/session'
import { GUEST_DEPARTMENT, cleanNamePart, guestFullName, validNamePart, validSapNumber } from '@/lib/guest'

const failedAttempts = new Map<string, { count: number; blockedUntil: number }>()
// Best-effort throttle on guest sign-ups per client (resets when the serverless instance recycles).
const guestSignups = new Map<string, { count: number; resetAt: number }>()
const GUEST_LIMIT = 5
const GUEST_WINDOW_MS = 60 * 60 * 1000

function clientKey(req: NextRequest) {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
}

const USER_COLUMNS = 'id, sap_id, name, name_en, department, department_en, location_id, role, total_score, avatar_url, created_at, last_active, shift_number, is_super_admin'

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
    const { sap_id, pin, lookup, confirm, register_guest, first_name, last_name } = await req.json()
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

    if (register_guest) {
      const lastName = cleanNamePart(last_name), firstName = cleanNamePart(first_name)
      if (!validSapNumber(normalizedSapId)) return NextResponse.json({ error: 'SAP дугаар буруу байна' }, { status: 400 })
      if (!validNamePart(lastName) || !validNamePart(firstName)) return NextResponse.json({ error: 'Овог, нэрээ үсгээр зөв оруулна уу' }, { status: 400 })
      const key = clientKey(req)
      const window = guestSignups.get(key)
      if (window && window.resetAt > Date.now() && window.count >= GUEST_LIMIT) return NextResponse.json({ error: 'Олон удаа бүртгүүллээ. Түр хүлээгээд дахин оролдоно уу.' }, { status: 429 })
      const { data: taken, error: takenError } = await supabase.from('users').select('id').eq('sap_id', normalizedSapId).maybeSingle()
      if (takenError) throw takenError
      if (taken) return NextResponse.json({ error: 'Энэ SAP дугаар аль хэдийн бүртгэлтэй байна. Дахин нэвтэрч үзнэ үү.' }, { status: 409 })
      const { data: created, error: createError } = await supabase.from('users')
        .insert({ sap_id: normalizedSapId, name: guestFullName(lastName, firstName), department: GUEST_DEPARTMENT, role: 'driver', shift_number: null })
        .select(USER_COLUMNS).single()
      if (createError) {
        if ((createError as { code?: string }).code === '23505') return NextResponse.json({ error: 'Энэ SAP дугаар аль хэдийн бүртгэлтэй байна. Дахин нэвтэрч үзнэ үү.' }, { status: 409 })
        throw createError
      }
      guestSignups.set(key, window && window.resetAt > Date.now() ? { count: window.count + 1, resetAt: window.resetAt } : { count: 1, resetAt: Date.now() + GUEST_WINDOW_MS })
      return attachSession(NextResponse.json({ user: created, requires_pin: false, guest: true }, { status: 201 }), created)
    }

    const { data: user, error } = await supabase
      .from('users')
      .select(USER_COLUMNS)
      .eq('sap_id', normalizedSapId)
      .maybeSingle()

    if (error) {
      console.error('Supabase auth lookup failed:', error.message)
      return NextResponse.json({ error: 'Өгөгдлийн сантай холбогдож чадсангүй' }, { status: 500 })
    }

    if (!user) {
      return NextResponse.json({ error: 'SAP ID олдсонгүй', not_found: true }, { status: 401 })
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
