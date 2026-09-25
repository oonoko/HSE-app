import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession, requireAdmin, requireSuperAdmin } from '@/lib/session'

const templates = new Set(['truth_false', 'match', 'puzzle', 'random_box'])
const categories = new Set(['critical_risk_22', 'life_rules_7', 'other'])

function validContent(template: string, content: Record<string, unknown>) {
  if (template === 'puzzle') return typeof content.image_url === 'string' && content.image_url.length > 0
  const values = template === 'match' ? content.pairs : content.items
  if (!Array.isArray(values) || values.length === 0) return false
  if (template === 'match') return values.every(item => typeof item?.left === 'string' && item.left.trim() && typeof item?.right === 'string' && item.right.trim())
  if (template === 'truth_false') return values.every(item => typeof item?.statement === 'string' && item.statement.trim() && typeof item?.answer === 'boolean')
  return values.every(item => typeof item?.prompt === 'string' && item.prompt.trim() && Array.isArray(item?.options) && item.options.length === 3 && item.options.every((value: unknown) => typeof value === 'string' && value.trim()) && Number.isInteger(item?.correct_index) && item.correct_index >= 0 && item.correct_index <= 2)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const admin = searchParams.get('admin') === 'true'
    const session = admin ? await requireAdmin() : await getSession()
    if (!session) return NextResponse.json({ error: 'Нэвтрэх шаардлагатай' }, { status: 401 })
    const supabase = createAdminClient()
    let query = supabase.from('safety_games').select('*').order('created_at', { ascending: false })
    if (!admin) query = query.eq('active', true)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Games GET failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Тоглоом авч чадсангүй' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireSuperAdmin()
    if (!admin) return NextResponse.json({ error: 'Зөвхөн ерөнхий админ тоглоом удирдана' }, { status: 403 })
    const body = await req.json()
    if (!body.title?.trim() || !templates.has(body.template) || !categories.has(body.category) || !validContent(body.template, body.content ?? {})) {
      return NextResponse.json({ error: 'Тоглоомын мэдээлэл дутуу байна' }, { status: 400 })
    }
    const payload = {
      title: body.title.trim(),
      template: body.template,
      category: body.category,
      content: body.content ?? {},
      active: body.active !== false,
      created_by: admin.id,
      updated_at: new Date().toISOString(),
    }
    const supabase = createAdminClient()
    const operation = body.id
      ? supabase.from('safety_games').update(payload).eq('id', body.id)
      : supabase.from('safety_games').insert(payload)
    const { data, error } = await operation.select('*').single()
    if (error) throw error
    return NextResponse.json({ data }, { status: body.id ? 200 : 201 })
  } catch (error) {
    console.error('Games POST failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Тоглоом хадгалж чадсангүй' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireSuperAdmin()
    if (!admin) return NextResponse.json({ error: 'Зөвхөн ерөнхий админ тоглоом устгана' }, { status: 403 })
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Тоглоомын ID шаардлагатай' }, { status: 400 })
    const supabase = createAdminClient()
    const { error } = await supabase.from('safety_games').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Games DELETE failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Тоглоом устгаж чадсангүй' }, { status: 500 })
  }
}
