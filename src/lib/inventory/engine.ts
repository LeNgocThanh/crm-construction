import { db } from '@/lib/db'
import { appendProjectLedgerFromInventoryTxn } from '@/lib/projects/material-ledger'

export type PostInventoryOptions = {
  txnId: string
  actorUserId?: string | null
  actorUsername?: string | null
  allowNegative?: boolean
}

function toNum(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
function toInt(v: any) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.round(n)
}

function now() {
  return new Date()
}

async function findOpenCostCycle(tx: any, warehouseId: string, materialKey: string) {
  return tx.inventoryCostCycle.findFirst({
    where: { warehouse_id: warehouseId, material_key: materialKey, is_open: true },
    orderBy: [{ cycle_no: 'desc' }],
  })
}

async function getNextCostCycleNo(tx: any, warehouseId: string, materialKey: string) {
  const lastCycle = await tx.inventoryCostCycle.findFirst({
    where: { warehouse_id: warehouseId, material_key: materialKey },
    orderBy: [{ cycle_no: 'desc' }],
  })
  return Number(lastCycle?.cycle_no || 0) + 1
}

async function ensureOpenCostCycle(args: {
  tx: any
  warehouseId: string
  stockId?: string | null
  materialKey: string
  prevOnHand: number
  prevStockValue: number
  prevAvgCost: number
  nextOnHand: number
  nextStockValue: number
  nextAvgCost: number
  txn: any
  openReason: string
}) {
  const { tx, warehouseId, stockId, materialKey, prevOnHand, prevStockValue, prevAvgCost, nextOnHand, nextStockValue, nextAvgCost, txn, openReason } = args
  if (nextOnHand <= 0) return null
  const existed = await findOpenCostCycle(tx, warehouseId, materialKey)
  if (existed) return existed

  const cycleNo = await getNextCostCycleNo(tx, warehouseId, materialKey)
  const openingQty = prevOnHand > 0 ? prevOnHand : nextOnHand
  const openingValue = prevOnHand > 0 ? prevStockValue : nextStockValue
  const openingAvgCost = prevOnHand > 0 ? prevAvgCost : nextAvgCost

  return tx.inventoryCostCycle.create({
    data: {
      warehouse_id: warehouseId,
      stock_id: stockId || null,
      material_key: materialKey,
      cycle_no: cycleNo,
      started_at: txn.txn_date || now(),
      opening_qty: openingQty,
      opening_value: BigInt(Math.max(0, openingValue)),
      opening_avg_cost: BigInt(Math.max(0, openingAvgCost)),
      last_in_at: txn.txn_type === 'in' || txn.txn_type === 'transfer_in' ? (txn.txn_date || now()) : null,
      last_out_at: txn.txn_type === 'out' || txn.txn_type === 'transfer_out' ? (txn.txn_date || now()) : null,
      source_txn_id: txn.id,
      source_note: openReason,
      is_open: true,
    },
  })
}

async function touchCostCycle(args: {
  tx: any
  cycleId: string
  txnType: string
  txnDate: Date
  stockId?: string | null
}) {
  const { tx, cycleId, txnType, txnDate, stockId } = args
  const data: any = {
    updated_at: now(),
  }
  if (stockId) data.stock_id = stockId
  if (txnType === 'in' || txnType === 'transfer_in') data.last_in_at = txnDate
  if (txnType === 'out' || txnType === 'transfer_out') data.last_out_at = txnDate
  if (txnType === 'adjust') {
    data.last_in_at = txnDate
    data.last_out_at = txnDate
  }
  return tx.inventoryCostCycle.update({
    where: { id: cycleId },
    data,
  })
}

async function closeCostCycle(args: {
  tx: any
  cycleId: string
  nextOnHand: number
  nextStockValue: number
  nextAvgCost: number
  txn: any
  resetReason: string
}) {
  const { tx, cycleId, nextOnHand, nextStockValue, nextAvgCost, txn, resetReason } = args
  return tx.inventoryCostCycle.update({
    where: { id: cycleId },
    data: {
      ended_at: txn.txn_date || now(),
      closing_qty: nextOnHand,
      closing_value: BigInt(Math.max(0, nextStockValue)),
      closing_avg_cost: BigInt(Math.max(0, nextAvgCost)),
      last_out_at: txn.txn_date || now(),
      source_txn_id: txn.id,
      reset_reason: resetReason,
      is_open: false,
      updated_at: now(),
    },
  })
}

