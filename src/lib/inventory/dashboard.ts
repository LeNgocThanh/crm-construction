import { db } from '@/lib/db'

function toNumber(value: any) {
  if (value == null) return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function safeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? Number(v) : v))) as T
}

const STALE_STOCK_DAYS = 45
const DRAFT_TXN_DAYS = 2
const PRICE_SPIKE_PERCENT = 15

function daysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

export async function getInventoryDashboardData(input?: {
  warehouse_id?: string | null
  date_from?: string | null
  date_to?: string | null
}) {
  const warehouseId = String(input?.warehouse_id || '').trim()
  const dateFromText = String(input?.date_from || '').trim()
  const dateToText = String(input?.date_to || '').trim()

  const dateFrom = dateFromText ? new Date(dateFromText) : startOfMonth(new Date())
  const dateTo = dateToText ? new Date(dateToText) : endOfMonth(new Date())
  if (dateToText) dateTo.setHours(23, 59, 59, 999)

  const stockWhere: any = {}
  const txnWhere: any = {
    txn_date: {
      gte: dateFrom,
      lte: dateTo,
    },
  }
  if (warehouseId) {
    stockWhere.warehouse_id = warehouseId
    txnWhere.warehouse_id = warehouseId
  }

  const [stocks, txns, warehouseCount, oldDraftTxns, priceLogs, projectPlanItems, purchaseOrders, projectIssueDraftCount] = await Promise.all([
    db.warehouseStock.findMany({
      where: stockWhere,
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
      },
      orderBy: [{ stock_value: 'desc' }, { updated_at: 'desc' }],
    }),
    db.inventoryTransaction.findMany({
      where: txnWhere,
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        supplier: { select: { id: true, supplier_name: true } },
        items: true,
      },
      orderBy: [{ txn_date: 'desc' }, { created_at: 'desc' }],
      take: 200,
    }),
    db.warehouse.count({ where: warehouseId ? { id: warehouseId } : {} }),
    db.inventoryTransaction.findMany({
      where: {
        ...(warehouseId ? { warehouse_id: warehouseId } : {}),
        status: 'draft',
        created_at: { lte: daysAgo(DRAFT_TXN_DAYS) },
      },
      include: {
        warehouse: { select: { id: true, warehouse_name: true, warehouse_code: true } },
        supplier: { select: { id: true, supplier_name: true } },
        items: true,
      },
      orderBy: [{ created_at: 'asc' }],
      take: 30,
    }),
    db.inventoryMaterialPriceLog.findMany({
      where: {
        effective_at: { gte: daysAgo(90) },
        ...(warehouseId ? { warehouse_id: warehouseId } : {}),
      },
      include: {
        warehouse: { select: { id: true, warehouse_name: true, warehouse_code: true } },
        supplier: { select: { id: true, supplier_name: true } },
      },
      orderBy: [{ effective_at: 'desc' }],
      take: 500,
    }),
    db.projectResourcePlanItem.findMany({
      where: {
        resource_kind: 'material',
        is_active: true,
        plan: {
          status: { in: ['approved', 'locked'] },
        },
      },
      include: {
        project: { select: { id: true, project_name: true } },
        plan: { select: { id: true, plan_name: true, status: true } },
      },
      orderBy: [{ updated_at: 'desc' }],
      take: 500,
    }),
    (db as any).inventoryPurchaseOrder.findMany({
      where: {
        ...(warehouseId ? { warehouse_id: warehouseId } : {}),
        status: { in: ['confirmed', 'partial_received'] },
        expected_date: { lt: new Date() },
      },
      include: {
        supplier: { select: { id: true, supplier_name: true, supplier_code: true } },
        warehouse: { select: { id: true, warehouse_name: true, warehouse_code: true } },
        items: true,
      },
      orderBy: [{ expected_date: 'asc' }],
      take: 80,
    }),
    db.inventoryTransaction.count({
      where: {
        ...(warehouseId ? { warehouse_id: warehouseId } : {}),
        txn_type: 'out',
        status: 'draft',
        reference_type: 'project_resource_plan',
      },
    }),
  ])

  const mappedStocks = stocks.map((row: any) => ({
    id: String(row.id || ''),
    warehouse_id: String(row.warehouse_id || ''),
    warehouse_name: row.warehouse?.warehouse_name || '-',
    warehouse_code: row.warehouse?.warehouse_code || '',
    material_key: row.material_key || '',
    material_name: row.material_name || null,
    item_unit: row.item_unit || null,
    on_hand_qty: Number(row.on_hand_qty || 0),
    reserved_qty: Number(row.reserved_qty || 0),
    available_qty: Number(row.on_hand_qty || 0) - Number(row.reserved_qty || 0),
    avg_unit_cost: toNumber(row.avg_unit_cost),
    stock_value: toNumber(row.stock_value),
    min_qty: row.min_qty != null ? Number(row.min_qty) : null,
    last_in_at: row.last_in_at,
    last_out_at: row.last_out_at,
    updated_at: row.updated_at,
  }))

  const materialKeySet = new Set<string>()
  let totalOnHandQty = 0
  let totalAvailableQty = 0
  let totalStockValue = 0
  let lowStockCount = 0

  const warehouseMap = new Map<string, { warehouse_id: string; warehouse_name: string; warehouse_code: string; stock_value: number; material_count: number; low_stock_count: number }>()
  const materialMap = new Map<string, { material_key: string; material_name: string | null; item_unit: string | null; total_qty: number; stock_value: number; warehouse_count: number }>()

  for (const row of mappedStocks) {
    totalOnHandQty += Number(row.on_hand_qty || 0)
    totalAvailableQty += Number(row.available_qty || 0)
    totalStockValue += Number(row.stock_value || 0)
    materialKeySet.add(String(row.material_key || ''))

    const isLow = row.min_qty != null && Number(row.on_hand_qty || 0) <= Number(row.min_qty || 0)
    if (isLow) lowStockCount += 1

    const warehouseCurrent = warehouseMap.get(row.warehouse_id) || {
      warehouse_id: row.warehouse_id,
      warehouse_name: row.warehouse_name,
      warehouse_code: row.warehouse_code,
      stock_value: 0,
      material_count: 0,
      low_stock_count: 0,
    }
    warehouseCurrent.stock_value += Number(row.stock_value || 0)
    warehouseCurrent.material_count += 1
    if (isLow) warehouseCurrent.low_stock_count += 1
    warehouseMap.set(row.warehouse_id, warehouseCurrent)

    const materialCurrent = materialMap.get(row.material_key) || {
      material_key: row.material_key,
      material_name: row.material_name || null,
      item_unit: row.item_unit || null,
      total_qty: 0,
      stock_value: 0,
      warehouse_count: 0,
    }
    materialCurrent.total_qty += Number(row.on_hand_qty || 0)
    materialCurrent.stock_value += Number(row.stock_value || 0)
    materialCurrent.warehouse_count += 1
    materialMap.set(row.material_key, materialCurrent)
  }

  const staleStockRows = mappedStocks
    .filter((row) => Number(row.on_hand_qty || 0) > 0)
    .map((row) => {
      const lastMovementAt = row.last_out_at || row.last_in_at || row.updated_at
      const daysIdle = Math.max(0, Math.floor((Date.now() - new Date(lastMovementAt).getTime()) / 86400000))
      return {
        ...row,
        last_movement_at: lastMovementAt,
        days_idle: daysIdle,
      }
    })
    .filter((row) => row.days_idle >= STALE_STOCK_DAYS)
    .sort((a, b) => b.days_idle - a.days_idle)
    .slice(0, 20)

  let draftTxnCount = 0
  let postedTxnCount = 0
  let cancelledTxnCount = 0
  let inboundPostedCount = 0
  let outboundPostedCount = 0
  let adjustPostedCount = 0
  let inboundQtyTotal = 0
  let outboundQtyTotal = 0
  let adjustIncreaseQtyTotal = 0
  let adjustDecreaseQtyTotal = 0
  let inboundValueTotal = 0
  const movementMap = new Map<string, {
    material_key: string
    material_name: string | null
    item_unit: string | null
    inbound_qty: number
    outbound_qty: number
    adjust_increase_qty: number
    adjust_decrease_qty: number
    movement_qty: number
    txn_count: number
  }>()

  const transactionRows = txns.map((txn: any) => ({
    id: String(txn.id || ''),
    txn_code: txn.txn_code || '-',
    warehouse_name: txn.warehouse?.warehouse_name || '-',
    txn_type: txn.txn_type || null,
    status: txn.status || null,
    txn_date: txn.txn_date,
    note: txn.note || null,
    item_count: Array.isArray(txn.items) ? txn.items.length : 0,
    total_qty: Array.isArray(txn.items) ? txn.items.reduce((sum: number, item: any) => sum + Number(item?.quantity || 0), 0) : 0,
    supplier_name: txn.supplier?.supplier_name || null,
  }))

  const agingDraftRows = oldDraftTxns.map((txn: any) => ({
    id: String(txn.id || ''),
    txn_code: txn.txn_code || '-',
    warehouse_name: txn.warehouse?.warehouse_name || '-',
    warehouse_code: txn.warehouse?.warehouse_code || '',
    txn_type: txn.txn_type || null,
    status: txn.status || null,
    txn_date: txn.txn_date,
    created_at: txn.created_at,
    note: txn.note || null,
    item_count: Array.isArray(txn.items) ? txn.items.length : 0,
    total_qty: Array.isArray(txn.items) ? txn.items.reduce((sum: number, item: any) => sum + Number(item?.quantity || 0), 0) : 0,
    supplier_name: txn.supplier?.supplier_name || null,
    days_open: Math.max(0, Math.floor((Date.now() - new Date(txn.created_at).getTime()) / 86400000)),
  }))

  const priceLogGroups = new Map<string, any[]>()
  for (const row of priceLogs || []) {
    const key = `${String(row.warehouse_id || 'all')}__${String(row.material_key || '')}`
    const current = priceLogGroups.get(key) || []
    current.push(row)
    priceLogGroups.set(key, current)
  }

  const priceSpikeRows = Array.from(priceLogGroups.values())
    .map((group) => {
      const sorted = [...group].sort((a: any, b: any) => new Date(String(b.effective_at)).getTime() - new Date(String(a.effective_at)).getTime())
      if (sorted.length < 2) return null
      const latest = sorted[0]
      const previous = sorted.find((x: any) => Number(x.unit_price || 0) > 0 && String(x.id) !== String(latest.id))
      if (!previous) return null
      const latestPrice = Number(latest.unit_price || 0)
      const previousPrice = Number(previous.unit_price || 0)
      if (!(latestPrice > 0 && previousPrice > 0)) return null
      const increasePercent = ((latestPrice - previousPrice) / previousPrice) * 100
      if (increasePercent < PRICE_SPIKE_PERCENT) return null
      return {
        material_key: String(latest.material_key || ''),
        material_name: latest.material_name || null,
        item_unit: latest.item_unit || null,
        warehouse_name: latest.warehouse?.warehouse_name || '-',
        supplier_name: latest.supplier?.supplier_name || null,
        supplier_id: latest.supplier?.id || null,
        latest_price: latestPrice,
        previous_price: previousPrice,
        increase_percent: Math.round(increasePercent * 100) / 100,
        effective_at: latest.effective_at,
      }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => Number(b.increase_percent || 0) - Number(a.increase_percent || 0))
    .slice(0, 20)

  const availableByMaterial = new Map<string, number>()
  for (const row of mappedStocks) {
    const key = String(row.material_key || '').trim()
    if (!key) continue
    availableByMaterial.set(key, Number(availableByMaterial.get(key) || 0) + Number(row.available_qty || 0))
  }

  const projectDemandRiskRows = (projectPlanItems || [])
    .map((item: any) => {
      const materialKey = String(item.item_key || '').trim()
      if (!materialKey) return null
      const plannedQty = Number(item.quantity || 0)
      const receivedQty = Number(item.actual_received_qty || 0)
      const shortageQty = Math.max(0, plannedQty - receivedQty)
      if (shortageQty <= 0) return null
      const availableQty = Number(availableByMaterial.get(materialKey) || 0)
      return {
        project_id: String(item.project_id || ''),
        project_name: item.project?.project_name || '-',
        plan_id: String(item.plan_id || ''),
        plan_name: item.plan?.plan_name || '-',
        material_key: materialKey,
        material_name: item.item_name || materialKey,
        item_unit: item.unit || null,
        planned_qty: plannedQty,
        received_qty: receivedQty,
        shortage_qty: shortageQty,
        available_stock_qty: availableQty,
        risk_level: availableQty < shortageQty ? 'critical' : 'warning',
      }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => {
      if (String(a.risk_level) !== String(b.risk_level)) return String(a.risk_level) === 'critical' ? -1 : 1
      return Number(b.shortage_qty || 0) - Number(a.shortage_qty || 0)
    })
    .slice(0, 30)

  const supplierRiskRows = [
    ...priceSpikeRows.map((row: any) => ({
      supplier_id: row.supplier_id || null,
      supplier_name: row.supplier_name || 'Khong gan NCC',
      risk_kind: 'price_spike',
      severity: Number(row.increase_percent || 0) >= 30 ? 'critical' : 'warning',
      material_key: row.material_key,
      material_name: row.material_name || row.material_key,
      warehouse_name: row.warehouse_name || '-',
      reference_code: null,
      metric_value: Number(row.increase_percent || 0),
      detail_text: `Tang ${Number(row.increase_percent || 0).toLocaleString('vi-VN')}% so voi lan truoc`,
      event_at: row.effective_at || null,
    })),
    ...(purchaseOrders || []).map((order: any) => {
      const remainingQty = (order.items || []).reduce((sum: number, item: any) => {
        const ordered = Number(item?.ordered_qty || 0)
        const received = Number(item?.received_qty || 0)
        return sum + Math.max(0, ordered - received)
      }, 0)
      const overdueDays = order.expected_date ? Math.max(0, Math.floor((Date.now() - new Date(order.expected_date).getTime()) / 86400000)) : 0
      return remainingQty > 0 ? {
        supplier_id: order.supplier?.id || null,
        supplier_name: order.supplier?.supplier_name || 'Khong gan NCC',
        risk_kind: 'delivery_delay',
        severity: overdueDays >= 7 ? 'critical' : 'warning',
        material_key: null,
        material_name: null,
        warehouse_name: order.warehouse?.warehouse_name || '-',
        reference_code: order.order_code || null,
        metric_value: overdueDays,
        detail_text: `Cham ${overdueDays} ngay, con ${Number(remainingQty || 0).toLocaleString('vi-VN')} SL chua nhan`,
        event_at: order.expected_date || null,
      } : null
    }).filter(Boolean),
  ]
    .sort((a: any, b: any) => {
      if (String(a.severity) !== String(b.severity)) return String(a.severity) === 'critical' ? -1 : 1
      return Number(b.metric_value || 0) - Number(a.metric_value || 0)
    })
    .slice(0, 20)

  for (const txn of txns) {
    const status = String(txn.status || '')
    const txnType = String(txn.txn_type || '')
    const items = Array.isArray(txn.items) ? txn.items : []

    if (status === 'draft') draftTxnCount += 1
    else if (status === 'posted') postedTxnCount += 1
    else if (status === 'cancelled') cancelledTxnCount += 1

    if (status !== 'posted') continue

    if (txnType === 'in' || txnType === 'transfer_in') {
      inboundPostedCount += 1
      for (const item of items) {
        const qty = Number(item?.quantity || 0)
        inboundQtyTotal += qty
        inboundValueTotal += toNumber(item?.line_total)
        const materialKey = String(item?.material_key || '')
        const current = movementMap.get(materialKey) || {
          material_key: materialKey,
          material_name: item?.material_name || null,
          item_unit: item?.item_unit || null,
          inbound_qty: 0,
          outbound_qty: 0,
          adjust_increase_qty: 0,
          adjust_decrease_qty: 0,
          movement_qty: 0,
          txn_count: 0,
        }
        current.inbound_qty += qty
        current.movement_qty += Math.abs(qty)
        current.txn_count += 1
        movementMap.set(materialKey, current)
      }
    } else if (txnType === 'out' || txnType === 'transfer_out') {
      outboundPostedCount += 1
      for (const item of items) {
        const qty = Number(item?.quantity || 0)
        outboundQtyTotal += qty
        const materialKey = String(item?.material_key || '')
        const current = movementMap.get(materialKey) || {
          material_key: materialKey,
          material_name: item?.material_name || null,
          item_unit: item?.item_unit || null,
          inbound_qty: 0,
          outbound_qty: 0,
          adjust_increase_qty: 0,
          adjust_decrease_qty: 0,
          movement_qty: 0,
          txn_count: 0,
        }
        current.outbound_qty += qty
        current.movement_qty += Math.abs(qty)
        current.txn_count += 1
        movementMap.set(materialKey, current)
      }
    } else if (txnType === 'adjust') {
      adjustPostedCount += 1
      for (const item of items) {
        const qty = Number(item?.quantity || 0)
        const materialKey = String(item?.material_key || '')
        const current = movementMap.get(materialKey) || {
          material_key: materialKey,
          material_name: item?.material_name || null,
          item_unit: item?.item_unit || null,
          inbound_qty: 0,
          outbound_qty: 0,
          adjust_increase_qty: 0,
          adjust_decrease_qty: 0,
          movement_qty: 0,
          txn_count: 0,
        }
        if (qty > 0) {
          adjustIncreaseQtyTotal += qty
          current.adjust_increase_qty += qty
        }
        if (qty < 0) {
          adjustDecreaseQtyTotal += Math.abs(qty)
          current.adjust_decrease_qty += Math.abs(qty)
        }
        current.movement_qty += Math.abs(qty)
        current.txn_count += 1
        movementMap.set(materialKey, current)
      }
    }
  }

  const recentInboundTransactions = transactionRows
    .filter((row) => row.txn_type === 'in' || row.txn_type === 'transfer_in')
    .slice(0, 8)

  const recentOutboundTransactions = transactionRows
    .filter((row) => row.txn_type === 'out' || row.txn_type === 'transfer_out')
    .slice(0, 8)

  return {
    filters: {
      warehouse_id: warehouseId || null,
      date_from: dateFrom.toISOString(),
      date_to: dateTo.toISOString(),
    },
    summary: {
      warehouse_count: warehouseCount,
      stock_row_count: mappedStocks.length,
      material_count: materialKeySet.size,
      total_on_hand_qty: Math.round(totalOnHandQty * 100) / 100,
      total_available_qty: Math.round(totalAvailableQty * 100) / 100,
      total_stock_value: Math.round(totalStockValue),
      low_stock_count: lowStockCount,
      draft_txn_count: draftTxnCount,
      posted_txn_count: postedTxnCount,
      cancelled_txn_count: cancelledTxnCount,
      inbound_posted_count: inboundPostedCount,
      outbound_posted_count: outboundPostedCount,
      adjust_posted_count: adjustPostedCount,
      inbound_qty_total: Math.round(inboundQtyTotal * 100) / 100,
      outbound_qty_total: Math.round(outboundQtyTotal * 100) / 100,
      adjust_increase_qty_total: Math.round(adjustIncreaseQtyTotal * 100) / 100,
      adjust_decrease_qty_total: Math.round(adjustDecreaseQtyTotal * 100) / 100,
      inbound_value_total: Math.round(inboundValueTotal),
      stale_stock_count: staleStockRows.length,
      aging_draft_count: agingDraftRows.length,
      price_spike_count: priceSpikeRows.length,
      project_demand_risk_count: projectDemandRiskRows.length,
      project_issue_draft_count: projectIssueDraftCount,
      supplier_risk_count: supplierRiskRows.length,
    },
    top_warehouses: Array.from(warehouseMap.values())
      .sort((a, b) => b.stock_value - a.stock_value)
      .slice(0, 10),
    top_materials: Array.from(materialMap.values())
      .sort((a, b) => b.stock_value - a.stock_value)
      .slice(0, 12),
    low_stock_rows: mappedStocks
      .filter((row) => row.min_qty != null && Number(row.on_hand_qty || 0) <= Number(row.min_qty || 0))
      .sort((a, b) => Number(a.on_hand_qty || 0) - Number(b.on_hand_qty || 0))
      .slice(0, 20),
    stale_stock_rows: staleStockRows,
    aging_draft_rows: agingDraftRows,
    price_spike_rows: priceSpikeRows,
    supplier_risk_rows: supplierRiskRows,
    project_demand_risk_rows: projectDemandRiskRows,
    recent_inbound_transactions: recentInboundTransactions,
    recent_outbound_transactions: recentOutboundTransactions,
    top_movement_materials: Array.from(movementMap.values())
      .sort((a, b) => {
        if (b.movement_qty !== a.movement_qty) return b.movement_qty - a.movement_qty
        return b.txn_count - a.txn_count
      })
      .slice(0, 12),
  }
}
