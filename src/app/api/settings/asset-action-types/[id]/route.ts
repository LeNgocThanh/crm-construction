import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const patch: any = {}
  if (body?.action_key !== undefined) {
    const actionKey = String(body.action_key || '').trim().toLowerCase()
    if (!actionKey) return NextResponse.json({ error: 'action_key khong hop le' }, { status: 400 })
    if (!/^[a-z0-9_]+$/.test(actionKey)) return NextResponse.json({ error: 'action_key chi gom a-z, 0-9, _' }, { status: 400 })
    patch.action_key = actionKey
  }
  if (body?.action_name !== undefined) {
    const actionName = String(body.action_name || '').trim()
    if (!actionName) return NextResponse.json({ error: 'action_name khong hop le' }, { status: 400 })
    patch.action_name = actionName
  }
  if (body?.category !== undefined) patch.category = body.category ? String(body.category) : 'lifecycle'
  if (body?.requires_due_at !== undefined) patch.requires_due_at = Boolean(body.requires_due_at)
  if (body?.requires_note !== undefined) patch.requires_note = Boolean(body.requires_note)
  if (body?.requires_customer !== undefined) patch.requires_customer = Boolean(body.requires_customer)
  if (body?.requires_project !== undefined) patch.requires_project = Boolean(body.requires_project)
  if (body?.requires_handover_from !== undefined) patch.requires_handover_from = Boolean(body.requires_handover_from)
  if (body?.requires_handover_to !== undefined) patch.requires_handover_to = Boolean(body.requires_handover_to)
  if (body?.apply_owner_transfer !== undefined) patch.apply_owner_transfer = Boolean(body.apply_owner_transfer)
  if (body?.requires_warranty_from_date !== undefined) patch.requires_warranty_from_date = Boolean(body.requires_warranty_from_date)
  if (body?.requires_warranty_to_date !== undefined) patch.requires_warranty_to_date = Boolean(body.requires_warranty_to_date)
  if (body?.requires_warranty_provider !== undefined) patch.requires_warranty_provider = Boolean(body.requires_warranty_provider)
  if (body?.requires_attachment !== undefined) patch.requires_attachment = Boolean(body.requires_attachment)
  if (body?.requires_status_to !== undefined) patch.requires_status_to = Boolean(body.requires_status_to)
  if (body?.requires_quantity !== undefined) patch.requires_quantity = Boolean(body.requires_quantity)
  if (body?.allowed_status_to_json !== undefined) patch.allowed_status_to_json = body.allowed_status_to_json ?? null
  if (body?.form_schema_json !== undefined) patch.form_schema_json = body.form_schema_json ?? null
  if (body?.document_template_key !== undefined) patch.document_template_key = body.document_template_key ? String(body.document_template_key) : null
  if (body?.default_priority !== undefined) patch.default_priority = body.default_priority ? String(body.default_priority) : null
  if (body?.is_active !== undefined) patch.is_active = Boolean(body.is_active)
  if (body?.sort_order !== undefined) patch.sort_order = Number(body.sort_order || 0)
  if (body?.description !== undefined) patch.description = body.description ? String(body.description) : null

  const data = await db.assetActionType.update({ where: { id: params.id }, data: patch })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  await db.assetActionType.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
