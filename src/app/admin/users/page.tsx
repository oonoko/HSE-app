'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'
import type { Location, User } from '@/types'

type UserForm = { id?: string; sap_id: string; name: string; department: string; location_id: string; shift_number: string }
const emptyForm = (locationId = ''): UserForm => ({ sap_id: '', name: '', department: 'Жолооч', location_id: locationId, shift_number: '1' })

type ImportRow = { sap_id: string; name: string; shift_number: string; error?: string }

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = '', row: string[] = [], inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false }
      else field += char
    } else if (char === '"') inQuotes = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(cell => cell.trim())) rows.push(row)
      row = []
    } else field += char
  }
  row.push(field)
  if (row.some(cell => cell.trim())) rows.push(row)
  return rows
}

function downloadCsvTemplate() {
  const csv = 'sap_id,name,shift_number\n1234567,Бат Бат,1\n7654321,Дорж Дорж,2'
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = 'jolooch-jagsaalt-template.csv'
  a.click()
}

export default function AdminUsersPage() {
  const { user, ready, isAdmin } = useApp(); const router = useRouter()
  const [users, setUsers] = useState<User[]>([]); const [locations, setLocations] = useState<Location[]>([]); const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false); const [form, setForm] = useState<UserForm>(emptyForm()); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const [showImport, setShowImport] = useState(false); const [importRows, setImportRows] = useState<ImportRow[]>([]); const [importing, setImporting] = useState(false); const [importSummary, setImportSummary] = useState<{ ok: number; failed: number } | null>(null)
  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    if (!isAdmin) { router.push('/'); return }
    if (!user.is_super_admin) { router.push('/admin/my-shift'); return }
    Promise.all([fetch('/api/users').then(r => r.json()), fetch('/api/locations').then(r => r.json())]).then(([userResult, locationResult]) => {
      if (userResult.error) throw new Error(userResult.error)
      setUsers((userResult.data as User[]).filter(item => item.role === 'driver')); setLocations(locationResult.data ?? []); setForm(emptyForm(locationResult.data?.[0]?.id ?? ''))
    }).catch(err => setError(err instanceof Error ? err.message : 'Мэдээлэл авч чадсангүй')).finally(() => setLoading(false))
  }, [ready, user, isAdmin, router])
  if (!user || !isAdmin || !user.is_super_admin) return null
  const filtered = users.filter(item => `${item.name} ${item.sap_id} ${item.shift_number ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  function openCreate() { setForm(emptyForm(locations[0]?.id)); setError(''); setShowForm(true) }
  function openEdit(item: User) { setForm({ id: item.id, sap_id: item.sap_id, name: item.name, department: item.department || 'Жолооч', location_id: item.location_id || locations[0]?.id || '', shift_number: String(item.shift_number || 1) }); setError(''); setShowForm(true) }
  function openImport() { setImportRows([]); setImportSummary(null); setShowImport(true) }
  function handleImportFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const rows = parseCsv(String(reader.result ?? ''))
      if (rows.length === 0) { setImportRows([]); return }
      const header = rows[0].map(cell => cell.trim().toLowerCase())
      const sapIdx = header.findIndex(h => h.includes('sap'))
      const nameIdx = header.findIndex(h => h.includes('name') || h.includes('нэр'))
      const shiftIdx = header.findIndex(h => h.includes('shift') || h.includes('ээлж'))
      const existingSapIds = new Set(users.map(u => u.sap_id))
      const seenInFile = new Set<string>()
      const parsed: ImportRow[] = rows.slice(1).map(cells => {
        const sap_id = (sapIdx >= 0 ? cells[sapIdx] : '').trim()
        const name = (nameIdx >= 0 ? cells[nameIdx] : '').trim()
        const shift_number = (shiftIdx >= 0 ? cells[shiftIdx] : '').trim()
        let rowError = ''
        if (!sap_id) rowError = 'SAP дугаар дутуу'
        else if (!/^\d+$/.test(sap_id)) rowError = 'SAP дугаар зөвхөн тоо байх ёстой'
        else if (!name) rowError = 'Нэр дутуу'
        else if (shift_number && !['1', '2', '3', '4'].includes(shift_number)) rowError = 'Ээлж 1-4 байх ёстой'
        else if (existingSapIds.has(sap_id)) rowError = 'Энэ SAP аль хэдийн бүртгэлтэй'
        else if (seenInFile.has(sap_id)) rowError = 'Файл дотор давхардсан'
        if (sap_id) seenInFile.add(sap_id)
        return { sap_id, name, shift_number: shift_number || '1', error: rowError || undefined }
      })
      setImportRows(parsed)
      setImportSummary(null)
    }
    reader.readAsText(file)
  }
  async function runImport() {
    const valid = importRows.filter(row => !row.error)
    setImporting(true)
    let ok = 0, failed = 0
    for (const row of valid) {
      try {
        const response = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sap_id: row.sap_id, name: row.name, shift_number: row.shift_number, department: 'Жолооч', location_id: locations[0]?.id || '', role: 'driver' }) })
        if (response.ok) ok++; else failed++
      } catch { failed++ }
    }
    setImporting(false)
    setImportSummary({ ok, failed })
    fetch('/api/users').then(r => r.json()).then(result => setUsers((result.data as User[]).filter(item => item.role === 'driver')))
  }
  async function save() {
    if (!form.sap_id.trim() || !form.name.trim() || !form.shift_number) { setError('SAP, нэр, ээлжийг бүрэн оруулна уу.'); return }
    setSaving(true); setError('')
    try { const response = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, role: 'driver' }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Хадгалж чадсангүй'); setUsers(list => [...list.filter(item => item.id !== result.data.id), result.data].sort((a, b) => a.name.localeCompare(b.name))); setShowForm(false) }
    catch (err) { setError(err instanceof Error ? err.message : 'Хадгалж чадсангүй') } finally { setSaving(false) }
  }
  return <div className="app-container admin-page page-enter"><div className="page-heading-row"><div><span className="eyebrow">ЗӨВХӨН ЕРӨНХИЙ АДМИН</span><h1>Ажилтан удирдах</h1><p>{users.length} жолоочийн SAP, нэр, ээлжийн мэдээлэл</p></div><div className="toolbar"><button className="btn-secondary" onClick={openImport}><Icon name="plus" size={18}/>CSV импорт</button><button className="btn-primary" onClick={openCreate}><Icon name="plus" size={18}/>Жолооч нэмэх</button></div></div>
    {error && !showForm && <div className="form-error">{error}</div>}<div className="filter-bar"><label className="search-wide">Хайлт<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Нэр, SAP эсвэл ээлж"/></label></div>
    {loading ? <div className="empty-state"><span className="spinner"/></div> : <section className="card driver-table"><div className="section-heading"><div><span className="eyebrow">БҮРТГЭЛ</span><h2>{filtered.length} жолооч</h2></div></div>{filtered.map(item => <div className="driver-row user-edit-row" key={item.id}><div className="driver-avatar">{item.name[0]}</div><div><strong>{item.name}</strong><small>SAP {item.sap_id} · {item.shift_number ? `${item.shift_number}-р ээлж` : 'Ээлж тохируулаагүй'}</small></div><div className="driver-points"><b>{item.total_score.toLocaleString()}</b><small>оноо</small></div><button className="btn-quiet" onClick={() => openEdit(item)}>Засах</button></div>)}{filtered.length === 0 && <div className="empty-mini">Илэрц олдсонгүй.</div>}</section>}
    {showForm && <div className="modal-backdrop" onMouseDown={() => setShowForm(false)}><section className="modal-sheet" onMouseDown={event => event.stopPropagation()}><div className="builder-title"><div><span className="eyebrow">ЖОЛООЧИЙН БҮРТГЭЛ</span><h2>{form.id ? 'Мэдээлэл засах' : 'Шинэ жолооч'}</h2></div><button className="icon-button" onClick={() => setShowForm(false)}>×</button></div><div className="form-grid single"><label>SAP дугаар<input className="input-field" inputMode="numeric" value={form.sap_id} onChange={e => setForm({...form, sap_id: e.target.value.replace(/\D/g, '')})}/></label><label>Овог, нэр<input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})}/></label><label>Ээлж<select className="input-field" value={form.shift_number} onChange={e => setForm({...form, shift_number: e.target.value})}>{[1,2,3,4].map(number => <option key={number} value={number}>{number}-р ээлж</option>)}</select></label>{locations.length > 0 && <label>Байршил<select className="input-field" value={form.location_id} onChange={e => setForm({...form, location_id: e.target.value})}>{locations.map(location => <option value={location.id} key={location.id}>{location.name}</option>)}</select></label>}</div>{error && <div className="form-error">{error}</div>}<div className="button-row"><button className="btn-quiet" onClick={() => setShowForm(false)}>Цуцлах</button><button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Хадгалж байна...' : 'Хадгалах'}</button></div></section></div>}
    {showImport && <div className="modal-backdrop" onMouseDown={() => setShowImport(false)}><section className="modal-sheet import-sheet" onMouseDown={event => event.stopPropagation()}>
      <div className="builder-title"><div><span className="eyebrow">БАГЦААР НЭМЭХ</span><h2>CSV импорт</h2></div><button className="icon-button" onClick={() => setShowImport(false)}>×</button></div>
      <p className="muted">Багана: <code>sap_id, name, shift_number</code> (эхний мөр толгой байх ёстой).</p>
      <div className="button-row"><button className="btn-quiet" onClick={downloadCsvTemplate}>Загвар татах</button><label className="btn-secondary import-file-label">Файл сонгох<input type="file" accept=".csv,text/csv" hidden onChange={e => e.target.files?.[0] && handleImportFile(e.target.files[0])}/></label></div>
      {importRows.length > 0 && <>
        <div className="import-summary"><span>{importRows.length} мөр</span><span className="ok">{importRows.filter(r => !r.error).length} зөв</span>{importRows.some(r => r.error) && <span className="bad">{importRows.filter(r => r.error).length} алдаатай</span>}</div>
        <div className="import-list">{importRows.map((row, i) => <div className={`import-row${row.error ? ' error' : ''}`} key={i}>
          <strong>{row.name || '—'}</strong><small>SAP {row.sap_id || '—'} · {row.shift_number}-р ээлж</small>{row.error && <span className="import-error-text">{row.error}</span>}
        </div>)}</div>
      </>}
      {importSummary && <div className={importSummary.failed ? 'form-error' : 'form-success'}>{importSummary.ok} жолооч нэмэгдлээ{importSummary.failed ? `, ${importSummary.failed} алдаатай` : ''}.</div>}
      <div className="button-row"><button className="btn-quiet" onClick={() => setShowImport(false)}>Хаах</button><button className="btn-primary" disabled={importing || importRows.filter(r => !r.error).length === 0} onClick={runImport}>{importing ? 'Импортлож байна...' : `${importRows.filter(r => !r.error).length} жолооч импортлох`}</button></div>
    </section></div>}
  </div>
}
