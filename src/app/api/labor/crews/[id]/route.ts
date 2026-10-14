import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, requireManageRole, parseOptionalInt, parseOptionalString, normalizeKey } from '@/lib/labor/server'

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr

  const body = await req.json()
  const data = await db.laborCrew.update({
    where: { id: ctx.params.id },
    data: {
      crew_key: body?.crew_key !== undefined ? normalizeKey(body.crew_key) : undefined,
      crew_name: body?.crew_name !== undefined ? String(body.crew_name || '').trim() : undefined,
      leader_name: body?.leader_name !== undefined ? parseOptionalString(body.leader_name) : undefined,
      phone: body?.phone !== undefined ? parseOptionalString(body.phone) : undefined,
      description: body?.description !== undefined ? parseOptionalString(body.description) : undefined,
      sort_order: body?.sort_order !== undefined ? (parseOptionalInt(body.sort_order) ?? 0) : undefined,
      is_active: body?.is_active !== undefined ? Boolean(body.is_active) : undefined,
    },
  })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr
  await db.laborCrew.delete({ where: { id: ctx.params.id } })
  return NextResponse.json({ data: { ok: true } })
}
