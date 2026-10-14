import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const patch: any = {}
  if (body?.unit_key !== undefined) {
    const unitKey = String(body.unit_key || '').trim().toLowerCase()
    if (!unitKey) return NextResponse.json({ error: 'unit_key khong hop le' }, { status: 400 })
    if (!/^[a-z0-9_]+$/.test(unitKey)) {
      return NextResponse.json({ error: 'unit_key chi gom a-z, 0-9, _' }, { status: 400 })
    }
    patch.unit_key = unitKey
  }
  if (body?.unit_name !== undefined) {
    const unitName = String(body.unit_name || '').trim()
    if (!unitName) return NextResponse.json({ error: 'unit_name khong hop le' }, { status: 400 })
    patch.unit_name = unitName
  }
  if (body?.symbol !== undefined) patch.symbol = body.symbol ? String(body.symbol).trim() : null
  if (body?.category_key !== undefined) patch.category_key = body.category_key ? String(body.category_key).trim() : 'other'
  if (body?.description !== undefined) patch.description = body.description ? String(body.description) : null
  if (body?.sort_order !== undefined) patch.sort_order = Number(body.sort_order || 0)
  if (body?.is_active !== undefined) patch.is_active = Boolean(body.is_active)

  const data = await db.unit.update({ where: { id: params.id }, data: patch })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const inUse = await db.asset.findFirst({ where: { unit_id: params.id } })
  if (inUse) return NextResponse.json({ error: 'Unit dang duoc su dung, hay tat is_active thay vi xoa' }, { status: 400 })

  await db.unit.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

