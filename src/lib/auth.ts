'use client'

import type { User } from '@/types'

const STORAGE_KEY = 'hse_user'
const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === 'true'

// ============================================================
// Auth helpers (mock mode & production)
// ============================================================

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function storeUser(user: User): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

export function clearUser(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function isMockMode(): boolean {
  return MOCK_MODE
}
