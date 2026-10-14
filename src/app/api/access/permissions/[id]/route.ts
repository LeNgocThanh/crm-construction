import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

async function resolvePermissionNamespace(input: { moduleId: string; resourceId?: string | null }) {
  const moduleRow = await (db as any).accessModule.findUnique({
    where: { id: input.moduleId },
    select: { id: true, module_key: true },
  })
  if (!moduleRow) return { error: 'Không tìm thấy module', permissionKeyPrefix: null }

  if (!input.resourceId) {
    return { error: null, permissionKeyPrefix: String(moduleRow.module_key || '').trim().toLowerCase() }
  }

  const resourceRow = await (db as any).accessResource.findUnique({
    where: { id: input.resourceId },
    select: {
      id: true,
      module_id: true,
      module: { select: { module_key: true } },
    },
  })
  if (!resourceRow) return { error: 'Không tìm thấy resource', permissionKeyPrefix: null }
  if (String(resourceRow.module_id || '') !== input.moduleId) {
    return { error: 'Resource không thuộc module đã chọn', permissionKeyPrefix: null }
  }

  return {
    error: null,
    permissionKeyPrefix: String(resourceRow.module?.module_key || moduleRow.module_key || '').trim().toLowerCase(),
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const current = await (db as any).accessPermission.findUnique({
    where: { id: params.id },
    select: { id: true, module_id: true, resource_id: true, action_key: true },
  })
  if (!current) return NextResponse.json({ error: 'Không tìm thấy permission' }, { status: 404 })

  const data: any = {}
  let nextModuleId = String(current.module_id || '')
  let nextResourceId = current.resource_id ? String(current.resource_id) : ''
  let nextActionKey = String(current.action_key || '')

  if (body.permission_name !== undefined) {
    const value = String(body.permission_name || '').trim()
    if (!value) return NextResponse.json({ error: 'permission_name không hợp lệ' }, { status: 400 })
    data.permission_name = value
  }
  if (body.action_key !== undefined) {
    const value = String(body.action_key || '').trim().toLowerCase()
    if (!value) return NextResponse.json({ error: 'action_key không hợp lệ' }, { status: 400 })
    data.action_key = value
    nextActionKey = value
  }
  if (body.description !== undefined) data.description = String(body.description || '').trim() || null
  if (body.is_active !== undefined) data.is_active = Boolean(body.is_active)
  if (body.sort_order !== undefined) {
    const sortOrder = Number(body.sort_order || 0)
    data.sort_order = Number.isFinite(sortOrder) ? sortOrder : 0
  }
  if (body.module_id !== undefined) {
    const moduleId = String(body.module_id || '').trim()
    if (!moduleId) return NextResponse.json({ error: 'module_id không hợp lệ' }, { status: 400 })
    const moduleRow = await (db as any).accessModule.findUnique({ where: { id: moduleId }, select: { id: true } })
    if (!moduleRow) return NextResponse.json({ error: 'Không tìm thấy module' }, { status: 404 })
    data.module_id = moduleId
    nextModuleId = moduleId
  }
  if (body.resource_id !== undefined) {
    const resourceId = String(body.resource_id || '').trim()
    if (resourceId) {
      const resourceRow = await (db as any).accessResource.findUnique({ where: { id: resourceId }, select: { id: true } })
      if (!resourceRow) return NextResponse.json({ error: 'Không tìm thấy resource' }, { status: 404 })
      data.resource_id = resourceId
      nextResourceId = resourceId
    } else {
      data.resource_id = null
      nextResourceId = ''
    }
  }

  const resolved = await resolvePermissionNamespace({
    moduleId: nextModuleId,
    resourceId: nextResourceId || null,
  })
  if (resolved.error || !resolved.permissionKeyPrefix) {
    return NextResponse.json({ error: resolved.error || 'Không thể sinh permission_key' }, { status: 400 })
  }
  data.permission_key = `${resolved.permissionKeyPrefix}.${nextActionKey}`

  const row = await (db as any).accessPermission.update({
    where: { id: params.id },
    data,
  })

  return NextResponse.json({ data: row })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const used = await (db as any).accessRolePermission.count({ where: { permission_id: params.id } })
  if (used > 0) {
    return NextResponse.json({ error: 'Permission đang được gán cho role, hãy tắt is_active thay vì xóa' }, { status: 400 })
  }

  await (db as any).accessPermission.delete({ where: { id: params.id } })
  return NextResponse.json({ message: 'Đã xóa permission' })
}
