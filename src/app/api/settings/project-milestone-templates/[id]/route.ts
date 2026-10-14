import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const updated = await (db as any).projectMilestoneTemplate.update({
    where: { id: params.id },
    data: {
      template_name: body?.template_name !== undefined ? String(body.template_name || '').trim() : undefined,
      description: body?.description !== undefined ? (body.description ? String(body.description) : null) : undefined,
      house_type: body?.house_type !== undefined ? (body.house_type ? String(body.house_type) : null) : undefined,
      sort_order: body?.sort_order !== undefined ? Number(body.sort_order || 0) : undefined,
      is_active: body?.is_active !== undefined ? Boolean(body.is_active) : undefined,
    },
  })
  return NextResponse.json({ data: updated })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  await (db as any).projectMilestoneTemplate.update({ where: { id: params.id }, data: { is_active: false } })
  return NextResponse.json({ ok: true })
}

