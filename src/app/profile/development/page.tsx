'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import DriverReportView, { type DriverReportData } from '@/components/report/DriverReportView'

export default function MyDevelopmentPage() {
  const { user, ready } = useApp()
  const router = useRouter()
  const [data, setData] = useState<DriverReportData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    fetch(`/api/drivers/${user.id}/report`).then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error); setData(body.data) })
      .catch(err => setError(err instanceof Error ? err.message : 'Мэдээлэл авч чадсангүй'))
  }, [ready, user, router])

  if (!user) return null
  if (error) return <div className="app-container"><div className="empty-state card"><h2>Алдаа гарлаа</h2><p>{error}</p></div></div>
  if (!data) return <div className="empty-state"><span className="spinner" />Хөгжлийн тайлан ачааллаж байна...</div>
  return <DriverReportView data={data} mode={user.role === 'admin' ? 'admin' : 'driver'} userId={user.id} />
}
