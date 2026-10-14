import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = sp.get('active_only') !== 'false'
  const itemType = sp.get('item_type')
  const itemGroup = sp.get('item_group')

  const where: any = {}
  if (activeOnly) where.is_active = true
  if (itemType) where.item_type = itemType
  if (itemGroup) where.item_group = itemGroup

  const prismaAny = db as any
  const data = await prismaAny.estimationCatalogItem.findMany({
    where,
    orderBy: [{ item_group: 'asc' }, { item_name: 'asc' }],
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const itemCode = String(body.item_code || '').trim()
  const itemName = String(body.item_name || '').trim()
  const itemType = String(body.item_type || '').trim()
  const itemGroup = String(body.item_group || '').trim()
  const itemUnit = String(body.item_unit || '').trim()
  if (!itemCode || !itemName || !itemType || !itemGroup || !itemUnit) {
    return NextResponse.json(
      { error: 'Thieu item_code, item_name, item_type, item_group hoac item_unit' },
      { status: 400 }
    )
  }

  const prismaAny = db as any
  const data = await prismaAny.estimationCatalogItem.create({
    data: {
      item_code: itemCode,
      item_name: itemName,
      item_type: itemType,
      item_group: itemGroup,
      item_unit: itemUnit,
      specs: body.specs ?? null,
      description: body.description ? String(body.description) : null,
      is_active: body.is_active !== false,
    },
  })

  return NextResponse.json({ data }, { status: 201 })
}
