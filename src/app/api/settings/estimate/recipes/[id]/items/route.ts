import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const materialKey = String(body.material_key || '').trim()
  if (!materialKey) return NextResponse.json({ error: 'Thieu material_key' }, { status: 400 })

  const ratioPercent = toNumber(body.ratio_percent)
  const quantityPerM2 = toNumber(body.quantity_per_m2)
  const hasRatio = ratioPercent !== null
  const hasQty = quantityPerM2 !== null
  if (hasRatio === hasQty) {
    return NextResponse.json(
      { error: 'Chi duoc nhap 1 trong 2: ratio_percent hoac quantity_per_m2' },
      { status: 400 }
    )
  }

  const existed = await db.estimationRecipeItem.findFirst({
    where: { recipe_id: params.id, material_key: materialKey },
    select: { id: true },
  })
  if (existed) {
    return NextResponse.json(
      { error: 'Vat tu nay da ton tai trong recipe. Moi vat tu chi duoc nhap 1 lan.' },
      { status: 409 }
    )
  }

  const created = await db.estimationRecipeItem.create({
    data: {
      recipe_id: params.id,
      material_key: materialKey,
      material_name: body.material_name ? String(body.material_name).trim() : null,
      ratio_percent: ratioPercent,
      quantity_per_m2: quantityPerM2,
      waste_factor: toNumber(body.waste_factor),
      note: body.note ? String(body.note) : null,
      sort_order: toNumber(body.sort_order) || 0,
    },
  })

  return NextResponse.json({ data: created }, { status: 201 })
}

