import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, requireManageRole, parseOptionalBigInt, parseOptionalInt, parseOptionalString, normalizeKey } from '@/lib/labor/server'

function serialize(row: any) {
  return {
    ...row,
    default_rate: row.default_rate != null ? String(row.default_rate) : null,
  }
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr

  const body = await req.json()
  const data = await db.laborTrade.update({
    where: { id: ctx.params.id },
    data: {
      trade_key: body?.trade_key !== undefined ? normalizeKey(body.trade_key) : undefined,
      trade_name: body?.trade_name !== undefined ? String(body.trade_name || '').trim() : undefined,
      unit_text: body?.unit_text !== undefined ? parseOptionalString(body.unit_text) : undefined,
      default_rate: body?.default_rate !== undefined ? parseOptionalBigInt(body.default_rate) : undefined,
      description: body?.description !== undefined ? parseOptionalString(body.description) : undefined,
      sort_order: body?.sort_order !== undefined ? (parseOptionalInt(body.sort_order) ?? 0) : undefined,
      is_active: body?.is_active !== undefined ? Boolean(body.is_active) : undefined,
    },
  })
  return NextResponse.json({ data: serialize(data) })
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr

  await db.laborTrade.delete({ where: { id: ctx.params.id } })
  return NextResponse.json({ data: { ok: true } })
}
