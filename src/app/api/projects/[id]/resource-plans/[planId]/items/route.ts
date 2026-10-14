import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { createProjectTimelineEvent } from '@/lib/project-timeline'

function toBigIntOrNull(v: any) {
  if (v == null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return BigInt(Math.round(n))
}

function serializeItem(row: any) {
  return {
    ...row,
    unit_cost: row?.unit_cost != null ? Number(row.unit_cost) : null,
    estimated_cost: row?.estimated_cost != null ? Number(row.estimated_cost) : null,
  }
}

export async function GET(_: NextRequest, { params }: { params: { id: string; planId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const rows = await db.projectResourcePlanItem.findMany({
    where: { project_id: params.id, plan_id: params.planId, is_active: true },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  })
  return NextResponse.json({ data: rows.map(serializeItem) })
}

export async function POST(req: NextRequest, { params }: { params: { id: string; planId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const body = await req.json().catch(() => ({}))
  const plan = await db.projectResourcePlan.findUnique({
    where: { id: params.planId },
    select: { id: true, project_id: true, status: true },
  })
  if (!plan || plan.project_id !== params.id) {
    return NextResponse.json({ error: 'Khong tim thay ke hoach' }, { status: 404 })
  }
  if (String(plan.status || '') === 'locked') {
    return NextResponse.json({ error: 'Ke hoach da khoa, khong the them item. Tao revision moi.' }, { status: 409 })
  }
  const itemName = String(body?.item_name || '').trim()
  if (!itemName) return NextResponse.json({ error: 'Thieu ten hang muc' }, { status: 400 })

  const quantity = body?.quantity != null && body?.quantity !== '' ? Number(body.quantity) : null
  if (quantity != null && (!Number.isFinite(quantity) || quantity < 0)) {
    return NextResponse.json({ error: 'So luong phai >= 0' }, { status: 400 })
  }
  const unitCost = toBigIntOrNull(body?.unit_cost)
  if (unitCost != null && Number(unitCost) < 0) {
    return NextResponse.json({ error: 'Don gia phai >= 0' }, { status: 400 })
  }
  const estimatedCost =
    body?.estimated_cost != null && body?.estimated_cost !== ''
      ? toBigIntOrNull(body.estimated_cost)
      : (quantity != null && unitCost != null ? BigInt(Math.round(Number(unitCost) * quantity)) : null)
  if (estimatedCost != null && Number(estimatedCost) < 0) {
    return NextResponse.json({ error: 'Tong du kien phai >= 0' }, { status: 400 })
  }

  const created = await db.projectResourcePlanItem.create({
    data: {
      project_id: params.id,
      plan_id: params.planId,
      resource_kind: String(body?.resource_kind || 'material'),
      category: body?.category ? String(body.category) : null,
      item_key: body?.item_key ? String(body.item_key) : null,
      item_name: itemName,
      spec_text: body?.spec_text ? String(body.spec_text) : null,
      unit: body?.unit ? String(body.unit) : null,
      quantity: quantity != null && Number.isFinite(quantity) ? quantity : null,
      unit_cost: unitCost,
      estimated_cost: estimatedCost,
      labor_type: body?.labor_type ? String(body.labor_type) : null,
      labor_trade_id: body?.labor_trade_id ? String(body.labor_trade_id) : null,
      worker_count: body?.worker_count != null && body?.worker_count !== '' ? Number(body.worker_count) : null,
      work_days: body?.work_days != null && body?.work_days !== '' ? Number(body.work_days) : null,
      supplier_name: body?.supplier_name ? String(body.supplier_name) : null,
      note: body?.note ? String(body.note) : null,
      sort_order: Number(body?.sort_order || 0),
      created_by: String(session.user.id || '') || null,
    },
  })

  await createProjectTimelineEvent({
    project_id: params.id,
    event_key: 'resource_item_created',
    title: 'Them hang muc vat tu/nhan cong',
    description: `${created.item_name} (${created.resource_kind})`,
    source_ref_type: 'project_resource_plan_item',
    source_ref_id: created.id,
    actor_user_id: String(session.user.id || '') || null,
    metadata_json: {
      plan_id: created.plan_id,
      resource_kind: created.resource_kind,
      quantity: created.quantity,
      unit: created.unit,
      estimated_cost: created.estimated_cost ? Number(created.estimated_cost) : null,
    },
  })

  return NextResponse.json({ data: serializeItem(created) }, { status: 201 })
}
