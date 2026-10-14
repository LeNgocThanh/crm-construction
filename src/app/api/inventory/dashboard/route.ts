import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { getInventoryDashboardData, safeJson } from '@/lib/inventory/dashboard'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.inventoryRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const data = await getInventoryDashboardData({
    warehouse_id: String(sp.get('warehouse_id') || '').trim(),
    date_from: String(sp.get('date_from') || '').trim(),
    date_to: String(sp.get('date_to') || '').trim(),
  })
  return NextResponse.json(safeJson(data))
}
