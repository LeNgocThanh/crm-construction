import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const updated = await (db as any).warehouse.update({
    where: { id: params.id },
    data: {
      ...(body.warehouse_code !== undefined ? { warehouse_code: String(body.warehouse_code || '').trim() } : {}),
      ...(body.warehouse_name !== undefined ? { warehouse_name: String(body.warehouse_name || '').trim() } : {}),
      ...(body.region_code !== undefined ? { region_code: body.region_code ? String(body.region_code).trim() : null } : {}),
      ...(body.address !== undefined ? { address: body.address ? String(body.address).trim() : null } : {}),
      ...(body.manager_name !== undefined ? { manager_name: body.manager_name ? String(body.manager_name).trim() : null } : {}),
      ...(body.manager_phone !== undefined ? { manager_phone: body.manager_phone ? String(body.manager_phone).trim() : null } : {}),
      ...(body.is_active !== undefined ? { is_active: Boolean(body.is_active) } : {}),
    },
  })
  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  await (db as any).warehouse.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

