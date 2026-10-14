import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.inventoryRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const warehouseId = String(sp.get('warehouse_id') || '').trim()
  const materialKey = String(sp.get('material_key') || '').trim()
  const lowOnly = String(sp.get('low_only') || '').trim() === 'true'
  const limit = Math.min(500, Math.max(1, Number(sp.get('limit') || 200)))

  const where: any = {}
  if (warehouseId) where.warehouse_id = warehouseId
  if (materialKey) where.material_key = { contains: materialKey, mode: 'insensitive' }
  const rows = await db.warehouseStock.findMany({
    where,
    include: {
      warehouse: { select: { id: true, warehouse_code: true, warehouse_name: true } },
      supplier: { select: { id: true, supplier_code: true, supplier_name: true } },
    },
    orderBy: [{ updated_at: 'desc' }],
    take: limit,
  })

  const mapped = rows.map((x: any) => ({
    ...x,
    avg_unit_cost: x?.avg_unit_cost != null ? Number(x.avg_unit_cost) : 0,
    stock_value: x?.stock_value != null ? Number(x.stock_value) : 0,
    available_qty: Number(x?.on_hand_qty || 0) - Number(x?.reserved_qty || 0),
  }))
  const data = lowOnly
    ? mapped.filter((x) => x.min_qty != null && Number(x.on_hand_qty || 0) <= Number(x.min_qty || 0))
    : mapped
  return NextResponse.json({ data })
}