async function createInventoryPriceLog(args: {
  tx: any
  txn: any
  item: any
  cycleNo?: number | null
  actorName?: string | null
}) {
  const { tx, txn, item, cycleNo, actorName } = args
  const unitPrice = toInt(item?.unit_price ?? 0)
  if (unitPrice <= 0) return null
  const qty = toNum(item?.quantity ?? 0)
  const lineTotal = toInt(item?.line_total ?? Math.round(qty * unitPrice))
  const priceKind =
    txn.txn_type === 'transfer_in' ? 'transfer_in'
      : txn.txn_type === 'adjust' ? 'manual'
        : 'inventory_in'

  return tx.inventoryMaterialPriceLog.create({
    data: {
      warehouse_id: txn.warehouse_id || null,
      supplier_id: txn.supplier_id || null,
      txn_id: txn.id,
      txn_item_id: item.id,
      catalog_item_id: item.catalog_item_id || null,
      material_key: String(item.material_key || '').trim(),
      material_name: item.material_name || null,
      item_unit: item.item_unit || null,
      price_kind: priceKind,
      unit_price: BigInt(unitPrice),
      quantity: qty,
      line_total: BigInt(Math.max(0, lineTotal)),
      cycle_no: cycleNo != null ? Number(cycleNo) : null,
      effective_at: txn.txn_date || now(),
      source_note: txn.note || null,
      created_by: actorName || txn.created_by || null,
    },
  })
}

