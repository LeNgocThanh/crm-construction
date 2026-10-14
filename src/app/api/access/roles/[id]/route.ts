import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const permissionIds: string[] | null = Array.isArray(body?.permission_ids)
    ? (Array.from(new Set(body.permission_ids.map((x: any) => String(x || '').trim()).filter(Boolean))) as string[])
    : null
  const data: any = {}

  if (body.role_key !== undefined) {
    const value = String(body.role_key || '').trim().toLowerCase()
    if (!value) return NextResponse.json({ error: 'role_key không hợp lệ' }, { status: 400 })
    if (!/^[a-z0-9_]+$/.test(value)) return NextResponse.json({ error: 'role_key chỉ gồm a-z, 0-9, _' }, { status: 400 })
    data.role_key = value
  }
  if (body.role_name !== undefined) {
    const value = String(body.role_name || '').trim()
    if (!value) return NextResponse.json({ error: 'role_name không hợp lệ' }, { status: 400 })
    data.role_name = value
  }
  if (body.description !== undefined) data.description = String(body.description || '').trim() || null
  if (body.is_active !== undefined) data.is_active = Boolean(body.is_active)
  if (body.sort_order !== undefined) {
    const sortOrder = Number(body.sort_order || 0)
    data.sort_order = Number.isFinite(sortOrder) ? sortOrder : 0
  }

  const role = await db.$transaction(async (tx) => {
    if (permissionIds) {
      await (tx as any).accessRolePermission.deleteMany({ where: { role_id: params.id } })
      if (permissionIds.length) {
        await (tx as any).accessRolePermission.createMany({
          data: permissionIds.map((permissionId: string) => ({
            role_id: params.id,
            permission_id: permissionId,
          })),
          skipDuplicates: true,
        })
      }
    }

    return (tx as any).accessRole.update({
      where: { id: params.id },
      data,
    })
  })

  return NextResponse.json({ data: role })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const role = await (db as any).accessRole.findUnique({
    where: { id: params.id },
    select: { id: true, is_system: true },
  })
  if (!role) return NextResponse.json({ error: 'Không tìm thấy role' }, { status: 404 })
  if (role.is_system) {
    return NextResponse.json({ error: 'Role hệ thống không được xóa' }, { status: 400 })
  }

  const used = await (db as any).userRoleMembership.count({ where: { role_id: params.id } })
  if (used > 0) {
    return NextResponse.json({ error: 'Role đang được gán cho user, hãy tắt is_active thay vì xóa' }, { status: 400 })
  }

  await (db as any).accessRole.delete({ where: { id: params.id } })
  return NextResponse.json({ message: 'Đã xóa role' })
}
