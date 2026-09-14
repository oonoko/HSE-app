import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'
import type { UserRole } from '@/types'

export type SessionUser = { id: string; sap_id: string; role: UserRole; is_super_admin?: boolean; shift_number?: number | null }
const COOKIE_NAME = 'hse_session'
const MAX_AGE = 60 * 60 * 12

function secret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ADMIN_PIN_HASH || 'hse-local-development'
}
function sign(value: string) { return createHmac('sha256', secret()).update(value).digest('base64url') }
function encode(user: SessionUser) {
  const body = Buffer.from(JSON.stringify({ ...user, is_super_admin: !!user.is_super_admin, exp: Date.now() + MAX_AGE * 1000 })).toString('base64url')
  return `${body}.${sign(body)}`
}
function decode(token?: string): SessionUser | null {
  if (!token) return null
  try {
    const [body, signature] = token.split('.')
    if (!body || !signature) return null
    const expected = Buffer.from(sign(body)); const actual = Buffer.from(signature)
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (!payload.exp || payload.exp < Date.now()) return null
    return { id: payload.id, sap_id: payload.sap_id, role: payload.role, is_super_admin: !!payload.is_super_admin, shift_number: payload.shift_number }
  } catch { return null }
}
export function attachSession(response: NextResponse, user: SessionUser) {
  response.cookies.set(COOKIE_NAME, encode(user), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: MAX_AGE })
  return response
}
export function clearSession(response: NextResponse) { response.cookies.set(COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 }); return response }
export async function getSession() { return decode((await cookies()).get(COOKIE_NAME)?.value) }
export async function requireAdmin() { const session = await getSession(); return session?.role === 'admin' ? session : null }
export async function requireSuperAdmin() { const session = await requireAdmin(); return session?.is_super_admin ? session : null }
