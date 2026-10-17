'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'
import { HAZARD_CATEGORIES, HAZARD_KINDS, HAZARD_SEVERITIES, MAX_HAZARD_PHOTOS, type HazardKind, type HazardSeverity } from '@/lib/hazard'

export default function NewHazardPage() {
  const { user, ready } = useApp()
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<HazardKind>('hazard')
  const [category, setCategory] = useState('')
  const [severity, setSeverity] = useState<HazardSeverity>('medium')
  const [location, setLocation] = useState('')
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [anonymous, setAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (!ready) return; if (!user) router.push('/login'); else if (user.role === 'admin') router.push('/admin/hazards') }, [ready, user, router])
  if (!user || user.role === 'admin') return null

  function locate() {
    if (!navigator.geolocation) { setError('Төхөөрөмж байршил тодорхойлохыг дэмжихгүй байна'); return }
    setLocating(true); setError('')
    navigator.geolocation.getCurrentPosition(
      position => { setCoords({ latitude: Number(position.coords.latitude.toFixed(6)), longitude: Number(position.coords.longitude.toFixed(6)) }); setLocating(false) },
      () => { setError('Байршил авч чадсангүй. Байршлын эрхийг зөвшөөрнө үү эсвэл гараар бичнэ үү.'); setLocating(false) },
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return
    setUploading(true); setError('')
    try {
      for (const file of Array.from(files).slice(0, MAX_HAZARD_PHOTOS - photos.length)) {
        const body = new FormData(); body.append('file', file)
        const response = await fetch('/api/hazard-reports/upload', { method: 'POST', body })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error)
        setPhotos(list => [...list, result.data.publicUrl])
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Зураг оруулж чадсангүй') } finally { setUploading(false); if (fileInput.current) fileInput.current.value = '' }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!category) { setError('Ангилалаа сонгоно уу'); return }
    setSubmitting(true); setError('')
    try {
      const response = await fetch('/api/hazard-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, category, severity, location_text: location, ...(coords ?? {}), description, image_urls: photos, anonymous }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      router.push('/hazards')
    } catch (err) { setError(err instanceof Error ? err.message : 'Илгээж чадсангүй'); setSubmitting(false) }
  }

  return <div className="app-container page-enter">
    <section className="page-title"><span className="eyebrow">АЮУЛ МЭДЭЭЛЭХ</span><h1>Шинэ мэдээлэл</h1></section>
    <form className="card hazard-form" onSubmit={submit}>
      <label className="field-label">Юуны тухай вэ?</label>
      <div className="kind-grid">{HAZARD_KINDS.map(item => <button type="button" key={item.value} className={kind === item.value ? 'on' : ''} onClick={() => setKind(item.value)}><strong>{item.label}</strong><small>{item.hint}</small></button>)}</div>

      <label className="field-label">Ангилал</label>
      <select className="input-field" value={category} onChange={e => setCategory(e.target.value)} required><option value="">Сонгох...</option>{HAZARD_CATEGORIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>

      <label className="field-label">Ноцтой байдал</label>
      <div className="sev-grid">{HAZARD_SEVERITIES.map(item => <button type="button" key={item.value} className={`${severity === item.value ? 'on' : ''} hz-sev-${item.value}`} onClick={() => setSeverity(item.value)}>{item.label}</button>)}</div>

      <label className="field-label">Байршил</label>
      <input className="input-field" value={location} onChange={e => setLocation(e.target.value)} placeholder="Жишээ: Тавантолгой, 3-р замын 12 км" maxLength={200} required />
      <div className="locate-row"><button type="button" className="btn-secondary" onClick={locate} disabled={locating}>{locating ? 'Байршил авч байна...' : coords ? 'Байршлыг дахин авах' : 'Миний байршлыг авах'}</button>{coords && <small>✓ {coords.latitude}, {coords.longitude}</small>}</div>

      <label className="field-label">Юу болсон бэ? Юу анзаарсан бэ?</label>
      <textarea className="input-field" rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="Тодорхой бичнэ үү: юу, хаана, хэзээ, хэн оролцсон" maxLength={2000} required />

      <label className="field-label">Зураг (хамгийн ихдээ {MAX_HAZARD_PHOTOS})</label>
      <div className="photo-row">
        {photos.map(url => <div className="photo-thumb" key={url}><img src={url} alt="" /><button type="button" aria-label="Зураг устгах" onClick={() => setPhotos(list => list.filter(item => item !== url))}>×</button></div>)}
        {photos.length < MAX_HAZARD_PHOTOS && <label className="photo-add"><Icon name="image" size={24} /><span>{uploading ? 'Оруулж байна...' : 'Зураг нэмэх'}</span><input ref={fileInput} type="file" accept="image/*" capture="environment" multiple hidden disabled={uploading} onChange={e => addPhotos(e.target.files)} /></label>}
      </div>

      <label className="check-row"><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} /><span><strong>Нэрээ нууцлах</strong><small>HSE таны нэрийг харахгүй. Та өөрийн мэдээллийн төлвийг харна.</small></span></label>

      {error && <div className="form-error">{error}</div>}
      <button className="btn-primary full-width" disabled={submitting || uploading}>{submitting ? 'Илгээж байна...' : 'Мэдээлэл илгээх'}</button>
      <Link href="/hazards" className="text-button">Болих</Link>
    </form>
  </div>
}
