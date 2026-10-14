import { db } from '@/lib/db'

export type InventoryPriceFilters = {
  warehouse_id?: string | null
  supplier_id?: string | null
  material_key?: string | null
  price_kind?: string | null
  date_from?: string | Date | null
  date_to?: string | Date | null
  page?: number | null
  page_size?: number | null
}

function toNumber(value: any) {
  if (value == null) return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function safeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? Number(v) : v))) as T
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

type PriceLogRow = {
  id: string
  material_key: string
  material_name: string | null
  item_unit: string | null
  supplier_id: string | null
  supplier_name: string | null
  warehouse_id: string | null
  warehouse_name: string | null
  price_kind: string | null
  unit_price: number
  quantity: number
  line_total: number
  cycle_no: number | null
  effective_at: string | Date | null
  txn_code: string | null
  source_note: string | null
}

function buildMaterialChanges(rows: PriceLogRow[]) {
  const map = new Map<string, PriceLogRow[]>()
  for (const row of rows) {
    const key = String(row.material_key || '').trim()
    if (!key) continue
    const list = map.get(key) || []
    list.push(row)
    map.set(key, list)
  }

  const changes = Array.from(map.entries())
    .map(([materialKey, list]) => {
      const sorted = [...list].sort((a, b) => new Date(String(a.effective_at || 0)).getTime() - new Date(String(b.effective_at || 0)).getTime())
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const firstPrice = toNumber(first?.unit_price)
      const lastPrice = toNumber(last?.unit_price)
      const changeAmount = lastPrice - firstPrice
      const changePct = firstPrice > 0 ? (changeAmount / firstPrice) * 100 : null
      return {
        material_key: materialKey,
        material_name: last?.material_name || first?.material_name || null,
        item_unit: last?.item_unit || first?.item_unit || null,
        first_price: firstPrice,
        last_price: lastPrice,
        change_amount: changeAmount,
        change_pct: changePct,
        sample_count: sorted.length,
        latest_supplier_name: last?.supplier_name || null,
        latest_at: last?.effective_at || null,
      }
    })
    .filter((row) => row.sample_count > 1 && row.first_price > 0)

  return {
    increases: changes
      .filter((row) => row.change_amount > 0)
      .sort((a, b) => b.change_amount - a.change_amount)
      .slice(0, 12),
    decreases: changes
      .filter((row) => row.change_amount < 0)
      .sort((a, b) => a.change_amount - b.change_amount)
      .slice(0, 12),
    increased_count: changes.filter((row) => row.change_amount > 0).length,
    decreased_count: changes.filter((row) => row.change_amount < 0).length,
  }
}

function buildSupplierChanges(rows: PriceLogRow[]) {
  const map = new Map<string, PriceLogRow[]>()
  for (const row of rows) {
    const supplierId = String(row.supplier_id || '').trim()
    const materialKey = String(row.material_key || '').trim()
    if (!supplierId || !materialKey) continue
    const key = `${supplierId}__${materialKey}`
    const list = map.get(key) || []
    list.push(row)
    map.set(key, list)
  }

  return Array.from(map.values())
    .map((list) => {
      const sorted = [...list].sort((a, b) => new Date(String(a.effective_at || 0)).getTime() - new Date(String(b.effective_at || 0)).getTime())
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const firstPrice = toNumber(first?.unit_price)
      const lastPrice = toNumber(last?.unit_price)
      const changeAmount = lastPrice - firstPrice
      const changePct = firstPrice > 0 ? (changeAmount / firstPrice) * 100 : null
      return {
        supplier_id: last?.supplier_id || first?.supplier_id || null,
        supplier_name: last?.supplier_name || first?.supplier_name || null,
        material_key: last?.material_key || first?.material_key || null,
        material_name: last?.material_name || first?.material_name || null,
        item_unit: last?.item_unit || first?.item_unit || null,
        first_price: firstPrice,
        last_price: lastPrice,
        change_amount: changeAmount,
        change_pct: changePct,
        sample_count: sorted.length,
        latest_at: last?.effective_at || null,
      }
    })
    .filter((row) => row.sample_count > 1 && row.first_price > 0)
    .sort((a, b) => Math.abs(b.change_amount) - Math.abs(a.change_amount))
    .slice(0, 12)
}

