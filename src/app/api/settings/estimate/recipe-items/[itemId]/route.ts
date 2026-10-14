import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export async function PATCH(req: NextRequest, { params }: { params: { itemId: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const current = await db.estimationRecipeItem.findUnique({
    where: { id: params.itemId },
    select: { id: true, recipe_id: true, material_key: true, ratio_percent: true, quantity_per_m2: true },
  })
  if (!current) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  const nextMaterialKey =
    body.material_key !== undefined ? String(body.material_key || '').trim() : current.material_key
  if (!nextMaterialKey) return NextResponse.json({ error: 'Thieu material_key' }, { status: 400 })

  if (nextMaterialKey !== current.material_key) {
    const existed = await db.estimationRecipeItem.findFirst({
      where: { recipe_id: current.recipe_id, material_key: nextMaterialKey },
      select: { id: true },
    })
    if (existed) {
      return NextResponse.json(
        { error: 'Vat tu nay da ton tai trong recipe. Moi vat tu chi duoc nhap 1 lan.' },
        { status: 409 }
      )
    }
  }

  const nextRatio =
    body.ratio_percent !== undefined ? toNumber(body.ratio_percent) : current.ratio_percent
  const nextQty =
    body.quantity_per_m2 !== undefined ? toNumber(body.quantity_per_m2) : current.quantity_per_m2
  const hasRatio = nextRatio !== null
  const hasQty = nextQty !== null
  if (hasRatio === hasQty) {
    return NextResponse.json(
      { error: 'Chi duoc nhap 1 trong 2: ratio_percent hoac quantity_per_m2' },
      { status: 400 }
    )
  }

  const updated = await db.estimationRecipeItem.update({
    where: { id: params.itemId },
    data: {
      ...(body.material_key !== undefined ? { material_key: nextMaterialKey } : {}),
      ...(body.material_name !== undefined
        ? { material_name: body.material_name ? String(body.material_name).trim() : null }
        : {}),
      ...(body.ratio_percent !== undefined ? { ratio_percent: nextRatio } : {}),
      ...(body.quantity_per_m2 !== undefined ? { quantity_per_m2: nextQty } : {}),
      ...(body.waste_factor !== undefined ? { waste_factor: toNumber(body.waste_factor) } : {}),
      ...(body.note !== undefined ? { note: body.note ? String(body.note) : null } : {}),
      ...(body.sort_order !== undefined ? { sort_order: toNumber(body.sort_order) || 0 } : {}),
    },
  })
  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { itemId: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  await db.estimationRecipeItem.delete({ where: { id: params.itemId } })
  return NextResponse.json({ ok: true })
}

