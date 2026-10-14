import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const updated = await (db as any).projectMilestoneRule.update({
    where: { id: params.id },
    data: {
      rule_name: body?.rule_name !== undefined ? String(body.rule_name || '').trim() : undefined,
      milestone_definition_id: body?.milestone_definition_id !== undefined ? (body.milestone_definition_id ? String(body.milestone_definition_id) : null) : undefined,
      milestone_key: body?.milestone_key !== undefined ? (body.milestone_key ? String(body.milestone_key) : null) : undefined,
      trigger_status_key: body?.trigger_status_key !== undefined ? String(body.trigger_status_key || 'completed') : undefined,
      check_type: body?.check_type !== undefined ? String(body.check_type || '').trim() : undefined,
      check_params: body?.check_params !== undefined ? (body.check_params ?? null) : undefined,
      warning_message: body?.warning_message !== undefined ? String(body.warning_message || '').trim() : undefined,
      sort_order: body?.sort_order !== undefined ? Number(body.sort_order || 0) : undefined,
      is_active: body?.is_active !== undefined ? Boolean(body.is_active) : undefined,
    },
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  await (db as any).projectMilestoneRule.update({ where: { id: params.id }, data: { is_active: false } })
  return NextResponse.json({ ok: true })
}
