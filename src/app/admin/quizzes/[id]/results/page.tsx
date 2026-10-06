'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import QuizResults from '@/components/admin/QuizResults'

export default function QuizResultsPage() {
  const { user, ready, isAdmin } = useApp()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  useEffect(() => { if (!ready) return; if (!user) router.push('/login'); else if (!isAdmin) router.push('/') }, [ready, user, isAdmin, router])
  if (!user || !isAdmin) return null
  return <div className="app-container admin-page page-enter"><QuizResults id={id} /></div>
}
