import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/session'

// Grants a driver another full set of attempts (used after they re-attend the training).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
    const { id } = await params
    const body = await req.json()
    if (body.action !== 'grant' || typeof body.user_id !== 'string') return NextResponse.json({ error: 'Мэдээлэл буруу байна' }, { status: 400 })

    const supabase = createAdminClient()
    const [{ data: quiz, error: quizError }, { data: driver, error: driverError }] = await Promise.all([
      supabase.from('daily_quizzes').select('max_attempts, pass_percent, target_shift').eq('id', id).single(),
      supabase.from('users').select('shift_number').eq('id', body.user_id).single(),
    ])
    if (quizError) throw quizError
    if (driverError) throw driverError
    if (!admin.is_super_admin && admin.shift_number && driver.shift_number !== admin.shift_number) {
      return NextResponse.json({ error: 'Зөвхөн өөрийн ээлжийн жолоочид оролдлого нэмнэ' }, { status: 403 })
    }
    if (quiz.pass_percent == null) return NextResponse.json({ error: 'Энэ асуумж тэнцэх босгогүй тул оролдлого нэмэх шаардлагагүй' }, { status: 400 })

    const { data: row, error: rowError } = await supabase.from('quiz_attendees').select('attempts_bonus').eq('quiz_id', id).eq('user_id', body.user_id).maybeSingle()
    if (rowError) throw rowError
    if (!row) return NextResponse.json({ error: 'Энэ жолооч сургалтын ирцэнд бүртгэгдээгүй байна' }, { status: 404 })

    const bonus = (row.attempts_bonus ?? 0) + quiz.max_attempts
    const { error } = await supabase.from('quiz_attendees').update({ attempts_bonus: bonus }).eq('quiz_id', id).eq('user_id', body.user_id)
    if (error) throw error
    return NextResponse.json({ data: { attempts_bonus: bonus } })
  } catch (error) {
    console.error('Grant attempts failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Оролдлого нэмж чадсангүй' }, { status: 500 })
  }
}
