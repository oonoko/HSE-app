import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/session'

export async function GET(req: NextRequest){
 try{
  const admin=await requireAdmin();if(!admin)return NextResponse.json({error:'HSE-ийн эрх шаардлагатай'},{status:403})
  const shift=Number(new URL(req.url).searchParams.get('shift'));if(!shift||shift<1||shift>4)return NextResponse.json({error:'Ээлж сонгоно уу'},{status:400})
  if(!admin.is_super_admin&&admin.shift_number!==shift)return NextResponse.json({error:'Зөвхөн өөрийн ээлжийг харна'},{status:403})
  const now=Date.now(),recentStart=new Date(now-7*86400000).toISOString(),previousStart=new Date(now-14*86400000).toISOString();const supabase=createAdminClient()
  const[{data:users,error:ue},{data:quiz,error:qe},{data:games,error:ge}]=await Promise.all([
   supabase.from('users').select('id,sap_id,name,shift_number,total_score').eq('role','driver').eq('shift_number',shift),
   supabase.from('quiz_attempts').select('user_id,score,completed_at').eq('completed',true).gte('completed_at',previousStart),
   supabase.from('game_attempts').select('user_id,score,played_at').gte('played_at',previousStart),
  ]);if(ue)throw ue;if(qe)throw qe;if(ge)throw ge
  const scores:Record<string,{recent:number;previous:number}>={};const add=(id:string,score:number,date:string)=>{scores[id]??={recent:0,previous:0};if(date>=recentStart)scores[id].recent+=score;else scores[id].previous+=score}
  quiz?.forEach(x=>add(x.user_id,x.score,x.completed_at));games?.forEach(x=>add(x.user_id,x.score,x.played_at))
  const rows=(users??[]).map(user=>{const value=scores[user.id]??{recent:0,previous:0};const change=value.previous?Math.round((value.recent-value.previous)/value.previous*100):value.recent?100:0;return{...user,...value,change,status:change>=10?'improved':change<=-10?'declined':'stable'}}).sort((a,b)=>b.recent-a.recent)
  return NextResponse.json({data:{shift,drivers:rows,improved:rows.filter(x=>x.status==='improved').length,declined:rows.filter(x=>x.status==='declined').length,stable:rows.filter(x=>x.status==='stable').length}})
 }catch(error){console.error('Shift stats failed:',error instanceof Error?error.message:error);return NextResponse.json({error:'Ээлжийн мэдээлэл авч чадсангүй'},{status:500})}
}
