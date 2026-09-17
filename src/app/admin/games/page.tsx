'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'
import type { GameCategory, GameTemplate, SafetyGame } from '@/types'

type GameItem = { statement:string; answer:boolean; left:string; right:string; prompt:string; options:[string,string,string]; correct_index:number }
const emptyItem=():GameItem=>({statement:'',answer:true,left:'',right:'',prompt:'',options:['','',''],correct_index:0})
const templateNames={truth_false:'Үнэн эсвэл худал',match:'Дүрэм, тайлбар тааруулах',puzzle:'Зураг эвлүүлэх',random_box:'Random box'}
const categoryNames={critical_risk_22:'22 эрсдэл',life_rules_7:'7 дүрэм',other:'Бусад'}

export default function AdminGamesPage(){
 const{user,ready,isAdmin}=useApp();const router=useRouter();const[games,setGames]=useState<SafetyGame[]>([]);const[building,setBuilding]=useState(false);const[title,setTitle]=useState('');const[template,setTemplate]=useState<GameTemplate>('truth_false');const[category,setCategory]=useState<GameCategory>('critical_risk_22');const[items,setItems]=useState<GameItem[]>([emptyItem()]);const[puzzleUrl,setPuzzleUrl]=useState('');const[saving,setSaving]=useState(false);const[error,setError]=useState('')
 const[editingId,setEditingId]=useState<string|null>(null)
 const[pendingDeleteId,setPendingDeleteId]=useState<string|null>(null)
 function load(){fetch('/api/games?admin=true').then(r=>r.json()).then(data=>setGames(data.data??[]))}
 useEffect(()=>{if(!ready)return;if(!user){router.push('/login');return}if(!isAdmin){router.push('/');return}load()},[ready,user,isAdmin,router]);if(!user||!isAdmin)return null
 function update(i:number,patch:Partial<GameItem>){setItems(list=>list.map((item,j)=>j===i?{...item,...patch}:item))}
 async function upload(file:File){const fd=new FormData();fd.append('file',file);const res=await fetch('/api/uploads',{method:'POST',body:fd});const data=await res.json();if(res.ok)setPuzzleUrl(data.data.publicUrl);else setError(data.error)}
 function content(){if(template==='puzzle')return{image_url:puzzleUrl,grid:3};if(template==='match')return{pairs:items.map(({left,right})=>({left,right}))};if(template==='truth_false')return{items:items.map(({statement,answer})=>({statement,answer}))};return{items:items.map(({prompt,options,correct_index})=>({prompt,options,correct_index}))}}
 function startNew(){setEditingId(null);setError('');setTitle('');setTemplate('truth_false');setCategory('critical_risk_22');setItems([emptyItem()]);setPuzzleUrl('');setBuilding(true)}
 function closeBuilder(){setBuilding(false);setEditingId(null)}
 function editGame(game:SafetyGame){
  setEditingId(game.id);setError('');setTitle(game.title);setTemplate(game.template);setCategory(game.category)
  const c=game.content as Record<string,unknown>
  if(game.template==='puzzle'){setPuzzleUrl(String(c.image_url||''));setItems([emptyItem()])}
  else if(game.template==='match'){setPuzzleUrl('');const pairs=(c.pairs as {left:string;right:string}[])??[];setItems(pairs.length?pairs.map(p=>({...emptyItem(),left:p.left,right:p.right})):[emptyItem()])}
  else if(game.template==='truth_false'){setPuzzleUrl('');const list=(c.items as {statement:string;answer:boolean}[])??[];setItems(list.length?list.map(it=>({...emptyItem(),statement:it.statement,answer:it.answer})):[emptyItem()])}
  else{setPuzzleUrl('');const list=(c.items as {prompt:string;options:[string,string,string];correct_index:number}[])??[];setItems(list.length?list.map(it=>({...emptyItem(),prompt:it.prompt,options:it.options,correct_index:it.correct_index})):[emptyItem()])}
  setBuilding(true)
 }
 async function deleteGame(id:string){setPendingDeleteId(null);const res=await fetch(`/api/games?id=${id}`,{method:'DELETE'});const data=await res.json();if(!res.ok){setError(data.error);return}load()}
 async function save(){setSaving(true);setError('');try{const res=await fetch('/api/games',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:editingId||undefined,title,template,category,content:content(),created_by:user!.id})});const data=await res.json();if(!res.ok)throw new Error(data.error);setBuilding(false);setEditingId(null);setTitle('');setItems([emptyItem()]);setPuzzleUrl('');load()}catch(e){setError(e instanceof Error?e.message:'Хадгалж чадсангүй')}finally{setSaving(false)}}
 return <div className="app-container admin-page page-enter"><div className="page-heading-row"><div><span className="eyebrow">МЭДЛЭГ СЭРГЭЭХ</span><h1>Тоглоом үүсгэх</h1><p>Бэлэн template ашиглан тоглоомоо хурдан бэлдэнэ.</p></div><button className="btn-primary" onClick={()=>building?closeBuilder():startNew()}><Icon name={building?'chevron':'plus'} size={18}/>{building?'Жагсаалт':'Шинэ тоглоом'}</button></div>
 {building?<div className="builder-layout"><section className="builder-card card"><div className="form-grid"><label>Тоглоомын нэр<input className="input-field" value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Ангилал<select className="input-field" value={category} onChange={e=>setCategory(e.target.value as GameCategory)}><option value="critical_risk_22">Ноцтой эрсдэлийн 22 тохиолдол</option><option value="life_rules_7">Амин нас хамгаалах 7 дүрэм</option><option value="other">Бусад</option></select></label></div><div className="template-grid">{(Object.keys(templateNames) as GameTemplate[]).map(key=><button className={template===key?'active':''} key={key} onClick={()=>setTemplate(key)}><Icon name={key==='puzzle'?'image':'game'}/><strong>{templateNames[key]}</strong></button>)}</div></section>
 {template==='puzzle'?<section className="builder-card card"><h2>Эвлүүлэх зураг</h2><label className="drop-zone compact"><Icon name="image" size={34}/><span>{puzzleUrl?'Зураг бэлэн':'Зураг сонгох'}</span><input hidden type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&upload(e.target.files[0])}/></label>{puzzleUrl&&<img src={puzzleUrl} className="question-preview" alt=""/>}</section>:<div className="stack-lg">{items.map((item,i)=><section className="builder-card card" key={i}><div className="builder-title"><h2>Даалгавар {i+1}</h2>{items.length>1&&<button className="text-button danger" onClick={()=>setItems(x=>x.filter((_,j)=>j!==i))}>Устгах</button>}</div>
 {template==='truth_false'&&<><label>Өгүүлбэр<textarea className="input-field" value={item.statement} onChange={e=>update(i,{statement:e.target.value})}/></label><div className="segmented"><button className={item.answer?'active':''} onClick={()=>update(i,{answer:true})}>Үнэн</button><button className={!item.answer?'active':''} onClick={()=>update(i,{answer:false})}>Худал</button></div></>}
 {template==='match'&&<div className="form-grid"><label>Дүрэм<input className="input-field" value={item.left} onChange={e=>update(i,{left:e.target.value})}/></label><label>Тайлбар<input className="input-field" value={item.right} onChange={e=>update(i,{right:e.target.value})}/></label></div>}
 {template==='random_box'&&<><label>Гарч ирэх асуулт<textarea className="input-field" value={item.prompt} onChange={e=>update(i,{prompt:e.target.value})}/></label><div className="option-editor">{item.options.map((option,oi)=><label key={oi} className={item.correct_index===oi?'selected':''}><input type="radio" checked={item.correct_index===oi} onChange={()=>update(i,{correct_index:oi})}/><span>{String.fromCharCode(65+oi)}</span><input className="input-field" value={option} onChange={e=>{const options=[...item.options] as [string,string,string];options[oi]=e.target.value;update(i,{options})}}/><small>Зөв</small></label>)}</div></>}
 </section>)}</div>}
 {template!=='puzzle'&&<button className="btn-secondary add-block" onClick={()=>setItems(x=>[...x,emptyItem()])}><Icon name="plus" size={18}/>Даалгавар нэмэх</button>}{error&&<div className="form-error">{error}</div>}<button className="btn-primary publish-button" disabled={saving||!title||(template==='puzzle'&&!puzzleUrl)} onClick={save}>{saving?'Хадгалж байна...':editingId?'Тоглоом хадгалах':'Тоглоом нийтлэх'}</button></div>
 :<div className="admin-list">{games.length===0?<div className="empty-state card"><Icon name="game" size={40}/><h2>Тоглоом байхгүй</h2></div>:games.map(game=><article className="list-card quiz-list-card card" key={game.id}><div className={`list-icon ${game.template}`}><Icon name={game.template==='puzzle'?'image':'game'}/></div><div><span className="status-pill success">Нээлттэй</span><h2>{game.title}</h2><p>{templateNames[game.template]} · {categoryNames[game.category]}</p></div><div className="list-actions">{pendingDeleteId===game.id?<><span className="confirm-text">Итгэлтэй үү?</span><button className="text-button danger" onClick={()=>deleteGame(game.id)}>Тийм, устгах</button><button className="text-button" onClick={()=>setPendingDeleteId(null)}>Үгүй</button></>:<><button className="btn-secondary" onClick={()=>editGame(game)}>Засах</button><button className="text-button danger" onClick={()=>setPendingDeleteId(game.id)}>Устгах</button></>}</div></article>)}</div>}
 </div>
}
