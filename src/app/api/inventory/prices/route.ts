import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { getInventoryPriceTrackingData, safeJson } from '@/lib/inventory/price-tracking'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.inventoryRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const data = await getInventoryPriceTrackingData({
    warehouse_id: String(sp.get('warehouse_id') || '').trim(),
    supplier_id: String(sp.get('supplier_id') || '').trim(),
    material_key: String(sp.get('material_key') || '').trim(),
    price_kind: String(sp.get('price_kind') || '').trim(),
    date_from: String(sp.get('date_from') || '').trim(),
    date_to: String(sp.get('date_to') || '').trim(),
    page: Number(sp.get('page') || 1),
    page_size: Number(sp.get('page_size') || 20),
  })

  return NextResponse.json(safeJson(data))
}
