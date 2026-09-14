'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'
type Entry = { rank:number; user_id:string; name:string; department:string; shift_number?:number; total_score:number; sessions_completed:number; is_current_user?:boolean }
type Period = 'today' | 'month'
export default function LeaderboardPage() {
  const { user, ready } = useApp(); const router = useRouter(); const [period, setPeriod] = useState<Period>('today'); const [shift, setShift] = useState(''); const [entries, setEntries] = useState<Entry[]>([]); const [loading, setLoading] = useState(true)
  useEffect(() => { if (!ready) return; if (!user) { router.push('/login'); return } setLoading(true); const query = new URLSearchParams({ user_id: user.id, period }); if (shift) query.set('shift', shift); fetch(`/api/leaderboard?${query}`).then(r => r.json()).then(result => setEntries(result.data ?? [])).finally(() => setLoading(false)) }, [ready, user, router, period, shift])
  if (!user) return null
  const top = entries.slice(0, 3); const rest = entries.slice(3); const current = entries.find(item => item.is_current_user)
  return <div className="app-container page-enter"><section className="page-title"><span className="eyebrow">ОНООНЫ САМБАР</span><h1>{period === 'today' ? 'Өнөөдрийн rank' : 'Энэ сарын rank'}</h1><p>Асуумж болон бүх тоглолтын онооны нийлбэр</p></section><div className="rank-controls"><div className="segmented grow"><button className={period==='today'?'active':''} onClick={()=>setPeriod('today')}>Өнөөдөр</button><button className={period==='month'?'active':''} onClick={()=>setPeriod('month')}>Энэ сар</button></div><select value={shift} onChange={e=>setShift(e.target.value)}><option value="">Бүх ээлж</option>{[1,2,3,4].map(n=><option value={n} key={n}>{n}-р ээлж</option>)}</select></div>
    {loading ? <div className="empty-state"><span className="spinner"/></div> : entries.length === 0 ? <div className="empty-state card"><Icon name="trophy" size={40}/><h2>Оноо хараахан бүртгэгдээгүй</h2></div> : <><section className="podium-card card"><div className="top-three driver-top">{top.map((entry,index)=><div className={`top-person place-${index+1}`} key={entry.user_id}><span>{index+1}</span><div className="podium-avatar">{entry.name[0]}</div><strong>{entry.name}</strong><small>{entry.shift_number ? `${entry.shift_number}-р ээлж` : 'Ээлжгүй'}</small><b>{entry.total_score.toLocaleString()}</b></div>)}</div></section>{current && <div className="my-rank-card"><span>Миний байр</span><strong>#{current.rank}</strong><b>{current.total_score.toLocaleString()} оноо</b></div>}<section className="card rank-table driver-ranks">{rest.map(entry=><div key={entry.user_id} className={entry.is_current_user?'current':''}><span>{entry.rank}</span><div><strong>{entry.name}{entry.is_current_user?' · Та':''}</strong><small>{entry.shift_number?`${entry.shift_number}-р ээлж`:entry.department} · {entry.sessions_completed} удаа</small></div><b>{entry.total_score.toLocaleString()}</b></div>)}</section></>}
  </div>
}
