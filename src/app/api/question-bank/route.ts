import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/session'

type Draft = { id?: string; topic?: string; text?: string; options?: Array<{ text?: string }>; correct_index?: number; explanation?: string; image_url?: string }

const MISSING_TABLE = '42P01'
const isMissingTable = (error: unknown) => !!error && typeof error === 'object' && ('code' in error) && ((error as { code?: string }).code === MISSING_TABLE || (error as { code?: string }).code === 'PGRST205')
const TABLE_HINT = 'Асуултын сангийн хүснэгт үүсээгүй байна. supabase/migrate_question_bank.sql файлыг Supabase SQL Editor дээр ажиллуулна уу.'

function clean(draft: Draft) {
  const topic = String(draft.topic ?? '').trim().slice(0, 80)
  const text = String(draft.text ?? '').trim()
  const options = (draft.options ?? []).map(option => ({ text: String(option?.text ?? '').trim() }))
  const correct = Number(draft.correct_index)
  if (!topic || !text || options.length !== 3 || options.some(option => !option.text) || !Number.isInteger(correct) || correct < 0 || correct > 2) return null
  return { topic, text, options, correct_index: correct, explanation: String(draft.explanation ?? '').trim() || null, image_url: draft.image_url || null }
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
    const { searchParams } = new URL(req.url)
    const topic = searchParams.get('topic')
    let query = supabase().from('question_bank').select('*').order('topic').order('created_at', { ascending: false })
    if (topic) query = query.eq('topic', topic)
    const { data, error } = await query
    if (error) throw error
    const topics = Array.from(new Set((data ?? []).map(item => item.topic))).sort((a, b) => a.localeCompare(b))
    return NextResponse.json({ data: data ?? [], topics })
  } catch (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: TABLE_HINT, setup_required: true }, { status: 503 })
    console.error('Question bank GET failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Асуултын сан авч чадсангүй' }, { status: 500 })
  }
}

function supabase() { return createAdminClient() }

// POST { ...question } creates or (with id) updates one question; POST { items: [...] } adds several,
// skipping any whose topic and text already exist.
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
    const body = await req.json()
    const db = supabase()

    if (Array.isArray(body.items)) {
      const rows = body.items.map((item: Draft) => clean(item)).filter(Boolean) as Array<NonNullable<ReturnType<typeof clean>>>
      if (rows.length === 0) return NextResponse.json({ error: 'Хадгалах бүрэн асуулт алга' }, { status: 400 })
      const { data: existing, error: existingError } = await db.from('question_bank').select('topic, text')
      if (existingError) throw existingError
      const seen = new Set((existing ?? []).map(item => `${item.topic}\u0000${item.text}`))
      const fresh = rows.filter(row => { const key = `${row.topic}\u0000${row.text}`; if (seen.has(key)) return false; seen.add(key); return true })
      if (fresh.length > 0) {
        const { error } = await db.from('question_bank').insert(fresh.map(row => ({ ...row, created_by: admin.id })))
        if (error) throw error
      }
      return NextResponse.json({ data: { added: fresh.length, skipped: rows.length - fresh.length } }, { status: 201 })
    }

    const row = clean(body)
    if (!row) return NextResponse.json({ error: 'Сэдэв, асуулт, 3 хариулт болон зөв хариултыг бүрэн оруулна уу' }, { status: 400 })
    if (body.id) {
      const { data: current, error: currentError } = await db.from('question_bank').select('created_by').eq('id', body.id).single()
      if (currentError) throw currentError
      if (!admin.is_super_admin && current.created_by !== admin.id) return NextResponse.json({ error: 'Зөвхөн өөрийн нэмсэн асуултыг засна' }, { status: 403 })
      const { data, error } = await db.from('question_bank').update({ ...row, updated_at: new Date().toISOString() }).eq('id', body.id).select('*').single()
      if (error) throw error
      return NextResponse.json({ data })
    }
    const { data, error } = await db.from('question_bank').insert({ ...row, created_by: admin.id }).select('*').single()
    if (error) throw error
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: TABLE_HINT, setup_required: true }, { status: 503 })
    console.error('Question bank POST failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Асуулт хадгалж чадсангүй' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'HSE-ийн эрх шаардлагатай' }, { status: 403 })
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID шаардлагатай' }, { status: 400 })
    const db = supabase()
    const { data: current, error: currentError } = await db.from('question_bank').select('created_by').eq('id', id).single()
    if (currentError) throw currentError
    if (!admin.is_super_admin && current.created_by !== admin.id) return NextResponse.json({ error: 'Зөвхөн өөрийн нэмсэн асуултыг устгана' }, { status: 403 })
    const { error } = await db.from('question_bank').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ data: { id } })
  } catch (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: TABLE_HINT, setup_required: true }, { status: 503 })
    console.error('Question bank DELETE failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Асуулт устгаж чадсангүй' }, { status: 500 })
  }
}
