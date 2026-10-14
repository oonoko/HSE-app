'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'
import type { User } from '@/types'

export default function LoginPage() {
  const { login, lang } = useApp()
  const router = useRouter()
  const [sapId, setSapId] = useState('')
  const [pin, setPin] = useState('')
  const [pendingUser, setPendingUser] = useState<User | null>(null)
  const [pinStep, setPinStep] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [guestForm, setGuestForm] = useState(false)
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')

  async function lookupUser(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sap_id: sapId.trim(), lookup: true }),
      })
      const result = await response.json()
      if (result.not_found) { setNotFound(true); return }
      if (!response.ok || !result.user) throw new Error(result.error || 'SAP дугаар олдсонгүй')
      setPendingUser(result.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Сервертэй холбогдож чадсангүй')
    } finally { setLoading(false) }
  }

  async function confirmIdentity() {
    if (!pendingUser) return
    if (pendingUser.role === 'admin') { setPinStep(true); return }
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sap_id: pendingUser.sap_id, confirm: true }) })
      const result = await response.json(); if (!response.ok || !result.user) throw new Error(result.error || 'Нэвтэрч чадсангүй'); finishLogin(result.user)
    } catch (err) { setError(err instanceof Error ? err.message : 'Нэвтэрч чадсангүй') } finally { setLoading(false) }
  }

  async function verifyPin(e: React.FormEvent) {
    e.preventDefault()
    if (!pendingUser) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sap_id: pendingUser.sap_id, pin }),
      })
      const result = await response.json()
      if (!response.ok || !result.user) throw new Error(result.error || 'PIN буруу байна')
      finishLogin(result.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PIN шалгаж чадсангүй')
    } finally { setLoading(false) }
  }

  function finishLogin(user: User) {
    login(user)
    router.push(user.role === 'admin' ? '/admin/quizzes' : '/')
  }

  async function registerGuest(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sap_id: sapId.trim(), register_guest: true, last_name: lastName, first_name: firstName }) })
      const result = await response.json()
      if (!response.ok || !result.user) throw new Error(result.error || 'Бүртгэж чадсангүй')
      finishLogin(result.user)
    } catch (err) { setError(err instanceof Error ? err.message : 'Бүртгэж чадсангүй') } finally { setLoading(false) }
  }

  function reset() {
    setPendingUser(null); setPinStep(false); setPin(''); setSapId(''); setError('')
    setNotFound(false); setGuestForm(false); setLastName(''); setFirstName('')
  }

  return (
    <div className="login-page">
      <div className="login-brand">
        <Image src="/brand/logo.jpg" alt="Ханбогд Хурд" width={210} height={210} priority className="login-logo" />
        <p>Жолоочийн аюулгүй ажиллагааны сургалт</p>
      </div>

      <section className="login-card">
        {!pendingUser && !notFound && (
          <form onSubmit={lookupUser}>
            <span className="eyebrow">HSE SAFETY</span>
            <h1>Нэвтрэх</h1>
            <p className="muted">Өөрийн SAP дугаарыг оруулна уу.</p>
            <label className="field-label">SAP дугаар</label>
            <input className="input-field login-input" inputMode="numeric" value={sapId} onChange={e => setSapId(e.target.value.replace(/\D/g, ''))} placeholder="SAP дугаар" autoFocus required />
            {error && <div className="form-error">{error}</div>}
            <button className="btn-primary full-width" disabled={loading || !sapId}>{loading ? 'Шалгаж байна...' : 'Үргэлжлүүлэх'}</button>
          </form>
        )}

        {!pendingUser && notFound && !guestForm && (
          <div className="identity-step">
            <div className="identity-avatar"><Icon name="user" size={30} /></div>
            <span className="eyebrow">SAP {sapId}</span>
            <h2>Бүртгэлд олдсонгүй</h2>
            <p>Энэ SAP дугаар бүртгэлгүй байна. Та зочин уу?</p>
            <div className="button-row">
              <button className="btn-quiet" onClick={reset}>Үгүй</button>
              <button className="btn-primary" onClick={() => { setGuestForm(true); setError('') }}>Тийм, зочин</button>
            </div>
          </div>
        )}

        {!pendingUser && notFound && guestForm && (
          <form onSubmit={registerGuest}>
            <span className="eyebrow">ЗОЧНЫ БҮРТГЭЛ · SAP {sapId}</span>
            <h1>Зочин бүртгүүлэх</h1>
            <p className="muted">Овог, нэрээ оруулна уу.</p>
            <label className="field-label">Овог</label>
            <input className="input-field login-input" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Овог" autoFocus required maxLength={40} autoComplete="family-name" />
            <label className="field-label">Нэр</label>
            <input className="input-field login-input" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Нэр" required maxLength={40} autoComplete="given-name" />
            {error && <div className="form-error">{error}</div>}
            <button className="btn-primary full-width" disabled={loading || !lastName.trim() || !firstName.trim()}>{loading ? 'Бүртгэж байна...' : 'Бүртгүүлж нэвтрэх'}</button>
            <button type="button" className="text-button" onClick={reset}>SAP дугаар солих</button>
          </form>
        )}

        {pendingUser && !pinStep && (
          <div className="identity-step">
            <div className="identity-avatar"><Icon name="user" size={30} /></div>
            <span className="eyebrow">SAP {pendingUser.sap_id}</span>
            <h2>{lang === 'mn' ? pendingUser.name : pendingUser.name_en || pendingUser.name}</h2>
            <p>Та мөн үү?</p>
            <div className="button-row">
              <button className="btn-quiet" onClick={reset}>Үгүй</button>
              <button className="btn-primary" disabled={loading} onClick={confirmIdentity}>{loading ? 'Нэвтэрч байна...' : 'Мөн'}</button>
            </div>
          </div>
        )}

        {pendingUser && pinStep && (
          <form onSubmit={verifyPin}>
            <div className="identity-avatar"><Icon name="lock" size={28} /></div>
            <h2>Админ нэвтрэлт</h2>
            <p className="muted">Нэмэлт PIN кодоо оруулна уу.</p>
            <label className="field-label">PIN код</label>
            <input className="input-field login-input" type="password" inputMode="numeric" maxLength={8} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} autoFocus />
            {error && <div className="form-error">{error}</div>}
            <button className="btn-primary full-width" disabled={loading || !pin}>{loading ? 'Шалгаж байна...' : 'Нэвтрэх'}</button>
            <button type="button" className="text-button" onClick={reset}>SAP дугаар солих</button>
          </form>
        )}
      </section>
    </div>
  )
}
