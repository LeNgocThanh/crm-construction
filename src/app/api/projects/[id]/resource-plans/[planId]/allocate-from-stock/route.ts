import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { syncResourcePlanActualsFromInventory } from '@/lib/projects/resource-plan-actuals'

function toNum(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

async function getOnSiteQty(projectId: string, materialKey: string) {
  const rows = await (db as any).projectMaterialLedger.findMany({
    where: { project_id: projectId, material_key: materialKey },
    select: { direction: true, quantity: true },
  })
  let inQty = 0
  let outQty = 0
  let consumeQty = 0
  let returnQty = 0
  let adjustQty = 0
  for (const r of rows || []) {
    const qty = toNum(r?.quantity)
    const dir = String(r?.direction || '')
    if (dir === 'in') inQty += qty
    else if (dir === 'out') outQty += qty
    else if (dir === 'consume') consumeQty += qty
    else if (dir === 'return') returnQty += qty
    else if (dir === 'adjust') adjustQty += qty
  }
  return inQty - outQty - consumeQty - returnQty + adjustQty
}

export async function POST(req: NextRequest, { params }: { params: { id: string; planId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const projectId = String(params.id || '').trim()
  const planId = String(params.planId || '').trim()
  const allocationModel = (db as any).projectMaterialAllocation
  if (!allocationModel) {
    return NextResponse.json({ error: 'He thong chua cap nhat model phan bo vat tu. Vui long chay prisma generate/db push.' }, { status: 500 })
  }
  const body = await req.json().catch(() => ({}))
  const materialKey = String(body?.material_key || '').trim()
  const requestedQty = toNum(body?.quantity)
  const note = body?.note ? String(body.note) : null
  if (!projectId || !planId) return NextResponse.json({ error: 'Thieu project/plan id' }, { status: 400 })
  if (!materialKey) return NextResponse.json({ error: 'Thieu material_key' }, { status: 400 })

  const plan = await db.projectResourcePlan.findFirst({
    where: { id: planId, project_id: projectId, is_active: true },
    select: { id: true, status: true },
  })
  if (!plan) return NextResponse.json({ error: 'Khong tim thay ke hoach' }, { status: 404 })
  if (!['approved', 'locked'].includes(String(plan.status || ''))) {
    return NextResponse.json({ error: 'Chi phan bo cho ke hoach da duyet/da khoa' }, { status: 400 })
  }

  await syncResourcePlanActualsFromInventory(planId)
  const item = await db.projectResourcePlanItem.findFirst({
    where: {
      project_id: projectId,
      plan_id: planId,
      resource_kind: 'material',
      item_key: materialKey,
      is_active: true,
    },
    select: { id: true, quantity: true, actual_received_qty: true, unit: true, item_name: true, item_key: true },
  })
  if (!item) return NextResponse.json({ error: 'Vat tu khong thuoc ke hoach nay' }, { status: 400 })

  const shortage = Math.max(0, toNum(item.quantity) - toNum(item.actual_received_qty))
  if (shortage <= 0) return NextResponse.json({ error: 'Vat tu nay da du, khong can phan bo' }, { status: 400 })

  const onSiteQty = await getOnSiteQty(projectId, materialKey)
  const allocRows = await allocationModel.findMany({
    where: { project_id: projectId, material_key: materialKey, is_active: true },
    select: { allocated_qty: true },
  })
  const allocatedTotal = (allocRows || []).reduce((s: number, r: any) => s + toNum(r?.allocated_qty), 0)
  const freeQty = onSiteQty - allocatedTotal
  if (freeQty <= 0) return NextResponse.json({ error: 'Khong con ton du an chua phan bo cho vat tu nay' }, { status: 400 })

  const allocateQty = Math.min(
    shortage,
    freeQty,
    requestedQty > 0 ? requestedQty : shortage,
  )
  if (!(allocateQty > 0)) return NextResponse.json({ error: 'So luong phan bo khong hop le' }, { status: 400 })

  await allocationModel.create({
    data: {
      project_id: projectId,
      plan_id: planId,
      plan_item_id: item.id,
      material_key: materialKey,
      item_unit: item.unit || null,
      allocated_qty: allocateQty,
      note,
      created_by: String(session.user.id || '') || null,
    },
  })
  await syncResourcePlanActualsFromInventory(planId)

  return NextResponse.json({
    data: {
      plan_id: planId,
      material_key: materialKey,
      allocated_qty: allocateQty,
      free_qty_before: freeQty,
      free_qty_after: freeQty - allocateQty,
      shortage_before: shortage,
      shortage_after: Math.max(0, shortage - allocateQty),
    },
  })
}
