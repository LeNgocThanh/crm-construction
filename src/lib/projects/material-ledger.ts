import type { Prisma } from '@prisma/client'

function toInt(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function toNum(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function appendProjectLedgerFromInventoryTxn(
  tx: Prisma.TransactionClient,
  txnId: string,
  actorUserId?: string | null,
) {
  const txn = await tx.inventoryTransaction.findUnique({
    where: { id: txnId },
    include: { items: true },
  })
  if (!txn || txn.status !== 'posted') return { appended: 0, projectId: null as string | null }

  let projectId: string | null = null
  let direction: 'in' | 'out' | null = null
  if (txn.reference_type === 'project_resource_plan' && txn.txn_type === 'out') {
    const plan = await tx.projectResourcePlan.findUnique({
      where: { id: String(txn.reference_id || '') },
      select: { project_id: true },
    })
    projectId = plan?.project_id || null
    direction = 'in'
  } else if (txn.reference_type === 'project_resource_plan_return' && txn.txn_type === 'in') {
    const plan = await tx.projectResourcePlan.findUnique({
      where: { id: String(txn.reference_id || '') },
      select: { project_id: true },
    })
    projectId = plan?.project_id || null
    direction = 'out'
  }
  if (!projectId || !direction) return { appended: 0, projectId: null as string | null }

  const existed = await tx.projectMaterialLedger.count({
    where: { source_type: 'inventory_txn', source_id: txn.id },
  })
  if (existed > 0) return { appended: 0, projectId }

  let appended = 0
  for (const it of txn.items || []) {
    const qty = toNum(it.quantity)
    if (!qty || qty <= 0) continue
    const unitPrice = toInt(it.unit_price)
    const line = toInt(it.line_total) || Math.round(qty * unitPrice)
    await tx.projectMaterialLedger.create({
      data: {
        project_id: projectId,
        direction,
        source_type: 'inventory_txn',
        source_id: txn.id,
        supplier_id: txn.supplier_id || null,
        catalog_item_id: it.catalog_item_id || null,
        material_key: String(it.material_key || ''),
        material_name: it.material_name || null,
        item_unit: it.item_unit || null,
        quantity: qty,
        unit_price: unitPrice > 0 ? BigInt(unitPrice) : null,
        line_total: line > 0 ? BigInt(line) : null,
        note: txn.txn_code || null,
        happened_at: txn.txn_date || new Date(),
        created_by: actorUserId || txn.created_by || null,
      },
    })
    appended += 1
  }
  return { appended, projectId }
}

