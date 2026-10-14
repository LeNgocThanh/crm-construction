import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { itemId: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const updated = await (db as any).projectMilestoneTemplateItem.update({
    where: { id: params.itemId },
    data: {
      milestone_key: body?.milestone_key !== undefined ? (body.milestone_key ? String(body.milestone_key) : null) : undefined,
      milestone_name: body?.milestone_name !== undefined ? String(body.milestone_name || '') : undefined,
      status_key: body?.status_key !== undefined ? String(body.status_key || 'pending') : undefined,
      due_offset_days: body?.due_offset_days !== undefined ? (body.due_offset_days != null && body.due_offset_days !== '' ? Number(body.due_offset_days) : null) : undefined,
      sort_order: body?.sort_order !== undefined ? Number(body.sort_order || 0) : undefined,
      note: body?.note !== undefined ? (body.note ? String(body.note) : null) : undefined,
      is_active: body?.is_active !== undefined ? Boolean(body.is_active) : undefined,
    },
  })
  return NextResponse.json({ data: updated })
}

export async function DELETE(_: NextRequest, { params }: { params: { itemId: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error
  await (db as any).projectMilestoneTemplateItem.update({ where: { id: params.itemId }, data: { is_active: false } })
  return NextResponse.json({ ok: true })
}

