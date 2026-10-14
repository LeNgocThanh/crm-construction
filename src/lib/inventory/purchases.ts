import { db } from '@/lib/db'

export function purchaseRequestCode() {
  return `PR-${Date.now()}`
}

export function purchaseOrderCode() {
  return `PO-${Date.now()}`
}

export function toOptionalNumber(value: any) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function serializePurchaseRequest(row: any) {
  const items = Array.isArray(row?.items)
    ? row.items.map((item: any) => ({
      ...item,
      suggested_unit_price: item?.suggested_unit_price != null ? Number(item.suggested_unit_price) : null,
      quantity: Number(item?.quantity || 0),
    }))
    : []
  return { ...row, items }
}

export function serializePurchaseOrder(row: any) {
  const items = Array.isArray(row?.items)
    ? row.items.map((item: any) => {
      const orderedQty = Number(item?.ordered_qty || 0)
      const receivedQty = Number(item?.received_qty || 0)
      const draftReceiptQty = Number(item?.draft_receipt_qty || 0)
      const remainingQty = Math.max(0, orderedQty - receivedQty - draftReceiptQty)
      return {
        ...item,
        ordered_qty: orderedQty,
        received_qty: receivedQty,
        draft_receipt_qty: draftReceiptQty,
        remaining_qty: remainingQty,
        unit_price: item?.unit_price != null ? Number(item.unit_price) : null,
      }
    })
    : []
  return { ...row, items }
}

export async function syncPurchaseOrderReceiptSummary(orderId: string) {
  const order = await (db as any).inventoryPurchaseOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  })
  if (!order) return null

  const txns = await db.inventoryTransaction.findMany({
    where: {
      reference_type: 'purchase_order',
      reference_id: orderId,
      txn_type: 'in',
      status: { in: ['draft', 'posted'] },
    },
    include: { items: true },
  })

  const draftMap = new Map<string, number>()
  const postedMap = new Map<string, number>()
  for (const txn of txns) {
    const target = txn.status === 'posted' ? postedMap : draftMap
    for (const item of txn.items || []) {
      const key = String(item.material_key || '').trim()
      if (!key) continue
      target.set(key, Number(target.get(key) || 0) + Number(item.quantity || 0))
    }
  }

  await db.$transaction(async (tx) => {
    for (const item of order.items || []) {
      const key = String(item.material_key || '').trim()
      await (tx as any).inventoryPurchaseOrderItem.update({
        where: { id: item.id },
        data: {
          received_qty: Number(postedMap.get(key) || 0),
          draft_receipt_qty: Number(draftMap.get(key) || 0),
        },
      })
    }

    const nextItems = await (tx as any).inventoryPurchaseOrderItem.findMany({
      where: { order_id: orderId },
    })

    const totalOrdered = nextItems.reduce((sum: number, item: any) => sum + Number(item.ordered_qty || 0), 0)
    const totalReceived = nextItems.reduce((sum: number, item: any) => sum + Number(item.received_qty || 0), 0)
    let nextStatus = order.status
    if (order.status !== 'cancelled') {
      if (totalOrdered > 0 && totalReceived >= totalOrdered - 0.000001) nextStatus = 'completed'
      else if (totalReceived > 0) nextStatus = 'partial_received'
      else if (order.status === 'partial_received' || order.status === 'completed') nextStatus = 'confirmed'
    }

    await (tx as any).inventoryPurchaseOrder.update({
      where: { id: orderId },
      data: { status: nextStatus },
    })
  })

  return (db as any).inventoryPurchaseOrder.findUnique({
    where: { id: orderId },
    include: {
      warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
      supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
      request: { select: { id: true, request_code: true, status: true } },
      items: true,
    },
  })
}
