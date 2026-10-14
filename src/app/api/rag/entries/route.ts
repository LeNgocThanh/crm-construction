// src/app/api/rag/entries/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { upsertPoint, ensureCollection, buildEmbedText, deletePoint } from '@/lib/rag/qdrant'
import { appendEntryToSheet, ensureSheetHeader } from '@/lib/rag/sheets'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

// GET — list entries
export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const { searchParams } = new URL(req.url)
  const type     = searchParams.get('type')
  const category = searchParams.get('category')
  const search   = searchParams.get('search')?.trim()
  const page     = parseInt(searchParams.get('page')  || '1')
  const limit    = parseInt(searchParams.get('limit') || '30')

  const where: any = {}
  if (type)     where.type     = type
  if (category) where.category = category
  if (search) {
    where.OR = [
      { question: { contains: search, mode: 'insensitive' } },
      { answer:   { contains: search, mode: 'insensitive' } },
      { tags:     { has: search } },
    ]
  }

  const [data, total] = await Promise.all([
    db.ragEntry.findMany({
      where,
      orderBy: [{ is_active: 'desc' }, { quality: 'desc' }, { created_at: 'desc' }],
      skip:  (page - 1) * limit,
      take:  limit,
      include: { creator: { select: { username: true } } },
    }),
    db.ragEntry.count({ where }),
  ])

  return NextResponse.json({ data, total, page, limit })
}

// POST — create new entry
export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const body = await req.json()
  const { type, category, question, answer, tags, quality } = body

  if (!answer?.trim()) return NextResponse.json({ error: 'Thiếu câu trả lời' }, { status: 400 })
  if (!type)           return NextResponse.json({ error: 'Thiếu loại entry' },  { status: 400 })
  if (type === 'qa' && !question?.trim())
    return NextResponse.json({ error: 'Loại Hỏi-Đáp cần có câu hỏi' }, { status: 400 })

  const entry = await db.ragEntry.create({
    data: {
      type,
      category:   category || null,
      question:   question?.trim() || null,
      answer:     answer.trim(),
      tags:       tags || [],
      quality:    quality || 5,
      created_by: session.user.id,
      is_active:  true,
    },
    include: { creator: { select: { username: true } } },
  })

  // Async: embed + upsert to Qdrant
  const qdrantPromise = (async () => {
    try {
      await ensureCollection()
      const embedText = buildEmbedText(entry)
      await upsertPoint({ id: entry.id, text: embedText, payload: {
        type: entry.type, category: entry.category, question: entry.question,
        answer: entry.answer, tags: entry.tags,
      }})
      await db.ragEntry.update({ where: { id: entry.id }, data: { qdrant_id: entry.id } })
    } catch (err) {
      console.error('[RAG] Qdrant upsert failed:', err)
    }
  })()

  // Async: sync to Google Sheets
  const sheetPromise = (async () => {
    try {
      await ensureSheetHeader()
      const rowNum = await appendEntryToSheet({
        id: entry.id, type, category, question, answer,
        tags, quality, created_by_username: session.user.username,
      })
      if (rowNum) {
        await db.ragEntry.update({ where: { id: entry.id }, data: { sheet_row: rowNum } })
      }
    } catch (err) {
      console.error('[RAG] Sheets sync failed:', err)
    }
  })()

  // Don't await — return immediately, let background tasks run
  Promise.allSettled([qdrantPromise, sheetPromise])

  return NextResponse.json({ data: entry }, { status: 201 })
}
