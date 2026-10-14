import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const projectId = String(params.id || '').trim()
  if (!projectId) return NextResponse.json({ error: 'project_id_required' }, { status: 400 })

  const rows = await (db as any).projectMaterialLedger.findMany({
    where: { project_id: projectId },
    orderBy: [{ happened_at: 'asc' }, { created_at: 'asc' }],
  })

  const byKey = new Map<string, any>()
  for (const r of rows) {
    const key = String(r.material_key || '').trim()
    if (!key) continue
    const curr = byKey.get(key) || {
      material_key: key,
      material_name: r.material_name || null,
      item_unit: r.item_unit || null,
      in_qty: 0,
      out_qty: 0,
      consume_qty: 0,
      return_qty: 0,
      adjust_qty: 0,
      on_site_qty: 0,
      last_happened_at: r.happened_at || null,
    }
    const qty = Number(r.quantity || 0)
    const dir = String(r.direction || '')
    if (dir === 'in') curr.in_qty += qty
    else if (dir === 'out') curr.out_qty += qty
    else if (dir === 'consume') curr.consume_qty += qty
    else if (dir === 'return') curr.return_qty += qty
    else if (dir === 'adjust') curr.adjust_qty += qty
    curr.on_site_qty = curr.in_qty - curr.out_qty - curr.consume_qty - curr.return_qty + curr.adjust_qty
    curr.last_happened_at = r.happened_at || curr.last_happened_at
    byKey.set(key, curr)
  }

  const data = Array.from(byKey.values()).sort((a, b) => String(a.material_name || a.material_key).localeCompare(String(b.material_name || b.material_key)))
  return NextResponse.json({ data })
}

