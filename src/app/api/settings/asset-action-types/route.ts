import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = String(sp.get('active_only') || 'false') === 'true'
  const category = String(sp.get('category') || '').trim()
  const where: any = {}
  if (activeOnly) where.is_active = true
  if (category) where.category = category

  const data = await db.assetActionType.findMany({
    where,
    orderBy: [{ sort_order: 'asc' }, { action_name: 'asc' }],
  })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const actionKey = String(body?.action_key || '').trim().toLowerCase()
  const actionName = String(body?.action_name || '').trim()
  if (!actionKey || !actionName) return NextResponse.json({ error: 'Thieu action_key hoac action_name' }, { status: 400 })
  if (!/^[a-z0-9_]+$/.test(actionKey)) return NextResponse.json({ error: 'action_key chi gom a-z, 0-9, _' }, { status: 400 })

  const data = await db.assetActionType.create({
    data: {
      action_key: actionKey,
      action_name: actionName,
      category: body?.category ? String(body.category) : 'lifecycle',
      requires_due_at: Boolean(body?.requires_due_at),
      requires_note: Boolean(body?.requires_note),
      requires_customer: Boolean(body?.requires_customer),
      requires_project: Boolean(body?.requires_project),
      requires_handover_from: Boolean(body?.requires_handover_from),
      requires_handover_to: Boolean(body?.requires_handover_to),
      apply_owner_transfer: Boolean(body?.apply_owner_transfer),
      requires_warranty_from_date: Boolean(body?.requires_warranty_from_date),
      requires_warranty_to_date: Boolean(body?.requires_warranty_to_date),
      requires_warranty_provider: Boolean(body?.requires_warranty_provider),
      requires_attachment: Boolean(body?.requires_attachment),
      requires_status_to: Boolean(body?.requires_status_to),
      requires_quantity: Boolean(body?.requires_quantity),
      allowed_status_to_json: body?.allowed_status_to_json ?? null,
      form_schema_json: body?.form_schema_json ?? null,
      document_template_key: body?.document_template_key ? String(body.document_template_key) : null,
      default_priority: body?.default_priority ? String(body.default_priority) : null,
      is_active: body?.is_active === undefined ? true : Boolean(body.is_active),
      sort_order: Number(body?.sort_order || 0),
      description: body?.description ? String(body.description) : null,
    },
  })
  return NextResponse.json({ data }, { status: 201 })
}
