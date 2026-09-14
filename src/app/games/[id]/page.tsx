'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'
import type { SafetyGame } from '@/types'

type Item = { statement?: string; prompt?: string; answer?: boolean; explanation?: string; options?: string[]; correct_index?: number; left?: string; right?: string }

export default function GamePlayPage() {
  const { id } = useParams<{ id: string }>(); const { user, ready } = useApp(); const router = useRouter()
  const [game, setGame] = useState<SafetyGame | null>(null); const [score, setScore] = useState(0); const [done, setDone] = useState(false); const started = useRef(Date.now())
  useEffect(() => { if (!ready) return; if (!user) { router.push('/login'); return } fetch('/api/games').then(r => r.json()).then(data => setGame((data.data ?? []).find((item: SafetyGame) => item.id === id) ?? null)) }, [ready, user, id, router])
  async function complete(finalScore: number) { if (!user || !game || done) return; setScore(finalScore); setDone(true); await fetch('/api/game-attempts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game_id: game.id, user_id: user.id, score: finalScore, duration_seconds: Math.round((Date.now() - started.current) / 1000) }) }) }
  if (!game) return <div className="empty-state"><span className="spinner" />Тоглоом ачааллаж байна...</div>
  if (done) return <div className="app-container result-page page-enter"><div className="result-mark"><Icon name="trophy" size={38}/></div><span className="eyebrow">ТОГЛООМ ДУУССАН</span><h1>{score.toLocaleString()} оноо</h1><p>Энэ оноо таны нийт болон rank оноонд нэмэгдлээ.</p><div className="button-row"><button className="btn-quiet" onClick={() => router.push('/games')}>Тоглоом сонгох</button><button className="btn-primary" onClick={() => location.reload()}>Дахин тоглох</button></div></div>
  return <div className="game-play page-enter"><div className="game-play-header"><button className="icon-button light" onClick={() => router.push('/games')}>←</button><div><span>{game.template === 'truth_false' ? 'Үнэн эсвэл худал' : game.template === 'match' ? 'Дүрэм тааруулах' : game.template === 'puzzle' ? 'Зураг эвлүүлэх' : 'Random box'}</span><h1>{game.title}</h1></div><strong>{score}</strong></div>
    {game.template === 'puzzle' ? <PuzzleGame game={game} onComplete={complete}/> : <QuestionGame game={game} score={score} setScore={setScore} onComplete={complete}/>}</div>
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

function PuzzleGame({ game, onComplete }: { game: SafetyGame; onComplete: (score: number) => void }) {
  const content = game.content as { image_url?: string; grid?: number }; const grid = Math.min(4, Math.max(2, content.grid || 3)); const count = grid * grid
  const [tiles, setTiles] = useState<number[]>(() => Array.from({length:count},(_,i)=>i).sort(()=>Math.random()-.5)); const [selected, setSelected] = useState<number | null>(null)
  function pick(position: number) { if (selected === null) { setSelected(position); return } const next=[...tiles]; [next[selected],next[position]]=[next[position],next[selected]]; setTiles(next); setSelected(null); if(next.every((value,i)=>value===i)) setTimeout(()=>onComplete(count*100),500) }
  if (!content.image_url) return <div className="empty-state card">Эвлүүлэх зураг ороогүй байна.</div>
  return <main className="play-card"><p className="puzzle-help">Хоёр хэсгийг дараалан сонгож байрыг нь солино.</p><div className="puzzle-grid" style={{gridTemplateColumns:`repeat(${grid},1fr)`}}>{tiles.map((tile,pos)=><button key={pos} className={selected===pos?'selected':''} onClick={()=>pick(pos)} style={{backgroundImage:`url(${content.image_url})`,backgroundSize:`${grid*100}% ${grid*100}%`,backgroundPosition:`${(tile%(grid))*100/(grid-1)}% ${Math.floor(tile/grid)*100/(grid-1)}%`}} aria-label={`Хэсэг ${pos+1}`}/>)}</div></main>
}
