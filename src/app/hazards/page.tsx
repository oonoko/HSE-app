'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'
import { categoryLabel, kindLabel, severityLabel, statusLabel } from '@/lib/hazard'

type Report = { id: string; kind: string; category: string; severity: string; location_text: string; description: string; image_urls: string[]; status: string; admin_note: string | null; anonymous: boolean; created_at: string }

const day = (iso: string) => new Intl.DateTimeFormat('mn-MN', { timeZone: 'Asia/Ulaanbaatar', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

export default function MyHazardsPage() {
  const { user, ready } = useApp()
  const router = useRouter()
  const [reports, setReports] = useState<Report[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    if (user.role === 'admin') { router.push('/admin/hazards'); return }
    fetch('/api/hazard-reports').then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error); setReports(body.data) }).catch(err => { setError(err.message); setReports([]) })
  }, [ready, user, router])

  if (!user || user.role === 'admin') return null
  return <div className="app-container page-enter">
    <section className="page-title"><span className="eyebrow">АЮУЛГҮЙ АЖИЛЛАГАА</span><h1>Аюул мэдээлэх</h1><p>Ажлын байранд аюул, осолд дөхсөн тохиолдол, осол гарвал мэдээлээрэй. Таны мэдээлэл бусдыг хамгаална.</p></section>
    <Link href="/hazards/new" className="btn-primary action-link hazard-cta"><Icon name="alert" size={20} />Шинэ мэдээлэл илгээх</Link>
    {error && <div className="form-error">{error}</div>}
    <h2 className="hazard-subtitle">Миний илгээсэн мэдээлэл</h2>
    {reports === null ? <div className="empty-state"><span className="spinner" />Ачааллаж байна...</div> : reports.length === 0 ? <section className="empty-state card"><Icon name="alert" size={38} /><h2>Мэдээлэл илгээгээгүй байна</h2><p>Аюултай зүйл анзаарвал дээрх товчоор шууд мэдээлээрэй.</p></section>
      : <div className="stack-lg">{reports.map(report => <article key={report.id} className="card hazard-card">
        <div className="hazard-card-top"><span className={`hz-pill hz-sev-${report.severity}`}>{severityLabel(report.severity)}</span><span className={`hz-pill hz-st-${report.status}`}>{statusLabel(report.status)}</span><small>{day(report.created_at)}</small></div>
        <h3>{kindLabel(report.kind)} · {categoryLabel(report.category)}</h3>
        <p className="hazard-where">{report.location_text}{report.anonymous && ' · нэр нууцалсан'}</p>
        <p>{report.description}</p>
        {report.image_urls.length > 0 && <div className="hazard-photos">{report.image_urls.map(url => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="Мэдээллийн зураг" loading="lazy" /></a>)}</div>}
        {report.admin_note && <div className="hazard-note"><strong>HSE-ийн хариу</strong><p>{report.admin_note}</p></div>}
      </article>)}</div>}
  </div>
}