export function normalizeInventoryPriceFilters(input: InventoryPriceFilters) {
  const warehouseId = String(input.warehouse_id || '').trim()
  const supplierId = String(input.supplier_id || '').trim()
  const materialKey = String(input.material_key || '').trim()
  const priceKind = String(input.price_kind || '').trim()
  const dateFromText = String(input.date_from || '').trim()
  const dateToText = String(input.date_to || '').trim()
  const page = Math.max(1, Number(input.page || 1))
  const pageSize = Math.min(5000, Math.max(10, Number(input.page_size || 20)))

  const dateFrom = dateFromText ? new Date(dateFromText) : startOfMonth(new Date())
  const dateTo = dateToText ? new Date(dateToText) : endOfMonth(new Date())
  if (dateToText) dateTo.setHours(23, 59, 59, 999)

  return {
    warehouseId,
    supplierId,
    materialKey,
    priceKind,
    page,
    pageSize,
    dateFrom,
    dateTo,
  }
}

export async function getInventoryPriceTrackingData(input: InventoryPriceFilters) {
  const { warehouseId, supplierId, materialKey, priceKind, page, pageSize, dateFrom, dateTo } = normalizeInventoryPriceFilters(input)

  const where: any = {
    effective_at: {
      gte: dateFrom,
      lte: dateTo,
    },
  }
  if (warehouseId) where.warehouse_id = warehouseId
  if (supplierId) where.supplier_id = supplierId
  if (materialKey) where.material_key = materialKey
  if (priceKind) where.price_kind = priceKind

  const logRepo = (db as any).inventoryMaterialPriceLog
  const supplierPriceRepo = (db as any).supplierMaterialPrice

  const [total, logs, aggregateRowsRaw] = await Promise.all([
    logRepo.count({ where }),
    logRepo.findMany({
      where,
      include: {
        supplier: { select: { id: true, supplier_name: true } },
        warehouse: { select: { id: true, warehouse_name: true } },
        txn: { select: { id: true, txn_code: true } },
      },
      orderBy: [{ effective_at: 'desc' }, { created_at: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    logRepo.findMany({
      where,
      include: {
        supplier: { select: { id: true, supplier_name: true } },
        warehouse: { select: { id: true, warehouse_name: true } },
        txn: { select: { id: true, txn_code: true } },
      },
      orderBy: [{ effective_at: 'asc' }, { created_at: 'asc' }],
      take: 5000,
    }),
  ])

  const aggregateRows: PriceLogRow[] = (Array.isArray(aggregateRowsRaw) ? aggregateRowsRaw : []).map((row: any) => ({
    id: String(row.id || ''),
    material_key: String(row.material_key || ''),
    material_name: row.material_name || null,
    item_unit: row.item_unit || null,
    supplier_id: row.supplier_id || null,
    supplier_name: row.supplier?.supplier_name || null,
    warehouse_id: row.warehouse_id || null,
    warehouse_name: row.warehouse?.warehouse_name || null,
    price_kind: row.price_kind || null,
    unit_price: toNumber(row.unit_price),
    quantity: Number(row.quantity || 0),
    line_total: toNumber(row.line_total),
    cycle_no: row.cycle_no != null ? Number(row.cycle_no) : null,
    effective_at: row.effective_at || null,
    txn_code: row.txn?.txn_code || null,
    source_note: row.source_note || null,
  }))

  const materialChanges = buildMaterialChanges(aggregateRows)
  const supplierChanges = buildSupplierChanges(aggregateRows)

  const latestPairs = new Map<string, PriceLogRow>()
  for (const row of [...aggregateRows].sort((a, b) => new Date(String(b.effective_at || 0)).getTime() - new Date(String(a.effective_at || 0)).getTime())) {
    const supplierKey = String(row.supplier_id || '').trim()
    const materialRowKey = String(row.material_key || '').trim()
    if (!supplierKey || !materialRowKey) continue
    const pairKey = `${supplierKey}__${materialRowKey}`
    if (!latestPairs.has(pairKey)) latestPairs.set(pairKey, row)
  }

  const supplierIds = Array.from(new Set(Array.from(latestPairs.values()).map((row) => String(row.supplier_id || '')).filter(Boolean)))
  const materialKeys = Array.from(new Set(Array.from(latestPairs.values()).map((row) => String(row.material_key || '')).filter(Boolean)))

  const configRows = supplierIds.length && materialKeys.length
    ? await supplierPriceRepo.findMany({
        where: {
          supplier_id: { in: supplierIds },
          material_key: { in: materialKeys },
          is_active: true,
        },
        include: {
          supplier: { select: { id: true, supplier_name: true } },
        },
        orderBy: [{ valid_from: 'desc' }, { created_at: 'desc' }],
      })
    : []

  const latestConfigMap = new Map<string, any>()
  for (const row of Array.isArray(configRows) ? configRows : []) {
    const key = `${String(row.supplier_id || '')}__${String(row.material_key || '')}`
    if (!latestConfigMap.has(key)) latestConfigMap.set(key, row)
  }

  const mappedLogs = (Array.isArray(logs) ? logs : []).map((row: any) => {
    const key = `${String(row.supplier_id || '')}__${String(row.material_key || '')}`
    const config = latestConfigMap.get(key)
    const actualPrice = toNumber(row.unit_price)
    const configPrice = config ? toNumber(config.price_per_unit) : null
    const gapAmount = configPrice != null ? actualPrice - configPrice : null
    const gapPct = configPrice && configPrice > 0 ? ((actualPrice - configPrice) / configPrice) * 100 : null
    return {
      id: String(row.id || ''),
      material_key: String(row.material_key || ''),
      material_name: row.material_name || null,
      item_unit: row.item_unit || null,
      supplier_id: row.supplier_id || null,
      supplier_name: row.supplier?.supplier_name || null,
      warehouse_id: row.warehouse_id || null,
      warehouse_name: row.warehouse?.warehouse_name || null,
      price_kind: row.price_kind || null,
      unit_price: actualPrice,
      quantity: Number(row.quantity || 0),
      line_total: toNumber(row.line_total),
      cycle_no: row.cycle_no != null ? Number(row.cycle_no) : null,
      effective_at: row.effective_at || null,
      txn_code: row.txn?.txn_code || null,
      source_note: row.source_note || null,
      latest_config_price: configPrice,
      latest_config_valid_from: config?.valid_from || null,
      gap_amount: gapAmount,
      gap_pct: gapPct,
    }
  })

  const actualVsConfig = Array.from(latestPairs.entries())
    .map(([pairKey, row]) => {
      const config = latestConfigMap.get(pairKey)
      const actualPrice = toNumber(row.unit_price)
      const configPrice = config ? toNumber(config.price_per_unit) : null
      const gapAmount = configPrice != null ? actualPrice - configPrice : null
      const gapPct = configPrice && configPrice > 0 ? ((actualPrice - configPrice) / configPrice) * 100 : null
      return {
        supplier_id: row.supplier_id,
        supplier_name: row.supplier_name,
        material_key: row.material_key,
        material_name: row.material_name,
        item_unit: row.item_unit,
        latest_actual_price: actualPrice,
        latest_actual_at: row.effective_at,
        latest_config_price: configPrice,
        latest_config_at: config?.valid_from || null,
        gap_amount: gapAmount,
        gap_pct: gapPct,
      }
    })
    .sort((a, b) => Math.abs(Number(b.gap_amount || 0)) - Math.abs(Number(a.gap_amount || 0)))
    .slice(0, 12)

  const unitPrices = aggregateRows.map((row) => toNumber(row.unit_price)).filter((row) => row > 0)
  const uniqueMaterials = new Set(aggregateRows.map((row) => row.material_key).filter(Boolean))
  const uniqueSuppliers = new Set(aggregateRows.map((row) => row.supplier_id).filter(Boolean))

  return {
    filters: {
      warehouse_id: warehouseId || null,
      supplier_id: supplierId || null,
      material_key: materialKey || null,
      price_kind: priceKind || null,
      date_from: dateFrom.toISOString(),
      date_to: dateTo.toISOString(),
    },
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    },
    summary: {
      log_count: total,
      material_count: uniqueMaterials.size,
      supplier_count: uniqueSuppliers.size,
      avg_actual_price: unitPrices.length ? Math.round(unitPrices.reduce((sum, row) => sum + row, 0) / unitPrices.length) : 0,
      min_actual_price: unitPrices.length ? Math.min(...unitPrices) : 0,
      max_actual_price: unitPrices.length ? Math.max(...unitPrices) : 0,
      increased_material_count: materialChanges.increased_count,
      decreased_material_count: materialChanges.decreased_count,
    },
    top_material_increases: materialChanges.increases,
    top_material_decreases: materialChanges.decreases,
    top_supplier_changes: supplierChanges,
    actual_vs_config: actualVsConfig,
    logs: mappedLogs,
  }
}
