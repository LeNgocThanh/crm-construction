import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureCollection, scrollPoints } from '@/lib/rag/qdrant'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

const ALLOWED_TYPES = new Set(['qa', 'knowledge', 'price', 'process', 'policy'])

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const apply = Boolean(body?.apply)
  const limit = Math.max(1, Math.min(50000, Number(body?.limit || 10000)))

  await ensureCollection()
  const points = await scrollPoints({ limit })

  let scanned = 0
  let invalid = 0
  let matchedByPgId = 0
  let created = 0
  let updated = 0
  const warnings: Array<{ point_id: string; reason: string }> = []

  for (const p of points) {
    scanned++
    const payload = p.payload || {}
    const answer = String(payload.answer || '').trim()
    if (!answer) {
      invalid++
      continue
    }
    const rawType = String(payload.type || 'knowledge').trim().toLowerCase()
    const type = ALLOWED_TYPES.has(rawType) ? rawType : 'knowledge'
    const category = payload.category ? String(payload.category) : null
    const question = payload.question ? String(payload.question) : null
    const tags = Array.isArray(payload.tags) ? payload.tags.map((x) => String(x)).filter(Boolean) : []
    const pgId = payload.pg_id ? String(payload.pg_id) : null

    let existing: { id: string } | null = null
    if (pgId) {
      existing = await db.ragEntry.findUnique({ where: { id: pgId }, select: { id: true } })
      if (existing) matchedByPgId++
    }
    if (!existing) {
      existing = await db.ragEntry.findFirst({
        where: { type, question, answer },
        select: { id: true },
      })
    }

    if (!apply) {
      if (existing) updated++
      else created++
      continue
    }

    try {
      if (existing) {
        await db.ragEntry.update({
          where: { id: existing.id },
          data: {
            type,
            category,
            question,
            answer,
            tags,
            is_active: true,
            qdrant_id: existing.id,
            source: 'manual',
          },
        })
        updated++
      } else {
        const row = await db.ragEntry.create({
          data: {
            type,
            category,
            question,
            answer,
            tags,
            is_active: true,
            source: 'manual',
          },
          select: { id: true },
        })
        await db.ragEntry.update({
          where: { id: row.id },
          data: { qdrant_id: row.id },
        })
        created++
      }
    } catch (err: any) {
      warnings.push({
        point_id: p.id,
        reason: String(err?.message || 'db_write_failed'),
      })
    }
  }

  return NextResponse.json({
    data: {
      mode: apply ? 'apply' : 'preview',
      scanned,
      invalid,
      matched_by_pg_id: matchedByPgId,
      will_create: apply ? undefined : created,
      will_update: apply ? undefined : updated,
      created: apply ? created : undefined,
      updated: apply ? updated : undefined,
      warnings: warnings.slice(0, 30),
    },
  })
}
