// src/app/api/rag/entries/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { upsertPoint, deletePoint, ensureCollection, buildEmbedText } from '@/lib/rag/qdrant'
import { updateSheetRow } from '@/lib/rag/sheets'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

// PUT — update entry
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const { type, category, question, answer, tags, quality, is_active } = body

  const entry = await db.ragEntry.update({
    where: { id: params.id },
    data: {
      ...(type       !== undefined && { type }),
      ...(category   !== undefined && { category }),
      ...(question   !== undefined && { question }),
      ...(answer     !== undefined && { answer }),
      ...(tags       !== undefined && { tags }),
      ...(quality    !== undefined && { quality }),
      ...(is_active  !== undefined && { is_active }),
    },
    include: { creator: { select: { username: true } } },
  })

  // Re-embed if content changed
  if (answer !== undefined || question !== undefined) {
    try {
      await ensureCollection()
      await upsertPoint({ id: entry.id, text: buildEmbedText(entry), payload: {
        type: entry.type, category: entry.category, question: entry.question,
        answer: entry.answer, tags: entry.tags,
      }})
      if (!entry.qdrant_id) {
        await db.ragEntry.update({ where: { id: entry.id }, data: { qdrant_id: entry.id } })
      }
    } catch (err) {
      console.error('[RAG] Qdrant update failed:', err)
    }
  }

  // If deactivated, update sheet status
  if (is_active === false && entry.sheet_row) {
    updateSheetRow(entry.sheet_row, 'Đã xóa').catch(() => {})
  } else if (is_active === true && entry.sheet_row) {
    updateSheetRow(entry.sheet_row, 'Hoạt động').catch(() => {})
  }

  return NextResponse.json({ data: entry })
}

// DELETE — hard delete
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const entry = await db.ragEntry.findUnique({ where: { id: params.id } })
  if (!entry) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })

  // Delete from Qdrant
  try { await deletePoint(params.id) } catch (err) { console.error('[RAG] Qdrant delete failed:', err) }

  // Update sheet
  if (entry.sheet_row) updateSheetRow(entry.sheet_row, 'Đã xóa').catch(() => {})

  await db.ragEntry.delete({ where: { id: params.id } })
  return NextResponse.json({ message: 'Đã xóa' })
}
