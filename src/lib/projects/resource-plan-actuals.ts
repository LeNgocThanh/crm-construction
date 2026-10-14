import { db } from '@/lib/db'

type NumMap = Map<string, number>

function addQty(map: NumMap, key: string, qty: number) {
  const prev = map.get(key) || 0
  map.set(key, prev + qty)
}

export async function syncResourcePlanActualsFromInventory(planId: string) {
  const plan = await db.projectResourcePlan.findUnique({
    where: { id: planId },
    include: {
      items: { where: { is_active: true, resource_kind: 'material' } },
    },
  })
  if (!plan) return { ok: false, reason: 'plan_not_found' as const }

  const outTxns = await db.inventoryTransaction.findMany({
    where: {
      reference_type: 'project_resource_plan',
      reference_id: planId,
      status: 'posted',
      txn_type: { in: ['out', 'transfer_out'] },
    },
    include: { items: true },
  })

  const returnTxns = await db.inventoryTransaction.findMany({
    where: {
      reference_type: 'project_resource_plan_return',
      reference_id: planId,
      status: 'posted',
      txn_type: { in: ['in', 'transfer_in'] },
    },
    include: { items: true },
  })

  const issuedMap: NumMap = new Map()
  const returnedMap: NumMap = new Map()
  const lastTxnByKey: Map<string, string> = new Map()

  for (const txn of outTxns) {
    for (const it of txn.items) {
      const key = String(it.material_key || '').trim()
      if (!key) continue
      addQty(issuedMap, key, Number(it.quantity || 0))
      lastTxnByKey.set(key, txn.id)
    }
  }
  for (const txn of returnTxns) {
    for (const it of txn.items) {
      const key = String(it.material_key || '').trim()
      if (!key) continue
      addQty(returnedMap, key, Number(it.quantity || 0))
      lastTxnByKey.set(key, txn.id)
    }
  }

  const directPurchases = await (db as any).projectDirectPurchase.findMany({
    where: { plan_id: planId, status: 'confirmed' },
    include: { items: true },
  })
  for (const dp of directPurchases) {
    for (const it of dp.items || []) {
      const key = String(it.material_key || '').trim()
      if (!key) continue
      addQty(issuedMap, key, Number(it.quantity || 0))
      lastTxnByKey.set(key, String(dp.id || ''))
    }
  }

  const allocationModel = (db as any).projectMaterialAllocation
  const allocations = allocationModel
    ? await allocationModel.findMany({ where: { plan_id: planId, is_active: true } })
    : []
  const allocatedMap: NumMap = new Map()
  for (const a of allocations || []) {
    const key = String(a?.material_key || '').trim()
    if (!key) continue
    addQty(allocatedMap, key, Number(a?.allocated_qty || 0))
  }

  const updates = plan.items.map((item) => {
    const materialKey = String(item.item_key || '').trim()
    const planned = Number(item.quantity || 0)
    const issued = materialKey ? (issuedMap.get(materialKey) || 0) : 0
    const returned = materialKey ? (returnedMap.get(materialKey) || 0) : 0
    const allocated = materialKey ? (allocatedMap.get(materialKey) || 0) : 0
    const netReceived = Math.max(0, issued - returned + allocated)
    const delta = netReceived - planned
    const status =
      planned <= 0
        ? 'pending'
        : delta === 0
          ? 'enough'
          : delta < 0
            ? 'shortage'
            : 'excess'
    return {
      id: item.id,
      actual_issued_qty: issued,
      actual_returned_qty: returned,
      actual_received_qty: netReceived,
      actual_status: status,
      last_inventory_txn_id: materialKey ? (lastTxnByKey.get(materialKey) || null) : null,
    }
  })

  await db.$transaction(
    updates.map((u) =>
      db.projectResourcePlanItem.update({
        where: { id: u.id },
        data: u,
      }),
    ),
  )

  return { ok: true, updated_count: updates.length }
}
