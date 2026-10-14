import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const updated = await (db as any).projectDiaryEventRule.update({
    where: { id: params.id },
    data: {
      rule_name: body?.rule_name !== undefined ? String(body.rule_name || '').trim() : undefined,
      event_type_id: body?.event_type_id !== undefined ? (body.event_type_id ? String(body.event_type_id) : null) : undefined,
      event_key: body?.event_key !== undefined ? (body.event_key ? String(body.event_key) : null) : undefined,
      rule_mode: body?.rule_mode !== undefined ? String(body.rule_mode || 'warning') : undefined,
      check_type: body?.check_type !== undefined ? String(body.check_type || '').trim() : undefined,
      check_params: body?.check_params !== undefined ? (body.check_params ?? null) : undefined,
      message: body?.message !== undefined ? String(body.message || '').trim() : undefined,
      sort_order: body?.sort_order !== undefined ? Number(body.sort_order || 0) : undefined,
      is_active: body?.is_active !== undefined ? Boolean(body.is_active) : undefined,
    },
  })
  return NextResponse.json({ data: updated })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error
  await (db as any).projectDiaryEventRule.update({ where: { id: params.id }, data: { is_active: false } })
  return NextResponse.json({ ok: true })
}
