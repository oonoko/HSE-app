'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import type { HazardImage, HazardForm, Location } from '@/types'

// ── Admin: Зургийн жагсаалт + нэмэх ──────────────────────
export default function AdminImagesPage() {
  const { user, ready, lang, uiText, isAdmin } = useApp()
  const router = useRouter()
  const [images, setImages] = useState<HazardImage[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    if (!isAdmin) { router.push('/'); return }
    Promise.all([
      fetch('/api/images').then(r => r.json()),
      fetch('/api/locations').then(r => r.json()),
    ]).then(([imagesResult, locationsResult]) => {
      if (imagesResult.error) throw new Error(imagesResult.error)
      if (locationsResult.error) throw new Error(locationsResult.error)
      setImages(imagesResult.data ?? [])
      setLocations(locationsResult.data ?? [])
    }).catch(err => setError(err instanceof Error ? err.message : 'Өгөгдөл авч чадсангүй'))
  }, [ready, user, isAdmin, router])

  if (!user || !isAdmin) return null

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0d2d6b' }}>
            🖼️ {uiText.images}
          </h2>
          <p style={{ color: '#6b7280', fontSize: 13 }}>
            {lang === 'mn' ? `Нийт ${images.length} зураг` : `${images.length} images total`}
          </p>
        </div>
        <button
          className="btn-primary"
          style={{ fontSize: 13, padding: '10px 16px' }}
          onClick={() => setShowForm(true)}
        >
          + {lang === 'mn' ? 'Нэмэх' : 'Add'}
        </button>
      </div>

      {/* Image list */}
      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {images.map(img => (
          <ImageCard key={img.id} image={img} lang={lang} />
        ))}
      </div>

      {/* Upload form modal */}
      {showForm && (
        <ImageUploadModal
          lang={lang}
          uiText={uiText}
          locations={locations}
          createdBy={user.sap_id}
          onClose={() => setShowForm(false)}
          onSave={(newImg) => {
            setImages(prev => [newImg, ...prev])
            setShowForm(false)
          }}
        />
      )}
    </div>
  )
}

