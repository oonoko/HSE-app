'use client'

import { useEffect, useMemo, useState } from 'react'
import type { BankQuestion, DailyQuizQuestion } from '@/types'

// Questions are copied into the quiz (with a fresh id) so later edits to the bank don't alter a live quiz.
export function toQuizQuestion(item: BankQuestion): DailyQuizQuestion {
  return {
    id: crypto.randomUUID(), text: item.text, options: item.options.map(option => ({ text: option.text })) as DailyQuizQuestion['options'],
    correct_index: item.correct_index, explanation: item.explanation ?? '', topic: item.topic, ...(item.image_url ? { image_url: item.image_url } : {}),
  }
}

export default function QuestionBankPicker({ onAdd, onClose, existingTexts }: { onAdd: (questions: DailyQuizQuestion[]) => void; onClose: () => void; existingTexts: string[] }) {
  const [items, setItems] = useState<BankQuestion[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [topic, setTopic] = useState('')
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [randomCount, setRandomCount] = useState(5)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/question-bank').then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error); setItems(body.data); setTopics(body.topics) })
      .catch(err => setError(err.message)).finally(() => setLoading(false))
  }, [])

  const used = useMemo(() => new Set(existingTexts.map(text => text.trim())), [existingTexts])
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return items.filter(item => (!topic || item.topic === topic) && (!needle || item.text.toLowerCase().includes(needle)))
  }, [items, topic, search])
  const available = visible.filter(item => !used.has(item.text.trim()))

  function toggle(id: string) { setPicked(list => list.includes(id) ? list.filter(item => item !== id) : [...list, id]) }
  function addPicked() { onAdd(items.filter(item => picked.includes(item.id)).map(toQuizQuestion)); onClose() }
  function addRandom() {
    const pool = [...available]
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]] }
    onAdd(pool.slice(0, Math.max(1, randomCount)).map(toQuizQuestion)); onClose()
  }

  return <section className="builder-card card bank-picker">
    <div className="builder-title"><h2>Асуултын сангаас нэмэх</h2><button className="text-button" onClick={onClose}>Хаах</button></div>
    {error ? <div className="form-error">{error}</div> : loading ? <div className="empty-state"><span className="spinner" />Ачааллаж байна...</div> : <>
      <div className="roster-tools"><input className="input-field" placeholder="Асуулт хайх" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input-field" value={topic} onChange={e => setTopic(e.target.value)}><option value="">Бүх сэдэв</option>{topics.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
      <div className="bank-random"><span>Санамсаргүй</span><input type="number" min={1} max={50} className="input-field" value={randomCount} onChange={e => setRandomCount(Number(e.target.value))} /><span>асуулт{topic ? ` («${topic}» сэдвээс)` : ' (бүх сэдвээс)'}</span><button className="btn-secondary" disabled={available.length === 0} onClick={addRandom}>Санамсаргүй нэмэх</button></div>
      <p className="roster-count"><strong>{picked.length}</strong> сонгогдсон · харагдаж буй {visible.length}{visible.length !== available.length && ` (${visible.length - available.length} нь асуумжид орсон)`}</p>
      <div className="bank-list">{visible.length === 0 ? <p className="roster-empty">Асуулт олдсонгүй. Санд асуулт нэмэхийг «Асуултын сан» хуудсаас хийнэ.</p> : visible.map(item => {
        const inQuiz = used.has(item.text.trim())
        return <label key={item.id} className={`${picked.includes(item.id) ? 'selected' : ''} ${inQuiz ? 'used' : ''}`}>
          <input type="checkbox" disabled={inQuiz} checked={picked.includes(item.id)} onChange={() => toggle(item.id)} />
          <span><strong>{item.text}</strong><small>{item.topic} · зөв: {item.options[item.correct_index]?.text}{inQuiz && ' · асуумжид орсон'}</small></span></label>
      })}</div>
      <button className="btn-primary" disabled={picked.length === 0} onClick={addPicked}>{picked.length} асуулт нэмэх</button>
    </>}
  </section>
}
