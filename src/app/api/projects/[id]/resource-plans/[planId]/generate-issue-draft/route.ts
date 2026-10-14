import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { createProjectTimelineEvent } from '@/lib/project-timeline'
import { syncResourcePlanActualsFromInventory } from '@/lib/projects/resource-plan-actuals'

function toNum(v: any): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function POST(req: NextRequest, { params }: { params: { id: string; planId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const body = await req.json().catch(() => ({}))
  const warehouseId = String(body?.warehouse_id || '').trim()
  if (!warehouseId) return NextResponse.json({ error: 'Thieu kho xuat' }, { status: 400 })
  const mode = String(body?.mode || 'remaining').trim() // remaining | planned_full
  const project = await db.constructionProject.findUnique({
    where: { id: params.id },
    select: { id: true, active_material_plan_id: true },
  })
  const activeMaterialPlanId = String((project as any)?.active_material_plan_id || '').trim()
  if (activeMaterialPlanId && activeMaterialPlanId !== String(params.planId || '').trim()) {
    return NextResponse.json({
      error: 'Du an da chot ke hoach vat tu dang van hanh khac. Chi duoc sinh phieu kho tu ke hoach vat tu dang van hanh.',
    }, { status: 409 })
  }

  const plan = await db.projectResourcePlan.findFirst({
    where: {
      id: params.planId,
      project_id: params.id,
      is_active: true,
    },
    include: {
      project: {
        select: {
          id: true,
          project_name: true,
          customer_id: true,
        },
      },
      items: {
        where: { is_active: true, resource_kind: 'material' },
        orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
      },
    },
  })
  if (!plan) return NextResponse.json({ error: 'Khong tim thay ke hoach' }, { status: 404 })
  if (String(plan.status || '') !== 'approved') {
    return NextResponse.json({ error: 'Chi sinh phieu xuat tu ke hoach da duyet' }, { status: 400 })
  }

  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, is_active: true },
    select: { id: true, warehouse_name: true, warehouse_code: true },
  })
  if (!warehouse) return NextResponse.json({ error: 'Kho khong hop le hoac da ngung su dung' }, { status: 400 })

  const existedDraft = await db.inventoryTransaction.findFirst({
    where: {
      reference_type: 'project_resource_plan',
      reference_id: plan.id,
      txn_type: 'out',
      status: 'draft',
    },
    select: { id: true, txn_code: true, status: true },
  })
  if (existedDraft) {
    return NextResponse.json({
      error: 'Ke hoach nay dang co phieu xuat kho nhap, vui long hoan tat hoac huy phieu nhap truoc khi tao phieu moi',
      existing_transaction: existedDraft,
    }, { status: 409 })
  }

  await syncResourcePlanActualsFromInventory(plan.id)
  const latestItems = await db.projectResourcePlanItem.findMany({
    where: { plan_id: plan.id, project_id: params.id, is_active: true, resource_kind: 'material' },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  })

  const skipped: Array<{ item_id: string; item_name: string; reason: string }> = []
  const draftItems = latestItems
    .map((it) => {
      const materialKey = String(it.item_key || '').trim()
      const plannedQty = toNum(it.quantity)
      const receivedQty = Number(it.actual_received_qty || 0)
      const remainingQty = plannedQty != null ? Math.max(0, plannedQty - receivedQty) : null
      const qty = mode === 'planned_full' ? plannedQty : remainingQty
      if (!materialKey) {
        skipped.push({ item_id: it.id, item_name: it.item_name, reason: 'thieu_item_key' })
        return null
      }
      if (qty == null || qty <= 0) {
        skipped.push({ item_id: it.id, item_name: it.item_name, reason: 'so_luong_khong_hop_le' })
        return null
      }
      return {
        material_key: materialKey,
        material_name: it.item_name || materialKey,
        item_unit: it.unit || null,
        quantity: qty,
        note: it.note || null,
      }
    })
    .filter(Boolean) as Array<{ material_key: string; material_name: string; item_unit: string | null; quantity: number; note: string | null }>

  if (!draftItems.length) {
    return NextResponse.json({
      error: 'Khong co item vat tu hop le de sinh phieu xuat',
      skipped,
    }, { status: 400 })
  }

  const now = Date.now()
  const code = `PRJ-OUT-${now}`
  const noteAuto = `Tu ke hoach: ${plan.plan_name} | Du an: ${plan.project?.project_name || plan.project_id}`

  const created = await db.$transaction(async (tx) => {
    const txn = await tx.inventoryTransaction.create({
      data: {
        txn_code: code,
        warehouse_id: warehouse.id,
        txn_type: 'out',
        issue_purpose: 'project_supply',
        txn_date: new Date(),
        reference_type: 'project_resource_plan',
        reference_id: plan.id,
        status: 'draft',
        note: body?.note ? String(body.note) : noteAuto,
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
      include: {
        warehouse: { select: { id: true, warehouse_name: true, warehouse_code: true } },
        items: true,
      },
    })
  })

  await createProjectTimelineEvent({
    project_id: params.id,
    customer_id: plan.project?.customer_id || null,
    event_key: 'inventory_issue_draft_created',
    title: 'Sinh phieu xuat kho nhap tu ke hoach da duyet',
    description: `${plan.plan_name} -> ${warehouse.warehouse_name}`,
    source_ref_type: 'inventory_transaction',
    source_ref_id: created?.id || null,
    actor_user_id: String(session.user.id || '') || null,
    milestone_id: plan.milestone_id || null,
    metadata_json: {
      plan_id: plan.id,
      warehouse_id: warehouse.id,
      item_count: draftItems.length,
      skipped_count: skipped.length,
      skipped,
    },
  })

  return NextResponse.json({
    data: created,
    meta: {
      generated_from_plan_id: plan.id,
      generated_item_count: draftItems.length,
      skipped,
      mode,
    },
  })
}
