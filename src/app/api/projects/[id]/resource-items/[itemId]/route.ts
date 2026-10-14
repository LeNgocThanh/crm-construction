import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { createProjectTimelineEvent } from '@/lib/project-timeline'
import { getResourcePlanExecutionState } from '@/lib/projects/resource-plan-execution'

function toBigIntOrUndefined(v: any) {
  if (v === undefined) return undefined
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const body = await req.json().catch(() => ({}))
  const existed = await db.projectResourcePlanItem.findUnique({
    where: { id: params.itemId },
    select: {
      id: true,
      project_id: true,
      plan_id: true,
      quantity: true,
      actual_issued_qty: true,
      actual_received_qty: true,
      actual_returned_qty: true,
    },
  })
  if (!existed || existed.project_id !== params.id) {
    return NextResponse.json({ error: 'Khong tim thay hang muc' }, { status: 404 })
  }
  const plan = await db.projectResourcePlan.findUnique({
    where: { id: existed.plan_id },
    select: { status: true, milestone_id: true },
  })
  const hasActualFlow = Number(existed.actual_issued_qty || 0) > 0 || Number(existed.actual_received_qty || 0) > 0 || Number(existed.actual_returned_qty || 0) > 0
  const [planInventoryPostedCount, planDirectPurchaseConfirmedCount] = await Promise.all([
    db.inventoryTransaction.count({
      where: {
        reference_id: existed.plan_id,
        reference_type: { in: ['project_resource_plan', 'project_resource_plan_return'] },
        status: 'posted',
      },
    }),
    (db as any).projectDirectPurchase.count({
      where: { project_id: params.id, plan_id: existed.plan_id, status: 'confirmed' },
    }),
  ])
  const planLaborAttendanceConfirmedCount = 0
  const planLaborPaymentCount = 0
  const executionState = getResourcePlanExecutionState({
    status: plan?.status,
    inventory_posted_count: planInventoryPostedCount,
    direct_purchase_confirmed_count: planDirectPurchaseConfirmedCount,
    labor_attendance_confirmed_count: planLaborAttendanceConfirmedCount,
    labor_payment_count: planLaborPaymentCount,
  })
  if (executionState === 'locked') {
    return NextResponse.json({ error: 'Ke hoach da khoa, khong the sua item. Tao revision moi.' }, { status: 409 })
  }

  const quantity = body?.quantity !== undefined
    ? (body?.quantity == null || body?.quantity === '' ? null : Number(body.quantity))
    : undefined
  if (quantity !== undefined && quantity != null && (!Number.isFinite(quantity) || quantity < 0)) {
    return NextResponse.json({ error: 'So luong phai >= 0' }, { status: 400 })
  }
  if (quantity !== undefined && quantity != null && hasActualFlow) {
    const consumed = Number(existed.actual_issued_qty || 0) - Number(existed.actual_returned_qty || 0)
    if (quantity < Math.max(0, consumed)) {
      return NextResponse.json({ error: 'Khong duoc giam so luong nho hon so luong da xuat thuc te' }, { status: 409 })
    }
  }
  if (executionState === 'started') {
    const changingKind = body?.resource_kind !== undefined
    const changingItemKey = body?.item_key !== undefined
    const changingLaborTrade = body?.labor_trade_id !== undefined
    if ((changingKind || changingItemKey || changingLaborTrade) && hasActualFlow) {
      return NextResponse.json({ error: 'Item da bat dau thuc hien, khong duoc doi loai/mat tu/loai tho cho item da phat sinh.' }, { status: 409 })
    }
  }
  const unitCost = toBigIntOrUndefined(body?.unit_cost)
  if (unitCost != null && unitCost !== undefined && Number(unitCost) < 0) {
    return NextResponse.json({ error: 'Don gia phai >= 0' }, { status: 400 })
  }
  const estimatedCost = toBigIntOrUndefined(body?.estimated_cost)
  if (estimatedCost != null && estimatedCost !== undefined && Number(estimatedCost) < 0) {
    return NextResponse.json({ error: 'Tong du kien phai >= 0' }, { status: 400 })
  }

  const updated = await db.projectResourcePlanItem.update({
    where: { id: params.itemId },
    data: {
      resource_kind: body?.resource_kind !== undefined ? String(body.resource_kind) : undefined,
      category: body?.category !== undefined ? (body.category ? String(body.category) : null) : undefined,
      item_key: body?.item_key !== undefined ? (body.item_key ? String(body.item_key) : null) : undefined,
      item_name: body?.item_name !== undefined ? String(body.item_name) : undefined,
      spec_text: body?.spec_text !== undefined ? (body.spec_text ? String(body.spec_text) : null) : undefined,
      unit: body?.unit !== undefined ? (body.unit ? String(body.unit) : null) : undefined,
      quantity: quantity,
      unit_cost: unitCost,
      estimated_cost: estimatedCost,
      labor_type: body?.labor_type !== undefined ? (body.labor_type ? String(body.labor_type) : null) : undefined,
      labor_trade_id: body?.labor_trade_id !== undefined ? (body.labor_trade_id ? String(body.labor_trade_id) : null) : undefined,
      worker_count: body?.worker_count !== undefined ? (body.worker_count == null || body.worker_count === '' ? null : Number(body.worker_count)) : undefined,
      work_days: body?.work_days !== undefined ? (body.work_days == null || body.work_days === '' ? null : Number(body.work_days)) : undefined,
      supplier_name: body?.supplier_name !== undefined ? (body.supplier_name ? String(body.supplier_name) : null) : undefined,
      actual_issued_qty: body?.actual_issued_qty !== undefined ? Number(body.actual_issued_qty || 0) : undefined,
      actual_received_qty: body?.actual_received_qty !== undefined ? Number(body.actual_received_qty || 0) : undefined,
      actual_returned_qty: body?.actual_returned_qty !== undefined ? Number(body.actual_returned_qty || 0) : undefined,
      actual_status: body?.actual_status !== undefined ? (body.actual_status ? String(body.actual_status) : null) : undefined,
      last_inventory_txn_id: body?.last_inventory_txn_id !== undefined ? (body.last_inventory_txn_id ? String(body.last_inventory_txn_id) : null) : undefined,
      note: body?.note !== undefined ? (body.note ? String(body.note) : null) : undefined,
      sort_order: body?.sort_order !== undefined ? Number(body.sort_order || 0) : undefined,
      is_active: body?.is_active !== undefined ? Boolean(body.is_active) : undefined,
    },
  })

  await createProjectTimelineEvent({
    project_id: params.id,
    event_key: 'resource_item_updated',
    title: 'Cap nhat hang muc vat tu/nhan cong',
    description: `${updated.item_name} (${updated.resource_kind})`,
    source_ref_type: 'project_resource_plan_item',
    source_ref_id: updated.id,
    actor_user_id: String(session.user.id || '') || null,
  })
  return NextResponse.json({ data: serializeItem(updated) })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const existed = await db.projectResourcePlanItem.findUnique({ where: { id: params.itemId } })
  if (!existed) return NextResponse.json({ error: 'Khong tim thay hang muc' }, { status: 404 })
  const plan = await db.projectResourcePlan.findUnique({
    where: { id: existed.plan_id },
    select: { status: true, milestone_id: true },
  })
  const [planInventoryPostedCount, planDirectPurchaseConfirmedCount] = await Promise.all([
    db.inventoryTransaction.count({
      where: {
        reference_id: existed.plan_id,
        reference_type: { in: ['project_resource_plan', 'project_resource_plan_return'] },
        status: 'posted',
      },
    }),
    (db as any).projectDirectPurchase.count({
      where: { project_id: params.id, plan_id: existed.plan_id, status: 'confirmed' },
    }),
  ])
  const planLaborAttendanceConfirmedCount = 0
  const planLaborPaymentCount = 0
  const executionState = getResourcePlanExecutionState({
    status: plan?.status,
    inventory_posted_count: planInventoryPostedCount,
    direct_purchase_confirmed_count: planDirectPurchaseConfirmedCount,
    labor_attendance_confirmed_count: planLaborAttendanceConfirmedCount,
    labor_payment_count: planLaborPaymentCount,
  })
  if (executionState === 'locked') {
    return NextResponse.json({ error: 'Ke hoach da khoa, khong the xoa item. Tao revision moi.' }, { status: 409 })
  }
  if (executionState === 'started' || (Number(existed.actual_issued_qty || 0) > 0) || (Number(existed.actual_received_qty || 0) > 0) || (Number(existed.actual_returned_qty || 0) > 0)) {
    return NextResponse.json({ error: 'Hang muc da co phat sinh thuc te, khong the xoa' }, { status: 409 })
  }
  await db.projectResourcePlanItem.update({ where: { id: params.itemId }, data: { is_active: false } })
  await createProjectTimelineEvent({
    project_id: params.id,
    event_key: 'resource_item_deleted',
    title: 'Xoa hang muc vat tu/nhan cong',
    description: `${existed.item_name} (${existed.resource_kind})`,
    source_ref_type: 'project_resource_plan_item',
    source_ref_id: existed.id,
    actor_user_id: String(session.user.id || '') || null,
  })
  return NextResponse.json({ ok: true })
}
