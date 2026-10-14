import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const prismaAny = db as any
  const data = await prismaAny.estimationCatalogItem.update({
    where: { id: params.id },
    data: {
      ...(body.item_code !== undefined ? { item_code: String(body.item_code || '').trim() } : {}),
      ...(body.item_name !== undefined ? { item_name: String(body.item_name || '').trim() } : {}),
      ...(body.item_type !== undefined ? { item_type: String(body.item_type || '').trim() } : {}),
      ...(body.item_group !== undefined ? { item_group: String(body.item_group || '').trim() } : {}),
      ...(body.item_unit !== undefined ? { item_unit: String(body.item_unit || '').trim() } : {}),
      ...(body.specs !== undefined ? { specs: body.specs ?? null } : {}),
      ...(body.description !== undefined ? { description: body.description ? String(body.description) : null } : {}),
      ...(body.is_active !== undefined ? { is_active: Boolean(body.is_active) } : {}),
    },
  })

  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const prismaAny = db as any
  await prismaAny.estimationCatalogItem.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
