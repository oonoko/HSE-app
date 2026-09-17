'use client'

import { useEffect } from 'react'
import { useApp } from '@/lib/context'
import Header from './Header'
import BottomNav from './BottomNav'
import ScoreToast from '../ui/ScoreToast'
import { usePathname } from 'next/navigation'
import { registerServiceWorker } from '@/lib/push-client'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, notification } = useApp()
  const pathname = usePathname()
  const showChrome = !!user && pathname !== '/login' && !pathname.startsWith('/admin/quizzes/present')

  useEffect(() => { registerServiceWorker() }, [])

  return (
    <>
      {showChrome && <Header />}
      <main className={showChrome ? 'page-wrapper' : ''}>
        {children}
      </main>
      {showChrome && <BottomNav />}
      {notification && <ScoreToast message={notification} />}
    </>
  )
}
