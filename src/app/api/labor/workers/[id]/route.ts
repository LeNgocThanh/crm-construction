import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, requireManageRole, parseOptionalBigInt, parseOptionalString, normalizeKey } from '@/lib/labor/server'

function serialize(row: any) {
  return {
    ...row,
    default_rate: row.default_rate != null ? String(row.default_rate) : null,
    skill_level: row.skill_level
      ? {
          ...row.skill_level,
          default_rate: row.skill_level.default_rate != null ? String(row.skill_level.default_rate) : null,
        }
      : null,
  }
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr

  const body = await req.json()
  const data = await db.laborWorker.update({
    where: { id: ctx.params.id },
    data: {
      worker_code: body?.worker_code !== undefined ? normalizeKey(body.worker_code) : undefined,
      full_name: body?.full_name !== undefined ? String(body.full_name || '').trim() : undefined,
      phone: body?.phone !== undefined ? parseOptionalString(body.phone) : undefined,
      trade_id: body?.trade_id !== undefined ? parseOptionalString(body.trade_id) : undefined,
      crew_id: body?.crew_id !== undefined ? parseOptionalString(body.crew_id) : undefined,
      skill_level_id: body?.skill_level_id !== undefined ? parseOptionalString(body.skill_level_id) : undefined,
      worker_category: body?.worker_category !== undefined ? parseOptionalString(body.worker_category) : undefined,
      employment_mode: body?.employment_mode !== undefined ? parseOptionalString(body.employment_mode) : undefined,
      default_unit_text: body?.default_unit_text !== undefined ? parseOptionalString(body.default_unit_text) : undefined,
      default_rate: body?.default_rate !== undefined ? parseOptionalBigInt(body.default_rate) : undefined,
      home_area: body?.home_area !== undefined ? parseOptionalString(body.home_area) : undefined,
      status: body?.status !== undefined ? parseOptionalString(body.status) || 'active' : undefined,
      notes: body?.notes !== undefined ? parseOptionalString(body.notes) : undefined,
      is_active: body?.is_active !== undefined ? Boolean(body.is_active) : undefined,
    },
    include: {
      trade: { select: { id: true, trade_key: true, trade_name: true } },
      crew: { select: { id: true, crew_key: true, crew_name: true } },
      skill_level: { select: { id: true, skill_key: true, skill_name: true, default_rate: true } },
    },
  })
  return NextResponse.json({ data: serialize(data) })
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr
  await db.laborWorker.delete({ where: { id: ctx.params.id } })
  return NextResponse.json({ data: { ok: true } })
}
