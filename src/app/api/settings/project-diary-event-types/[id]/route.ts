import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const updated = await (db as any).projectDiaryEventType.update({
    where: { id: params.id },
    data: {
      event_name: body?.event_name !== undefined ? String(body.event_name || '').trim() : undefined,
      category: body?.category !== undefined ? (body.category ? String(body.category) : null) : undefined,
      description: body?.description !== undefined ? (body.description ? String(body.description) : null) : undefined,
      schema_json: body?.schema_json !== undefined ? (body.schema_json ?? null) : undefined,
      default_severity: body?.default_severity !== undefined ? (body.default_severity ? String(body.default_severity) : null) : undefined,
      default_investor_visible: body?.default_investor_visible !== undefined ? Boolean(body.default_investor_visible) : undefined,
      sort_order: body?.sort_order !== undefined ? Number(body.sort_order || 0) : undefined,
      is_active: body?.is_active !== undefined ? Boolean(body.is_active) : undefined,
    },
  })
  return NextResponse.json({ data: updated })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error
  await (db as any).projectDiaryEventType.update({ where: { id: params.id }, data: { is_active: false } })
  return NextResponse.json({ ok: true })
}
