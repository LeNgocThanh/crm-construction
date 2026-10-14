import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { syncResourcePlanActualsFromInventory } from '@/lib/projects/resource-plan-actuals'

export async function GET(_: NextRequest, { params }: { params: { id: string; planId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const plan = await db.projectResourcePlan.findFirst({
    where: { id: params.planId, project_id: params.id, is_active: true },
    select: { id: true, plan_name: true, status: true },
  })
  if (!plan) return NextResponse.json({ error: 'Khong tim thay ke hoach' }, { status: 404 })

  await syncResourcePlanActualsFromInventory(plan.id)

  const items = await db.projectResourcePlanItem.findMany({
    where: { plan_id: plan.id, project_id: params.id, is_active: true, resource_kind: 'material' },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  })
  const laborItems = await db.projectResourcePlanItem.findMany({
    where: { plan_id: plan.id, project_id: params.id, is_active: true, resource_kind: 'labor' },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  })
  const allocationModel = (db as any).projectMaterialAllocation
  const allocations = allocationModel
    ? await allocationModel.findMany({ where: { plan_id: plan.id, is_active: true } })
    : []
  const allocatedMap = new Map<string, number>()
  for (const a of allocations || []) {
    const key = String(a?.material_key || '').trim()
    if (!key) continue
    allocatedMap.set(key, (allocatedMap.get(key) || 0) + Number(a?.allocated_qty || 0))
  }

  const normalized = items.map((it) => {
    const planned = Number(it.quantity || 0)
    const issued = Number(it.actual_issued_qty || 0)
    const returned = Number(it.actual_returned_qty || 0)
    const received = Number(it.actual_received_qty || 0)
    const delta = received - planned
    const allocated = allocatedMap.get(String(it.item_key || '').trim()) || 0
    return {
      id: it.id,
      material_key: it.item_key,
      item_name: it.item_name,
      unit: it.unit,
      planned_qty: planned,
      issued_qty: issued,
      returned_qty: returned,
      net_received_qty: received,
      allocated_qty: allocated,
      delta_qty: delta,
      actual_status: it.actual_status || 'pending',
      note: it.note,
    }
  })

  const enough = normalized.filter((x) => x.delta_qty === 0)
  const shortage = normalized.filter((x) => x.delta_qty < 0).map((x) => ({ ...x, shortage_qty: Math.abs(x.delta_qty) }))
  const excess = normalized.filter((x) => x.delta_qty > 0).map((x) => ({ ...x, excess_qty: x.delta_qty }))

  const planMaterialKeys = new Set(
    normalized.map((x) => String(x.material_key || '').trim()).filter(Boolean),
  )
  const directPurchases = await (db as any).projectDirectPurchase.findMany({
    where: { project_id: params.id, plan_id: plan.id, status: 'confirmed' },
    include: { items: true },
  })
  const extraMap = new Map<string, { material_key: string; item_name: string; unit: string; excess_qty: number; source: string }>()
  for (const p of directPurchases) {
    for (const it of p.items || []) {
      const key = String(it?.material_key || '').trim()
      if (!key || planMaterialKeys.has(key)) continue
      const qty = Number(it?.quantity || 0)
      if (!(qty > 0)) continue
      const prev = extraMap.get(key)
      if (prev) {
        prev.excess_qty += qty
      } else {
        extraMap.set(key, {
          material_key: key,
          item_name: String(it?.material_name || key),
          unit: String(it?.item_unit || ''),
          excess_qty: qty,
          source: 'direct_purchase_out_of_plan',
        })
      }
    }
  }
  const excessOutOfPlan = Array.from(extraMap.values())
  const allExcess = [...excess, ...excessOutOfPlan]

  const laborAttendances = await db.projectLaborAttendance.findMany({
    where: {
      project_id: params.id,
      engagement: { is: { plan_id: plan.id } },
    },
    include: {
      engagement: { select: { trade_id: true } },
      worker: { select: { trade_id: true } },
    },
  })
  const laborActualMap = new Map<string, number>()
  for (const att of laborAttendances || []) {
    const key = String(att?.engagement?.trade_id || att?.worker?.trade_id || '').trim()
    if (!key) continue
    laborActualMap.set(key, (laborActualMap.get(key) || 0) + Number(att?.work_qty || 0))
  }
  const laborNormalized = laborItems.map((it) => {
    const key = String((it as any).labor_trade_id || it.item_key || '').trim()
    const planned = Number(it.quantity || 0)
    const actual = Number(laborActualMap.get(key) || 0)
    const delta = actual - planned
    return {
      id: it.id,
      labor_trade_id: (it as any).labor_trade_id || null,
      material_key: key,
      item_name: it.item_name,
      unit: it.unit,
      planned_qty: planned,
      actual_qty: actual,
      delta_qty: delta,
      actual_status: it.actual_status || 'pending',
      note: it.note,
    }
  })
  const laborEnough = laborNormalized.filter((x) => x.delta_qty === 0)
  const laborShortage = laborNormalized.filter((x) => x.delta_qty < 0).map((x) => ({ ...x, shortage_qty: Math.abs(x.delta_qty) }))
  const laborExcess = laborNormalized.filter((x) => x.delta_qty > 0).map((x) => ({ ...x, excess_qty: x.delta_qty }))

  return NextResponse.json({
    data: {
      plan,
      totals: {
        total_items: normalized.length,
        enough_items: enough.length,
        shortage_items: shortage.length,
        excess_items: allExcess.length,
      },
      enough,
      shortage,
      excess: allExcess,
      excess_out_of_plan: excessOutOfPlan,
      all_items: normalized,
      labor_totals: {
        total_items: laborNormalized.length,
        enough_items: laborEnough.length,
        shortage_items: laborShortage.length,
        excess_items: laborExcess.length,
      },
      labor_enough: laborEnough,
      labor_shortage: laborShortage,
      labor_excess: laborExcess,
      labor_all_items: laborNormalized,
    },
  })
}
