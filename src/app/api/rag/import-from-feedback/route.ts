// src/app/api/rag/import-from-feedback/route.ts
// Import liked bot messages vào RAG với AI dedup check

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { searchSimilar, upsertPoint, ensureCollection, buildEmbedText } from '@/lib/rag/qdrant'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

const OLLAMA_BASE       = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const MODEL             = process.env.OLLAMA_MODEL    || 'gemma3:4b'
const SIMILAR_THRESHOLD = 0.88

// ── GET: danh sách pending để preview ──────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp     = new URL(req.url).searchParams
  const convId = sp.get('conversation_id')

  const where: any = {
    feedback:    'liked',
    sender_type: 'bot',
    rag_status:  { in: ['pending', 'similar', 'error'] },
  }
  if (convId) where.conversation_id = convId

  const likedMsgs = await db.message.findMany({
    where,
    orderBy: { created_at: 'asc' },
    include: {
      conversation: { select: { id: true, channel: true, display_name: true } },
    },
  })

  const preview = await Promise.all(likedMsgs.map(async (msg) => {
    const prevMsg = await db.message.findFirst({
      where: {
        conversation_id: msg.conversation_id,
        direction:       'in',
        sender_type:     'customer',
        created_at:      { lt: msg.created_at },
      },
      orderBy: { created_at: 'desc' },
    })
    return {
      id:                  msg.id,
      bot_answer:          msg.content,
      customer_question:   prevMsg?.content || null,
      rag_status:          msg.rag_status,
      rag_entry_id:        msg.rag_entry_id,
      conversation:        msg.conversation,
      created_at:          msg.created_at,
    }
  }))

  return NextResponse.json({ data: preview, total: preview.length })
}

// ── POST: chạy import ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const { message_ids, force_override = false } = await req.json()

  await ensureCollection()

  const where: any = { feedback: 'liked', sender_type: 'bot' }
  if (message_ids?.length) {
    where.id = { in: message_ids }
  } else {
    where.rag_status = { in: ['pending', 'similar'] }
  }

  const msgs    = await db.message.findMany({ where, orderBy: { created_at: 'asc' } })
  const results: any[] = []

  for (const msg of msgs) {
    const prevMsg = await db.message.findFirst({
      where: {
        conversation_id: msg.conversation_id,
        direction:       'in',
        sender_type:     'customer',
        created_at:      { lt: msg.created_at },
      },
      orderBy: { created_at: 'desc' },
    })

    const question = prevMsg?.content || null
    const answer   = await cleanAnswer(msg.content)

    if (!answer || answer.length < 10) {
      results.push({ id: msg.id, status: 'skipped', reason: 'Answer quá ngắn' })
      await db.message.update({ where: { id: msg.id }, data: { rag_status: 'skipped' } })
      continue
    }

    // Check trùng Qdrant
    const searchText = question ? `${question}\n${answer}` : answer
    try {
      const similar = await searchSimilar(searchText, 1, SIMILAR_THRESHOLD)
      if (similar.length > 0 && !force_override) {
        results.push({
          id: msg.id, status: 'similar',
          score:           similar[0].score,
          similar_question: similar[0].question,
          similar_answer:   similar[0].answer,
          similar_pg_id:    similar[0].pg_id,
          question, answer,
        })
        await db.message.update({ where: { id: msg.id }, data: { rag_status: 'similar' } })
        continue
      }
    } catch (err) {
      console.error('[RAG IMPORT] Qdrant search error:', err)
    }

    // Import
    try {
      const entry = await db.ragEntry.create({
        data: {
          type:              'qa',
          question,
          answer,
          source:            'chat_feedback',
          source_message_id: msg.id,
          created_by:        session.user.id,
          is_active:         true,
          quality:           8,
        },
      })

      const embedText = buildEmbedText(entry)
      await upsertPoint({
        id:   entry.id,
        text: embedText,
        payload: {
          type:     entry.type,
          category: entry.category,
          question: entry.question,
          answer:   entry.answer,
          tags:     entry.tags,
        },
      })

      await db.ragEntry.update({
        where: { id: entry.id },
        data:  { qdrant_id: entry.id },
      })

      await db.message.update({
        where: { id: msg.id },
        data:  { rag_status: 'imported', rag_entry_id: entry.id },
      })

      results.push({ id: msg.id, status: 'imported', entry_id: entry.id, question, answer })

    } catch (err: any) {
      results.push({ id: msg.id, status: 'error', reason: err.message, question, answer })
      await db.message.update({
        where: { id: msg.id },
        data:  { rag_status: 'error' } as any,
      })
    }
  }

  const summary = {
    total:    results.length,
    imported: results.filter(r => r.status === 'imported').length,
    similar:  results.filter(r => r.status === 'similar').length,
    skipped:  results.filter(r => r.status === 'skipped').length,
    error:    results.filter(r => r.status === 'error').length,
  }

  return NextResponse.json({ summary, results })
}

async function cleanAnswer(text: string): Promise<string> {
  if (text.length < 50) return text
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt: `Làm sạch câu trả lời sau để lưu vào knowledge base. Giữ nguyên thông tin chính, bỏ các câu mở đầu thừa như "Như mình đã chia sẻ...", "Bạn vui lòng...", lời kêu gọi để lại SĐT. Trả về chỉ câu trả lời đã làm sạch, không thêm gì khác.\n\nCâu trả lời gốc: ${text}\n\nCâu trả lời đã làm sạch:`,
        stream: false,
        options: { temperature: 0.1, num_predict: 400 },
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return text
    const data    = await res.json()
    const cleaned = (data.response || '').trim()
    return cleaned.length > 10 ? cleaned : text
  } catch {
    return text
  }
}
