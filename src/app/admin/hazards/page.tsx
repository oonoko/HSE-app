'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'
import { shiftLabel, SHIFT_NUMBERS } from '@/lib/shifts'
import { HAZARD_CATEGORIES, HAZARD_SEVERITIES, HAZARD_STATUSES, categoryLabel, isOpen, kindLabel, mapsUrl, severityLabel, statusLabel, type HazardStatus } from '@/lib/hazard'

type Report = {
  id: string; kind: string; category: string; severity: string; status: HazardStatus; location_text: string; latitude: number | null; longitude: number | null
  description: string; image_urls: string[]; anonymous: boolean; shift_number: number | null; admin_note: string | null; handled_at: string | null; created_at: string
  reporter: { name: string; sap_id: string; department?: string } | null
}

const stamp = (iso: string) => new Intl.DateTimeFormat('mn-MN', { timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

export default function AdminHazardsPage() {
  const { user, ready, isAdmin } = useApp()
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('open')
  const [severity, setSeverity] = useState('')
  const [category, setCategory] = useState('')
  const [shift, setShift] = useState('')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ status: HazardStatus; note: string }>({ status: 'new', note: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    fetch('/api/hazard-reports?admin=true').then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error); setReports(body.data); setError('') }).catch(err => setError(err.message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => { if (!ready) return; if (!user) { router.push('/login'); return } if (!isAdmin) { router.push('/'); return } load() }, [ready, user, isAdmin, router, load])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return reports.filter(item => (status === 'all' || (status === 'open' ? isOpen(item.status) : item.status === status)) && (!severity || item.severity === severity) && (!category || item.category === category)
      && (!shift || String(item.shift_number) === shift) && (!needle || `${item.description} ${item.location_text} ${item.reporter?.name ?? ''}`.toLowerCase().includes(needle)))
  }, [reports, status, severity, category, shift, search])

  if (!user || !isAdmin) return null
  const openCount = reports.filter(item => isOpen(item.status)).length
  const urgent = reports.filter(item => isOpen(item.status) && (item.severity === 'high' || item.severity === 'critical')).length
  const newCount = reports.filter(item => item.status === 'new').length

  function toggle(item: Report) {
    if (openId === item.id) { setOpenId(null); return }
    setOpenId(item.id); setDraft({ status: item.status, note: item.admin_note ?? '' })
  }
  async function save(item: Report) {
    setSaving(true); setError('')
    try {
      const response = await fetch(`/api/hazard-reports/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: draft.status, admin_note: draft.note }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Хадгалж чадсангүй') } finally { setSaving(false) }
  }

  return <div className="app-container admin-page page-enter">
    <div className="page-heading-row"><div><span className="eyebrow">HSE ХЭСЭГ</span><h1>Аюулын мэдээлэл</h1><p>Жолооч, ажилчдаас ирсэн аюул, осолд дөхсөн тохиолдлын мэдээлэл.</p></div>
      <div className="list-actions"><a className="btn-primary" href="/api/hazard-reports/export">Excel татах</a></div></div>
    {error && <div className="form-error">{error}</div>}
    <div className="res-kpis">
      <div className="res-kpi warn"><small>Шинэ</small><strong>{newCount}</strong></div>
      <div className="res-kpi"><small>Шийдвэрлэгдээгүй</small><strong>{openCount}</strong></div>
      <div className="res-kpi bad"><small>Өндөр / маш ноцтой (нээлттэй)</small><strong>{urgent}</strong></div>
      <div className="res-kpi good"><small>Шийдвэрлэсэн</small><strong>{reports.filter(item => item.status === 'resolved').length}</strong></div>
    </div>

    <div className="hz-filters">
      <input className="input-field" placeholder="Хайх (тайлбар, байршил, нэр)" value={search} onChange={e => setSearch(e.target.value)} />
      <select className="input-field" value={status} onChange={e => setStatus(e.target.value)}><option value="open">Шийдвэрлэгдээгүй</option><option value="all">Бүх төлөв</option>{HAZARD_STATUSES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
      <select className="input-field" value={severity} onChange={e => setSeverity(e.target.value)}><option value="">Бүх ноцтой байдал</option>{HAZARD_SEVERITIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
      <select className="input-field" value={category} onChange={e => setCategory(e.target.value)}><option value="">Бүх ангилал</option>{HAZARD_CATEGORIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
      {user.is_super_admin && <select className="input-field" value={shift} onChange={e => setShift(e.target.value)}><option value="">Бүх ээлж</option>{SHIFT_NUMBERS.map(n => <option key={n} value={n}>{shiftLabel(n)}</option>)}</select>}
    </div>

    {loading ? <div className="empty-state"><span className="spinner" /></div> : filtered.length === 0 ? <div className="empty-state card"><Icon name="alert" size={40} /><h2>Мэдээлэл алга</h2><p>Шүүлтүүрт тохирох мэдээлэл олдсонгүй.</p></div>
      : <div className="stack-lg">{filtered.map(item => {
        const link = mapsUrl(item.latitude, item.longitude)
        return <article key={item.id} className={`card hazard-card hz-sev-border-${item.severity}`}>
          <div className="hazard-card-top"><span className={`hz-pill hz-sev-${item.severity}`}>{severityLabel(item.severity)}</span><span className={`hz-pill hz-st-${item.status}`}>{statusLabel(item.status)}</span><small>{stamp(item.created_at)}</small></div>
          <h3>{kindLabel(item.kind)} · {categoryLabel(item.category)}</h3>
          <p className="hazard-where">{item.location_text}{link && <> · <a href={link} target="_blank" rel="noreferrer">Газрын зураг</a></>} · {item.anonymous ? 'Нэр нууцлагдсан' : `${item.reporter?.name ?? '—'}${item.reporter ? ` (${item.reporter.sap_id})` : ''}`} · {item.shift_number ? shiftLabel(item.shift_number) : 'Ээлжгүй'}</p>
          <p>{item.description}</p>
          {item.image_urls.length > 0 && <div className="hazard-photos">{item.image_urls.map(url => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="Мэдээллийн зураг" loading="lazy" /></a>)}</div>}
          {item.admin_note && openId !== item.id && <div className="hazard-note"><strong>HSE-ийн тайлбар</strong><p>{item.admin_note}</p></div>}
          {openId === item.id ? <div className="hazard-triage">
            <div className="segmented">{HAZARD_STATUSES.map(s => <button key={s.value} className={draft.status === s.value ? 'active' : ''} onClick={() => setDraft({ ...draft, status: s.value })}>{s.label}</button>)}</div>
            <textarea className="input-field" rows={3} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="Хийсэн арга хэмжээ, тайлбар (мэдээлэгч харна)" maxLength={1000} />
            <div className="list-actions"><button className="btn-primary" disabled={saving} onClick={() => save(item)}>{saving ? 'Хадгалж байна...' : 'Хадгалах'}</button><button className="btn-secondary" onClick={() => setOpenId(null)}>Хаах</button></div>
          </div> : <button className="btn-secondary" onClick={() => toggle(item)}>Шийдвэрлэх</button>}
        </article>
      })}</div>}
  </div>
}
