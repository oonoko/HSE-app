'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'
import type { SafetyGame } from '@/types'
import { generateCrossword, type PlacedWord } from '@/lib/crossword'

type Item = { statement?: string; prompt?: string; answer?: boolean; explanation?: string; options?: string[]; correct_index?: number; left?: string; right?: string }

export default function GamePlayPage() {
  const { id } = useParams<{ id: string }>(); const { user, ready } = useApp(); const router = useRouter()
  const [game, setGame] = useState<SafetyGame | null>(null); const [score, setScore] = useState(0); const [done, setDone] = useState(false); const started = useRef(Date.now())
  useEffect(() => { if (!ready) return; if (!user) { router.push('/login'); return } fetch('/api/games').then(r => r.json()).then(data => setGame((data.data ?? []).find((item: SafetyGame) => item.id === id) ?? null)) }, [ready, user, id, router])
  async function complete(finalScore: number) { if (!user || !game || done) return; setScore(finalScore); setDone(true); await fetch('/api/game-attempts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game_id: game.id, user_id: user.id, score: finalScore, duration_seconds: Math.round((Date.now() - started.current) / 1000) }) }) }
  if (!game) return <div className="empty-state"><span className="spinner" />Тоглоом ачааллаж байна...</div>
  if (done) return <div className="app-container result-page page-enter"><div className="result-mark"><Icon name="trophy" size={38}/></div><span className="eyebrow">ТОГЛООМ ДУУССАН</span><h1>{score.toLocaleString()} оноо</h1><p>Энэ оноо таны нийт болон rank оноонд нэмэгдлээ.</p><div className="button-row"><button className="btn-quiet" onClick={() => router.push('/games')}>Тоглоом сонгох</button><button className="btn-primary" onClick={() => location.reload()}>Дахин тоглох</button></div></div>
  return <div className="game-play page-enter"><div className="game-play-header"><button className="icon-button light" onClick={() => router.push('/games')}>←</button><div><span>{game.template === 'truth_false' ? 'Үнэн эсвэл худал' : game.template === 'match' ? 'Дүрэм тааруулах' : game.template === 'word_grid' ? 'Үгийн сүлжээ' : 'Random box'}</span><h1>{game.title}</h1></div><strong>{score}</strong></div>
    {game.template === 'word_grid' ? <CrosswordGame game={game} onComplete={complete}/> : <QuestionGame game={game} score={score} setScore={setScore} onComplete={complete}/>}</div>
}

function QuestionGame({ game, score, setScore, onComplete }: { game: SafetyGame; score: number; setScore: (value: number) => void; onComplete: (score: number) => void }) {
  const content = game.content as { items?: Item[]; pairs?: Item[] }
  const items = (game.template === 'match' ? content.pairs : content.items) ?? []
  const [index, setIndex] = useState(0); const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null); const [boxOpened, setBoxOpened] = useState(game.template !== 'random_box')
  const item = items[index]
  const matchOptions = useMemo(() => game.template === 'match' ? [...items.map(entry => entry.right || '')].sort(() => Math.random() - .5) : [], [game.template, items])
  if (!item) return <div className="empty-state card"><h2>Тоглоомын даалгавар хоосон байна</h2></div>
  function choose(correct: boolean) {
    if (feedback) return
    setFeedback(correct ? 'correct' : 'wrong')
    const nextScore = score + (correct ? 100 : 0)
    setScore(nextScore)
    setTimeout(() => { if (index + 1 >= items.length) onComplete(nextScore); else { setIndex(index + 1); setFeedback(null); setBoxOpened(game.template !== 'random_box') } }, 1100)
  }
  const prompt = item.statement || item.prompt || item.left || ''
  return <main className={`play-card ${feedback || ''}`}>
    <div className="play-progress"><span style={{ width: `${(index / items.length) * 100}%` }}/></div><span className="eyebrow">{index + 1} / {items.length}</span>
    {game.template === 'random_box' && !boxOpened ? <div className="random-box-stage"><button className="random-box" onClick={() => setBoxOpened(true)}><span>?</span><strong>Хайрцгийг нээх</strong></button></div> : <><h2>{prompt}</h2>
      <div className="play-actions">
        {game.template === 'truth_false' && <><button onClick={() => choose(item.answer === true)}>Үнэн</button><button onClick={() => choose(item.answer === false)}>Худал</button></>}
        {game.template === 'match' && matchOptions.map(option => <button key={option} onClick={() => choose(option === item.right)}>{option}</button>)}
        {game.template === 'random_box' && item.options?.map((option, i) => <button key={option} onClick={() => choose(i === item.correct_index)}>{option}</button>)}
      </div></>}
    {feedback && <div className={`inline-feedback ${feedback}`}>{feedback === 'correct' ? 'Зөв хариулт · +100' : 'Буруу хариулт'}</div>}
    {feedback === 'correct' && <div className="confetti-burst">{Array.from({length: 10}).map((_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}</div>}
  </main>
}

function CrosswordGame({ game, onComplete }: { game: SafetyGame; onComplete: (score: number) => void }) {
  const content = game.content as { words?: { word: string; clue: string }[] }
  const result = useMemo(() => generateCrossword(content.words ?? []), [content.words])
  const { placed, width, height } = result
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [activeWordKey, setActiveWordKey] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const cellMap = useMemo(() => {
    const map = new Map<string, { word: PlacedWord; index: number }[]>()
    for (const p of placed) {
      for (let i = 0; i < p.word.length; i++) {
        const r = p.direction === 'down' ? p.row + i : p.row
        const c = p.direction === 'across' ? p.col + i : p.col
        const key = `${r},${c}`
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push({ word: p, index: i })
      }
    }
    return map
  }, [placed])

  const activeWord = useMemo(() => placed.find(p => `${p.row},${p.col},${p.direction}` === activeWordKey) ?? null, [placed, activeWordKey])

  if (placed.length === 0) return <div className="empty-state card">Тоглоомын үг ороогүй байна.</div>

  function selectCell(r: number, c: number) {
    const entries = cellMap.get(`${r},${c}`) ?? []
    if (entries.length === 0) return
    const currentlyActive = activeWord && entries.some(e => e.word === activeWord)
    const chosen = currentlyActive && entries.length > 1 ? entries.find(e => e.word !== activeWord)! : entries[0]
    setActiveWordKey(`${chosen.word.row},${chosen.word.col},${chosen.word.direction}`)
  }

  function focusClue(word: PlacedWord) {
    setActiveWordKey(`${word.row},${word.col},${word.direction}`)
    cellRefs.current[`${word.row},${word.col}`]?.focus()
  }

  function handleInput(r: number, c: number, value: string, word: PlacedWord | null) {
    const letter = value.slice(-1).toUpperCase()
    setAnswers(prev => ({ ...prev, [`${r},${c}`]: letter }))
    if (!word) return
    const idx = word.direction === 'down' ? r - word.row : c - word.col
    if (idx < word.word.length - 1) {
      const nextR = word.direction === 'down' ? r + 1 : r
      const nextC = word.direction === 'across' ? c + 1 : c
      cellRefs.current[`${nextR},${nextC}`]?.focus()
    }
  }

  function handleKeyDown(r: number, c: number, e: React.KeyboardEvent, word: PlacedWord | null) {
    if (e.key === 'Backspace' && !answers[`${r},${c}`] && word) {
      const idx = word.direction === 'down' ? r - word.row : c - word.col
      if (idx > 0) {
        const prevR = word.direction === 'down' ? r - 1 : r
        const prevC = word.direction === 'across' ? c - 1 : c
        cellRefs.current[`${prevR},${prevC}`]?.focus()
      }
    }
  }

  function check() {
    let correctWords = 0
    for (const p of placed) {
      let ok = true
      for (let i = 0; i < p.word.length; i++) {
        const r = p.direction === 'down' ? p.row + i : p.row
        const c = p.direction === 'across' ? p.col + i : p.col
        if (answers[`${r},${c}`] !== p.word[i]) { ok = false; break }
      }
      if (ok) correctWords++
    }
    setChecked(true)
    setTimeout(() => onComplete(correctWords * 100), 1400)
  }

  const across = placed.filter(p => p.direction === 'across').sort((a, b) => a.number - b.number)
  const down = placed.filter(p => p.direction === 'down').sort((a, b) => a.number - b.number)
  const allFilled = placed.every(p => {
    for (let i = 0; i < p.word.length; i++) {
      const r = p.direction === 'down' ? p.row + i : p.row
      const c = p.direction === 'across' ? p.col + i : p.col
      if (!answers[`${r},${c}`]) return false
    }
    return true
  })

  return <main className="play-card crossword-play">
    <p className="puzzle-help">Тодорхойлолтоор нь үгсийг таагаад бөглөнө үү.</p>
    <div className="crossword-grid" style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}>
      {Array.from({ length: height }).map((_, r) => Array.from({ length: width }).map((_, c) => {
        const entries = cellMap.get(`${r},${c}`)
        const key = `${r},${c}`
        if (!entries || entries.length === 0) return <span key={key} className="cw-empty" />
        const number = entries.find(e => e.index === 0)?.word.number
        const isActive = !!activeWord && entries.some(e => e.word === activeWord)
        const letter = answers[key] || ''
        const correct = checked ? entries[0].word.word[entries[0].index] === letter : null
        const cellWord = (isActive ? activeWord : entries[0].word)
        return <span key={key} className={`cw-cell ${isActive ? 'active' : ''} ${checked ? (correct ? 'correct' : 'wrong') : ''}`}>
          {number ? <small>{number}</small> : null}
          <input
            ref={el => { cellRefs.current[key] = el }}
            value={letter}
            maxLength={1}
            disabled={checked}
            onFocus={() => selectCell(r, c)}
            onChange={e => handleInput(r, c, e.target.value, cellWord)}
            onKeyDown={e => handleKeyDown(r, c, e, cellWord)}
          />
        </span>
      }))}
    </div>
    <div className="crossword-clues">
      <div><h3>Хэвтээ</h3>{across.map(p => <button key={`a-${p.number}`} className={activeWord === p ? 'active' : ''} onClick={() => focusClue(p)}>{p.number}. {p.clue}</button>)}</div>
      <div><h3>Босоо</h3>{down.map(p => <button key={`d-${p.number}`} className={activeWord === p ? 'active' : ''} onClick={() => focusClue(p)}>{p.number}. {p.clue}</button>)}</div>
    </div>
    <button className="btn-primary publish-button" disabled={!allFilled || checked} onClick={check}>{checked ? 'Шалгаж байна...' : 'Шалгах'}</button>
  </main>
}
