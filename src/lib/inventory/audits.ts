export function inventoryAuditCode() {
  return `AUD-${Date.now()}`
}

export function inventoryAuditAdjustTxnCode() {
  return `AUDJ-${Date.now()}`
}

export function toNumberOrNull(value: any) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function summarizeAuditItems(items: any[]) {
  let totalItems = 0
  let countedItems = 0
  let varianceItems = 0
  let totalVarianceValue = 0

  for (const item of items || []) {
    totalItems += 1
    const countedQty = toNumberOrNull(item?.counted_qty)
    const varianceQty = toNumberOrNull(item?.variance_qty)
    const avgUnitCost = Number(item?.avg_unit_cost || 0)
    if (countedQty != null) countedItems += 1
    if (varianceQty != null && Math.abs(varianceQty) > 0.000001) varianceItems += 1
    totalVarianceValue += Math.round((varianceQty || 0) * avgUnitCost)
  }

  return {
    total_items: totalItems,
    counted_items: countedItems,
    variance_items: varianceItems,
    total_variance_value: totalVarianceValue,
  }
}

export function serializeInventoryAudit(row: any) {
  const items = Array.isArray(row?.items)
    ? row.items.map((item: any) => ({
      ...item,
      avg_unit_cost: item?.avg_unit_cost != null ? Number(item.avg_unit_cost) : 0,
      variance_value: item?.variance_value != null ? Number(item.variance_value) : 0,
      book_qty: Number(item?.book_qty || 0),
      counted_qty: item?.counted_qty != null ? Number(item.counted_qty) : null,
      variance_qty: item?.variance_qty != null ? Number(item.variance_qty) : null,
    }))
    : []

  return {
    ...row,
    total_variance_value: row?.total_variance_value != null ? Number(row.total_variance_value) : 0,
    applied_txn_code: row?.applied_txn?.txn_code || null,
    items,
  }
}
