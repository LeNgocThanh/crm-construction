import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error
  const existing = await db.projectMilestoneStatus.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Khong tim thay status' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const patch: any = {}
  if (body?.status_name !== undefined) patch.status_name = body.status_name ? String(body.status_name) : existing.status_name
  if (body?.sort_order !== undefined) patch.sort_order = Number(body.sort_order || 0)
  if (body?.is_active !== undefined) patch.is_active = Boolean(body.is_active)
  const updated = await db.projectMilestoneStatus.update({
    where: { id: params.id },
    data: patch,
  })
  return NextResponse.json({ data: updated })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error
  const existing = await db.projectMilestoneStatus.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Khong tim thay status' }, { status: 404 })
  await db.projectMilestoneStatus.update({
    where: { id: params.id },
    data: { is_active: false },
  })
  return NextResponse.json({ ok: true })
}