// ── Image card ─────────────────────────────────────────────
function ImageCard({ image, lang }: { image: HazardImage; lang: string }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 12, padding: '12px 14px' }}>
        <div style={{ width: 72, height: 72, borderRadius: 10, overflow: 'hidden', background: '#e2e8f0', flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {lang === 'mn' ? image.title : (image.title_en ?? image.title)}
          </div>
          <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>
            📅 {image.date} · 📍 {lang === 'mn' ? image.location?.name : image.location?.name_en}
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
            <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
              ⚠️ {image.hazards.length} {lang === 'mn' ? 'аюул' : 'hazards'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Upload modal ───────────────────────────────────────────
interface UploadModalProps {
  lang: string
  uiText: { save: string; cancel: string; addHazard: string; uploadImage: string }
  locations: Location[]
  createdBy: string
  onClose: () => void
  onSave: (img: HazardImage) => void
}

function ImageUploadModal({ lang, uiText, locations, createdBy, onClose, onSave }: UploadModalProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [title, setTitle] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [hazards, setHazards] = useState<HazardForm[]>([])
  const [placingMarker, setPlacingMarker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const imgRef = useRef<HTMLImageElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreview(url)
  }

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!placingMarker || !imgRef.current) return
    const rect = imgRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    const newHazard: HazardForm = {
      label: '', label_en: '',
      x_percent: Math.round(x * 10) / 10,
      y_percent: Math.round(y * 10) / 10,
      quiz: [{
        id: `q${Date.now()}`,
        question: '', question_en: '',
        options: [
          { text: '', text_en: '', correct: true },
          { text: '', text_en: '', correct: false },
          { text: '', text_en: '', correct: false },
        ],
        explanation: '', explanation_en: '',
      }],
    }
    setHazards(prev => [...prev, newHazard])
    setPlacingMarker(false)
  }

  function updateHazard(idx: number, field: keyof HazardForm, value: string) {
    setHazards(prev => prev.map((h, i) => i === idx ? { ...h, [field]: value } : h))
  }

  function removeHazard(idx: number) {
    setHazards(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!file || !locationId) return
    setSaving(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploadResponse = await fetch('/api/uploads', { method: 'POST', body: formData })
      const uploadResult = await uploadResponse.json()
      if (!uploadResponse.ok) throw new Error(uploadResult.error || 'Зураг upload хийж чадсангүй')

      const imageResponse = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: uploadResult.data.publicUrl,
          location_id: locationId,
          date,
          title: title || (lang === 'mn' ? 'Шинэ зураг' : 'New image'),
          title_en: titleEn || title || 'New image',
          hazards: hazards.map((h, i) => ({
            id: `h-${Date.now()}-${i}`,
            x_percent: h.x_percent,
            y_percent: h.y_percent,
            label: h.label || `Аюул ${i + 1}`,
            label_en: h.label_en || `Hazard ${i + 1}`,
            quiz: h.quiz,
          })),
          created_by: createdBy,
        }),
      })
      const imageResult = await imageResponse.json()
      if (!imageResponse.ok) throw new Error(imageResult.error || 'Зураг хадгалж чадсангүй')
      onSave(imageResult.data as HazardImage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Зураг хадгалж чадсангүй')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60, overflowY: 'auto' }}>
      <div style={{
        background: 'white', margin: '20px auto', borderRadius: 20,
        padding: '24px 20px', maxWidth: 500,
        minHeight: '80vh',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontWeight: 800, fontSize: 18, color: '#0d2d6b' }}>
            {lang === 'mn' ? 'Шинэ зураг нэмэх' : 'Add New Image'}
          </h3>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer' }}>✕</button>
        </div>

        {/* File upload */}
        <label className="drop-zone" style={{ display: 'block', cursor: 'pointer', marginBottom: 16 }}>
          <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
          {preview ? (
            <div style={{ position: 'relative' }} onClick={e => { if (placingMarker) e.preventDefault() }}>
              <div ref={imgRef as React.RefObject<HTMLDivElement>} style={{ position: 'relative' }} onClick={handleImageClick}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={imgRef} src={preview} alt="preview" style={{ width: '100%', borderRadius: 12, cursor: placingMarker ? 'crosshair' : 'default' }} />
                {/* Placed markers */}
                {hazards.map((h, i) => (
                  <div key={i} style={{
                    position: 'absolute',
                    left: `${h.x_percent}%`, top: `${h.y_percent}%`,
                    transform: 'translate(-50%, -50%)',
                    width: 28, height: 28, borderRadius: '50%',
                    background: '#ef4444', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                    pointerEvents: 'none',
                  }}>
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
              <div style={{ color: '#6b7280', fontSize: 14 }}>
                {uiText.uploadImage}
              </div>
            </div>
          )}
        </label>

        {/* Location + date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              {lang === 'mn' ? 'Байршил' : 'Location'}
            </label>
            <select
              className="input-field"
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
              style={{ padding: '10px 12px' }}
            >
              {locations.map(l => (
                <option key={l.id} value={l.id}>{lang === 'mn' ? l.name : l.name_en}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              {lang === 'mn' ? 'Огноо' : 'Date'}
            </label>
            <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} style={{ padding: '10px 12px' }} />
          </div>
        </div>

        {/* Title MN/EN */}
        <input className="input-field" placeholder={lang === 'mn' ? 'Гарчиг (МН)' : 'Title (MN)'} value={title} onChange={e => setTitle(e.target.value)} style={{ marginBottom: 8 }} />
        <input className="input-field" placeholder={lang === 'mn' ? 'Гарчиг (EN)' : 'Title (EN)'} value={titleEn} onChange={e => setTitleEn(e.target.value)} style={{ marginBottom: 16 }} />

        {/* Hazards */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontWeight: 700, fontSize: 14, color: '#0d2d6b' }}>
              ⚠️ {lang === 'mn' ? `Аюулууд (${hazards.length})` : `Hazards (${hazards.length})`}
            </label>
            {preview && (
              <button
                className="btn-secondary"
                style={{ fontSize: 12, padding: '6px 12px' }}
                onClick={() => setPlacingMarker(true)}
              >
                {placingMarker ? (lang === 'mn' ? '🎯 Дарна уу...' : '🎯 Click image...') : uiText.addHazard}
              </button>
            )}
          </div>

          {hazards.map((h, idx) => (
            <div key={idx} className="card" style={{ padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, color: '#ef4444' }}>⚠️ {idx + 1}</span>
                <button onClick={() => removeHazard(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>🗑</button>
              </div>
              <input className="input-field" placeholder="Нэр (МН)" value={h.label} onChange={e => updateHazard(idx, 'label', e.target.value)} style={{ marginBottom: 6, fontSize: 14 }} />
              <input className="input-field" placeholder="Name (EN)" value={h.label_en} onChange={e => updateHazard(idx, 'label_en', e.target.value)} style={{ fontSize: 14 }} />
              <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 4 }}>
                📍 x:{h.x_percent.toFixed(1)}% y:{h.y_percent.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 10 }}>⚠️ {error}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>{uiText.cancel}</button>
          <button className="btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={!preview || saving || !locationId}>
            {saving ? (lang === 'mn' ? 'Хадгалж байна...' : 'Saving...') : uiText.save}
          </button>
        </div>
      </div>
    </div>
  )
}
