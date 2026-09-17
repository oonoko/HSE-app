'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'
import type { SafetyGame } from '@/types'

const templateNames = { truth_false: 'Үнэн эсвэл худал', match: 'Дүрэм тааруулах', puzzle: 'Зураг эвлүүлэх', random_box: 'Random box' }
const categoryNames = { critical_risk_22: '22 ноцтой эрсдэл', life_rules_7: '7 амин дүрэм', other: 'Бусад' }

export default function GamesPage() {
  const { user, ready } = useApp(); const router = useRouter(); const [games, setGames] = useState<SafetyGame[]>([]); const [loading, setLoading] = useState(true)
  useEffect(() => { if (!ready) return; if (!user) { router.push('/login'); return } fetch('/api/games').then(r => r.json()).then(data => setGames(data.data ?? [])).finally(() => setLoading(false)) }, [ready, user, router])
  if (!user) return null
  return <div className="app-container page-enter"><section className="page-title"><span className="eyebrow">МЭДЛЭГ СЭРГЭЭХ</span><h1>Тоглоом сонгох</h1><p>Тоглох бүрдээ оноогоо нэмээрэй.</p></section>
    <div className="category-row"><span>Ноцтой эрсдэлийн 22 тохиолдол</span><span>Амин нас хамгаалах 7 дүрэм</span><span>Бусад</span></div>
    {loading ? <div className="empty-state"><span className="spinner" /></div> : games.length === 0 ? <div className="empty-state card"><Icon name="game" size={40}/><h2>Тоглоом хараахан ороогүй байна</h2><p>HSE-ийн ажилтан эхний тоглоомыг нийтэлсний дараа энд харагдана.</p></div> : <div className="game-grid">{games.map(game => <Link href={`/games/${game.id}`} className="game-card" key={game.id}><div className={`game-visual ${game.template}`}><Icon name={game.template === 'puzzle' ? 'image' : 'game'} size={30}/></div><div><span className="game-type">{templateNames[game.template]}</span><h2>{game.title}</h2><p>{categoryNames[game.category]}</p></div><Icon name="chevron" size={20}/></Link>)}</div>}
  </div>
}
