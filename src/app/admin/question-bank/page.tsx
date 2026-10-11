'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'
import type { BankQuestion } from '@/types'

type Form = { id?: string; topic: string; text: string; options: [string, string, string]; correct_index: number; explanation: string }
const blank = (topic = ''): Form => ({ topic, text: '', options: ['', '', ''], correct_index: 0, explanation: '' })

export default function QuestionBankPage() {
  const { user, ready, isAdmin } = useApp()
  const router = useRouter()
  const [items, setItems] = useState<BankQuestion[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [topic, setTopic] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch('/api/question-bank').then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error); setItems(body.data); setTopics(body.topics); setLoadError('') }).catch(err => setLoadError(err.message))
  }, [])
  useEffect(() => { if (!ready) return; if (!user) { router.push('/login'); return } if (!isAdmin) { router.push('/'); return } load() }, [ready, user, isAdmin, router, load])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return items.filter(item => (!topic || item.topic === topic) && (!needle || item.text.toLowerCase().includes(needle)))
  }, [items, topic, search])
  const grouped = useMemo(() => {
    const map = new Map<string, BankQuestion[]>()
    for (const item of visible) map.set(item.topic, [...(map.get(item.topic) ?? []), item])
    return [...map.entries()]
  }, [visible])

  if (!user || !isAdmin) return null
  const canEdit = (item: BankQuestion) => user.is_super_admin || item.created_by === user.id

  async function save() {
    if (!form) return
    setSaving(true); setError('')
    try {
      const response = await fetch('/api/question-bank', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: form.id, topic: form.topic, text: form.text, options: form.options.map(text => ({ text })), correct_index: form.correct_index, explanation: form.explanation }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      setForm(null); load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Хадгалж чадсангүй') } finally { setSaving(false) }
  }
  async function remove(id: string) {
    setPendingDelete(null)
    const response = await fetch(`/api/question-bank?id=${id}`, { method: 'DELETE' })
    const body = await response.json()
    if (!response.ok) { setError(body.error); return }
    load()
  }
  function edit(item: BankQuestion) {
    setError('')
    setForm({ id: item.id, topic: item.topic, text: item.text, options: item.options.map(option => option.text) as Form['options'], correct_index: item.correct_index, explanation: item.explanation ?? '' })
  }

  return <div className="app-container admin-page page-enter">
    <div className="page-heading-row"><div><span className="eyebrow">HSE ХЭСЭГ</span><h1>Асуултын сан</h1><p>Сэдвээр ангилсан асуултууд. Асуумж үүсгэхдээ эндээс сонгож эсвэл санамсаргүй нэмнэ.</p></div>
      <div className="list-actions"><Link className="btn-secondary" href="/admin/quizzes">Асуумж</Link><button className="btn-primary" onClick={() => { setError(''); setForm(blank(topic)) }}><Icon name="plus" size={18} />Шинэ асуулт</button></div></div>
    {loadError && <div className="form-error">{loadError}</div>}
    {error && !form && <div className="form-error">{error}</div>}

    {form && <section className="builder-card card" style={{ marginBottom: 16 }}>
      <div className="builder-title"><h2>{form.id ? 'Асуулт засах' : 'Шинэ асуулт'}</h2><button className="text-button" onClick={() => setForm(null)}>Болих</button></div>
      <label>Сэдэв<input className="input-field" list="bank-topics" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} placeholder="Жишээ: Хурд, Бүс, Хувийн хамгаалах хэрэгсэл" /></label>
      <datalist id="bank-topics">{topics.map(item => <option key={item} value={item} />)}</datalist>
      <label>Асуулт<textarea className="input-field" rows={3} value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} /></label>
      <div className="option-editor">{form.options.map((option, oi) => <label key={oi} className={form.correct_index === oi ? 'selected' : ''}><input type="radio" name="bank-correct" checked={form.correct_index === oi} onChange={() => setForm({ ...form, correct_index: oi })} /><span>{String.fromCharCode(65 + oi)}</span><input className="input-field" placeholder={`Хариулт ${oi + 1}`} value={option} onChange={e => setForm({ ...form, options: form.options.map((item, j) => j === oi ? e.target.value : item) as Form['options'] })} /><small>Зөв</small></label>)}</div>
      <label>Тайлбар<input className="input-field" value={form.explanation} onChange={e => setForm({ ...form, explanation: e.target.value })} placeholder="Зөв хариултын тайлбар" /></label>
      {error && <div className="form-error">{error}</div>}
      <button className="btn-primary publish-button" disabled={saving} onClick={save}>{saving ? 'Хадгалж байна...' : 'Хадгалах'}</button>
    </section>}

    <div className="roster-tools" style={{ marginBottom: 12 }}><input className="input-field" placeholder="Асуулт хайх" value={search} onChange={e => setSearch(e.target.value)} />
      <select className="input-field" value={topic} onChange={e => setTopic(e.target.value)}><option value="">Бүх сэдэв ({items.length})</option>{topics.map(item => <option key={item} value={item}>{item} ({items.filter(q => q.topic === item).length})</option>)}</select></div>

    {!loadError && grouped.length === 0 ? <div className="empty-state card"><Icon name="clipboard" size={40} /><h2>Асуулт байхгүй</h2><p>«Шинэ асуулт» дарж эсвэл асуумж үүсгэх үед асуултаа санд хадгална.</p></div>
      : grouped.map(([name, list]) => <section key={name} className="card res-section"><h2>{name} <span className="ga-sub">· {list.length} асуулт</span></h2>
        {list.map(item => <div className="answer-row" key={item.id}><h4>{item.text}</h4>
          <div className="answer-opts">{item.options.map((option, oi) => <div key={oi} className={oi === item.correct_index ? 'is-correct' : ''}>{String.fromCharCode(65 + oi)}. {option.text}{oi === item.correct_index && ' ✓ зөв'}</div>)}</div>
          {item.explanation && <p className="hint-text" style={{ margin: '0 0 8px' }}>{item.explanation}</p>}
          {canEdit(item) && <div className="override-box">{pendingDelete === item.id ? <><span>Итгэлтэй үү?</span><button className="text-button danger" onClick={() => remove(item.id)}>Тийм, устгах</button><button className="text-button" onClick={() => setPendingDelete(null)}>Үгүй</button></> : <><button className="btn-secondary" onClick={() => edit(item)}>Засах</button><button className="text-button danger" onClick={() => setPendingDelete(item.id)}>Устгах</button></>}</div>}
        </div>)}</section>)}
  </div>
}
