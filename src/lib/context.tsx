'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { User } from '@/types'
import type { Lang } from '@/lib/i18n'
import { getStoredUser, storeUser, clearUser } from '@/lib/auth'
import { getStoredLang, setStoredLang, UI_TEXT } from '@/lib/i18n'

interface AppContextValue {
  user: User | null
  ready: boolean
  lang: Lang
  isAdmin: boolean
  uiText: typeof UI_TEXT['mn']
  login: (user: User) => void
  logout: () => void
  toggleLang: () => void
  notification: string | null
  showNotification: (msg: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [lang, setLang] = useState<Lang>('mn')
  const [notification, setNotification] = useState<string | null>(null)

  useEffect(() => {
    setUser(getStoredUser())
    setLang(getStoredLang())
    setReady(true)
  }, [])

  const login = useCallback((u: User) => {
    storeUser(u)
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    void fetch('/api/auth', { method: 'DELETE' })
    clearUser()
    setUser(null)
  }, [])

  const toggleLang = useCallback(() => {
    setLang(prev => {
      const next = prev === 'mn' ? 'en' : 'mn'
      setStoredLang(next)
      return next
    })
  }, [])

  const showNotification = useCallback((msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3200)
  }, [])

  const value: AppContextValue = {
    user,
    ready,
    lang,
    isAdmin: user?.role === 'admin',
    uiText: UI_TEXT[lang],
    login,
    logout,
    toggleLang,
    notification,
    showNotification,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
