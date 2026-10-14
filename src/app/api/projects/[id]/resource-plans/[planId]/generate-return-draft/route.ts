import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { createProjectTimelineEvent } from '@/lib/project-timeline'
import { syncResourcePlanActualsFromInventory } from '@/lib/projects/resource-plan-actuals'

export async function POST(req: NextRequest, { params }: { params: { id: string; planId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const body = await req.json().catch(() => ({}))
  const warehouseId = String(body?.warehouse_id || '').trim()
  if (!warehouseId) return NextResponse.json({ error: 'Thieu kho nhap lai' }, { status: 400 })
  const project = await db.constructionProject.findUnique({
    where: { id: params.id },
    select: { id: true, active_material_plan_id: true },
  })
  const activeMaterialPlanId = String((project as any)?.active_material_plan_id || '').trim()
  if (activeMaterialPlanId && activeMaterialPlanId !== String(params.planId || '').trim()) {
    return NextResponse.json({
      error: 'Du an da chot ke hoach vat tu dang van hanh khac. Chi duoc sinh phieu nhap lai tu ke hoach vat tu dang van hanh.',
    }, { status: 409 })
  }

  const plan = await db.projectResourcePlan.findFirst({
    where: { id: params.planId, project_id: params.id, is_active: true },
    include: {
      project: { select: { id: true, project_name: true, customer_id: true } },
      items: { where: { is_active: true, resource_kind: 'material' }, orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }] },
    },
  })
  if (!plan) return NextResponse.json({ error: 'Khong tim thay ke hoach' }, { status: 404 })

  await syncResourcePlanActualsFromInventory(plan.id)
  const items = await db.projectResourcePlanItem.findMany({
    where: { plan_id: plan.id, project_id: params.id, is_active: true, resource_kind: 'material' },
  })

  const draftItems = items
    .map((it) => {
      const planned = Number(it.quantity || 0)
      const received = Number(it.actual_received_qty || 0)
      const excess = Math.max(0, received - planned)
      const key = String(it.item_key || '').trim()
      if (!key || excess <= 0) return null
      return {
        material_key: key,
        material_name: it.item_name || key,
        item_unit: it.unit || null,
        quantity: excess,
        note: it.note || null,
      }
    })
    .filter(Boolean) as Array<{ material_key: string; material_name: string; item_unit: string | null; quantity: number; note: string | null }>

  if (!draftItems.length) {
    return NextResponse.json({ error: 'Khong co vat tu thua de tao phieu nhap lai' }, { status: 400 })
  }

  const now = Date.now()
  const code = `PRJ-RET-${now}`
  const created = await db.$transaction(async (tx) => {
    const txn = await tx.inventoryTransaction.create({
      data: {
        txn_code: code,
        warehouse_id: warehouseId,
        txn_type: 'in',
        reference_type: 'project_resource_plan_return',
        reference_id: plan.id,
        status: 'draft',
        note: body?.note ? String(body.note) : `Nhap lai vat tu thua | Ke hoach: ${plan.plan_name}`,
        created_by: String(session.user.id || ''),
      },
    })
    for (const it of draftItems) {
      await tx.inventoryTransactionItem.create({
        data: {
          txn_id: txn.id,
          material_key: it.material_key,
          material_name: it.material_name,
          item_unit: it.item_unit,
          quantity: it.quantity,
          unit_price: null,
          line_total: null,
          note: it.note,
        },
      })
    }
    return tx.inventoryTransaction.findUnique({
      where: { id: txn.id },
      include: { items: true, warehouse: { select: { id: true, warehouse_name: true, warehouse_code: true } } },
    })
  })

  await createProjectTimelineEvent({
    project_id: params.id,
    customer_id: plan.project?.customer_id || null,
    event_key: 'inventory_return_draft_created',
    title: 'Sinh phieu nhap lai vat tu thua',
    description: `${plan.plan_name} -> ${created?.warehouse?.warehouse_name || '-'}`,
    source_ref_type: 'inventory_transaction',
    source_ref_id: created?.id || null,
    actor_user_id: String(session.user.id || '') || null,
    milestone_id: plan.milestone_id || null,
  })

  return NextResponse.json({ data: created })
}
