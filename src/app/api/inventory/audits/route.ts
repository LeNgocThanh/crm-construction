import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { inventoryAuditCode, serializeInventoryAudit } from '@/lib/inventory/audits'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.inventoryRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const warehouseId = String(sp.get('warehouse_id') || '').trim()
  const status = String(sp.get('status') || '').trim()
  const includeCancelled = String(sp.get('include_cancelled') || '').trim() === 'true'
  const pageSize = Math.min(100, Math.max(1, Number(sp.get('page_size') || 30)))
  const page = Math.max(1, Number(sp.get('page') || 1))
  const skip = (page - 1) * pageSize

  const where: any = {}
  if (warehouseId) where.warehouse_id = warehouseId
  if (status) {
    where.status = status
  } else if (!includeCancelled) {
    where.status = { not: 'cancelled' }
  }

  const [total, rows] = await Promise.all([
    (db as any).inventoryStockAudit.count({ where }),
    (db as any).inventoryStockAudit.findMany({
      where,
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        applied_txn: { select: { id: true, txn_code: true, status: true } },
      },
      orderBy: [{ audit_date: 'desc' }, { created_at: 'desc' }],
      skip,
      take: pageSize,
    }),
  ])

  return NextResponse.json({
    data: rows.map(serializeInventoryAudit),
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.inventoryManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const warehouseId = String(body?.warehouse_id || '').trim()
  if (!warehouseId) {
    return NextResponse.json({ error: 'Thiếu kho kiểm kê' }, { status: 400 })
  }
  const includeZero = body?.include_zero === true

  const created = await db.$transaction(async (tx) => {
    const stocks = await tx.warehouseStock.findMany({
      where: {
        warehouse_id: warehouseId,
        ...(includeZero ? {} : { on_hand_qty: { not: 0 } }),
      },
      orderBy: [{ material_name: 'asc' }, { material_key: 'asc' }],
    })
    if (!stocks.length) {
      throw new Error('Kho chưa có tồn để tạo phiếu kiểm kê')
    }

    const audit = await (tx as any).inventoryStockAudit.create({
      data: {
        audit_code: inventoryAuditCode(),
        warehouse_id: warehouseId,
        audit_date: body?.audit_date ? new Date(body.audit_date) : new Date(),
        status: 'draft',
        note: body?.note ? String(body.note) : null,
        created_by: auth.ctx?.session?.user?.username || auth.ctx?.session?.user?.id || null,
        total_items: stocks.length,
        counted_items: 0,
        variance_items: 0,
        total_variance_value: BigInt(0),
      },
    })

    for (const stock of stocks) {
      await (tx as any).inventoryStockAuditItem.create({
        data: {
          audit_id: audit.id,
          stock_id: stock.id,
          catalog_item_id: stock.catalog_item_id || null,
          material_key: stock.material_key,
          material_name: stock.material_name || null,
          item_unit: stock.item_unit || null,
          book_qty: Number(stock.on_hand_qty || 0),
          counted_qty: null,
          variance_qty: null,
          avg_unit_cost: stock.avg_unit_cost != null ? BigInt(stock.avg_unit_cost) : BigInt(0),
          variance_value: BigInt(0),
          note: null,
        },
      })
    }

    return (tx as any).inventoryStockAudit.findUnique({
      where: { id: audit.id },
      include: {
        warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
        applied_txn: { select: { id: true, txn_code: true, status: true } },
        items: true,
      },
    })
  })

  return NextResponse.json({ data: serializeInventoryAudit(created) }, { status: 201 })
}
