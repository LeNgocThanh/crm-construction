import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const patch: any = {}

  if (body?.type_key !== undefined) {
    const typeKey = String(body.type_key || '').trim().toLowerCase()
    if (!typeKey) return NextResponse.json({ error: 'type_key khong hop le' }, { status: 400 })
    if (!/^[a-z0-9_]+$/.test(typeKey)) return NextResponse.json({ error: 'type_key chi gom a-z, 0-9, _' }, { status: 400 })
    patch.type_key = typeKey
  }
  if (body?.type_name !== undefined) {
    const typeName = String(body.type_name || '').trim()
    if (!typeName) return NextResponse.json({ error: 'type_name khong hop le' }, { status: 400 })
    patch.type_name = typeName
  }
  if (body?.description !== undefined) patch.description = body.description ? String(body.description) : null
  if (body?.default_unit_id !== undefined) patch.default_unit_id = body.default_unit_id ? String(body.default_unit_id) : null
  if (body?.sort_order !== undefined) patch.sort_order = Number(body.sort_order || 0)
  if (body?.is_active !== undefined) patch.is_active = Boolean(body.is_active)

  const data = await db.assetType.update({
    where: { id: params.id },
    data: patch,
    include: { default_unit: { select: { id: true, unit_key: true, unit_name: true, symbol: true } } },
  })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const inUse = await db.asset.findFirst({ where: { asset_type_id: params.id } })
  if (inUse) return NextResponse.json({ error: 'Loai tai san dang duoc su dung, hay tat is_active thay vi xoa' }, { status: 400 })

  await db.assetType.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