export async function postInventoryTransaction(opts: PostInventoryOptions) {
  const allowNegative = !!opts.allowNegative
  return db.$transaction(async (tx) => {
    const txn = await tx.inventoryTransaction.findUnique({
      where: { id: opts.txnId },
      include: { items: true },
    })
    if (!txn) throw new Error('Khong tim thay phieu kho')
    if (txn.status !== 'draft') throw new Error('Chi duoc ghi so phieu draft')
    if (!txn.items.length) throw new Error('Phieu kho chua co dong vat tu')

    for (const item of txn.items) {
      const qty = toNum(item.quantity)
      if (txn.txn_type === 'adjust') {
        if (qty === 0) throw new Error(`So luong dieu chinh phai khac 0: ${item.material_key}`)
      } else {
        if (qty <= 0) throw new Error(`So luong khong hop le: ${item.material_key}`)
      }
      const materialKey = String(item.material_key || '').trim()
      if (!materialKey) throw new Error('Thieu material_key')

      const stock = await tx.warehouseStock.findUnique({
        where: { warehouse_id_material_key: { warehouse_id: txn.warehouse_id, material_key: materialKey } },
      })

      const prevOnHand = toNum(stock?.on_hand_qty ?? 0)
      const prevAvgCost = toInt((stock as any)?.avg_unit_cost ?? 0)
      const prevStockValue = toInt((stock as any)?.stock_value ?? (prevOnHand * prevAvgCost))
      let nextOnHand = prevOnHand
      let nextAvgCost = prevAvgCost
      let nextStockValue = prevStockValue
      let openReason = 'auto_open_backfill'
      if (txn.txn_type === 'in' || txn.txn_type === 'transfer_in') {
        const inUnitPrice = toInt(item.unit_price ?? 0)
        const inValue = Math.round(qty * inUnitPrice)
        nextOnHand = prevOnHand + qty
        nextStockValue = prevStockValue + inValue
        nextAvgCost = nextOnHand > 0 ? Math.round(nextStockValue / nextOnHand) : 0
        openReason = prevOnHand <= 0 ? 'open_from_inbound' : 'auto_open_backfill'
      } else if (txn.txn_type === 'out' || txn.txn_type === 'transfer_out') {
        nextOnHand = prevOnHand - qty
        if (!allowNegative && nextOnHand < 0) {
          throw new Error(`Khong du ton kho cho ${materialKey} (ton=${prevOnHand}, xuat=${qty})`)
        }
        const usedAvg = prevAvgCost > 0 ? prevAvgCost : 0
        const outValue = Math.round(qty * usedAvg)
        nextStockValue = prevStockValue - outValue
        if (nextOnHand <= 0) {
          nextOnHand = 0
          nextStockValue = 0
          nextAvgCost = 0
        } else {
          nextStockValue = Math.max(0, nextStockValue)
          nextAvgCost = Math.round(nextStockValue / nextOnHand)
        }
      } else if (txn.txn_type === 'adjust') {
        const adjustUnitPrice = toInt(item.unit_price ?? prevAvgCost)
        const adjustValue = Math.round(qty * adjustUnitPrice)
        nextOnHand = prevOnHand + qty
        nextStockValue = prevStockValue + adjustValue
        if (nextOnHand <= 0) {
          nextOnHand = 0
          nextStockValue = 0
          nextAvgCost = 0
        } else {
          nextAvgCost = Math.round(nextStockValue / nextOnHand)
        }
        openReason = qty > 0 && prevOnHand <= 0 ? 'open_from_adjust' : 'auto_open_backfill'
      } else {
        throw new Error(`Loai phieu khong ho tro: ${txn.txn_type}`)
      }

      const commonData: any = {
        material_name: item.material_name || stock?.material_name || null,
        item_unit: item.item_unit || stock?.item_unit || null,
      }
      const writeData: any = {
        ...commonData,
        on_hand_qty: nextOnHand,
        avg_unit_cost: BigInt(Math.max(0, nextAvgCost)),
        stock_value: BigInt(Math.max(0, nextStockValue)),
        ...(txn.txn_type === 'in' || txn.txn_type === 'transfer_in' ? { last_in_at: now() } : {}),
        ...(txn.txn_type === 'out' || txn.txn_type === 'transfer_out' ? { last_out_at: now() } : {}),
      }

      let nextStockId = stock?.id || null
      if (!stock) {
        const createdStock = await tx.warehouseStock.create({
          data: {
            warehouse_id: txn.warehouse_id,
            catalog_item_id: item.catalog_item_id || null,
            material_key: materialKey,
            supplier_id: txn.supplier_id || null,
            reserved_qty: 0,
            avg_unit_cost: BigInt(Math.max(0, nextAvgCost)),
            stock_value: BigInt(Math.max(0, nextStockValue)),
            ...writeData,
          },
        })
        nextStockId = createdStock.id
      } else {
        const updatedStock = await tx.warehouseStock.update({
          where: { id: stock.id },
          data: writeData,
        })
        nextStockId = updatedStock.id
      }

      let openCycle = await findOpenCostCycle(tx as any, txn.warehouse_id, materialKey)
      if (nextOnHand > 0) {
        openCycle = await ensureOpenCostCycle({
          tx: tx as any,
          warehouseId: txn.warehouse_id,
          stockId: nextStockId,
          materialKey,
          prevOnHand,
          prevStockValue,
          prevAvgCost,
          nextOnHand,
          nextStockValue,
          nextAvgCost,
          txn,
          openReason,
        })
        if (openCycle?.id) {
          await touchCostCycle({
            tx: tx as any,
            cycleId: openCycle.id,
            txnType: String(txn.txn_type || ''),
            txnDate: txn.txn_date || now(),
            stockId: nextStockId,
          })
        }
      }

      if (nextOnHand <= 0 && openCycle?.id) {
        await closeCostCycle({
          tx: tx as any,
          cycleId: openCycle.id,
          nextOnHand,
          nextStockValue,
          nextAvgCost,
          txn,
          resetReason: 'clear_stock',
        })
      }

      if (
        (txn.txn_type === 'in' || txn.txn_type === 'transfer_in') ||
        (txn.txn_type === 'adjust' && qty > 0)
      ) {
        await createInventoryPriceLog({
          tx: tx as any,
          txn,
          item,
          cycleNo: openCycle?.cycle_no != null ? Number(openCycle.cycle_no) : null,
          actorName: opts.actorUsername || opts.actorUserId || null,
        })
      }
    }

    const posted = await tx.inventoryTransaction.update({
      where: { id: txn.id },
      data: {
        status: 'posted',
        updated_at: now(),
        note: [txn.note, `[posted_by:${opts.actorUsername || opts.actorUserId || 'system'} at ${now().toISOString()}]`]
          .filter(Boolean)
          .join(' '),
      },
      include: { items: true },
    })
    await appendProjectLedgerFromInventoryTxn(tx as any, posted.id, opts.actorUserId || null)
    return posted
  })
}
