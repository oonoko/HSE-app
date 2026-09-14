'use client'

import { useEffect,useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'

type DriverStat={id:string;sap_id:string;name:string;recent:number;previous:number;change:number;status:'improved'|'declined'|'stable'}
type ShiftData={shift:number;drivers:DriverStat[];improved:number;declined:number;stable:number}
export default function MyShiftPage(){const{user,ready,isAdmin}=useApp();const router=useRouter();const[shift,setShift]=useState(String(user?.shift_number||1));const[data,setData]=useState<ShiftData|null>(null)
 useEffect(()=>{if(!ready)return;if(!user){router.push('/login');return}if(!isAdmin){router.push('/');return}fetch(`/api/shift-stats?shift=${shift}`).then(r=>r.json()).then(x=>setData(x.data??null))},[ready,user,isAdmin,router,shift]);if(!user||!isAdmin)return null
 return <div className="app-container admin-page page-enter"><div className="page-heading-row"><div><span className="eyebrow">7 ХОНОГИЙН ХАРЬЦУУЛАЛТ</span><h1>Миний ээлж</h1><p>Өмнөх 7 хоногтой харьцуулсан жолоочдын ахиц</p></div>{user.is_super_admin&&<Link href="/admin/users" className="btn-secondary"><Icon name="users" size={18}/>Ажилтан удирдах</Link>}</div><div className="filter-bar"><label>Ээлж<select value={shift} onChange={e=>setShift(e.target.value)}>{[1,2,3,4].map(n=><option key={n} value={n}>{n}-р ээлж</option>)}</select></label></div>
 {!data?<div className="empty-state"><span className="spinner"/></div>:<><div className="kpi-grid three"><div className="positive"><span>Сайжирсан</span><strong>{data.improved}</strong><small>+10%-аас дээш</small></div><div><span>Тогтвортой</span><strong>{data.stable}</strong><small>±9% дотор</small></div><div className="negative"><span>Муудсан</span><strong>{data.declined}</strong><small>-10%-аас доош</small></div></div><section className="card driver-table"><div className="section-heading"><div><span className="eyebrow">{shift}-Р ЭЭЛЖ</span><h2>{data.drivers.length} жолооч</h2></div></div>{data.drivers.length===0?<div className="empty-mini">Энэ ээлжид жолооч оноогоогүй байна. Ажилтан удирдах хэсгээс ээлжийг тохируулна уу.</div>:data.drivers.map(driver=><div className="driver-row" key={driver.id}><div className="driver-avatar">{driver.name[0]}</div><div><strong>{driver.name}</strong><small>SAP {driver.sap_id}</small></div><div className="score-compare"><small>Өмнөх</small><b>{driver.previous}</b></div><div className="score-compare"><small>Сүүлийн</small><b>{driver.recent}</b></div><span className={`trend ${driver.status}`}>{driver.change>0?'+':''}{driver.change}%</span></div>)}</section></>}
 </div>}
