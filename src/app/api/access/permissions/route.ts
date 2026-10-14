import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

async function resolvePermissionNamespace(input: { moduleId: string; resourceId?: string | null }) {
  const moduleRow = await (db as any).accessModule.findUnique({
    where: { id: input.moduleId },
    select: { id: true, module_key: true },
  })
  if (!moduleRow) return { error: 'Không tìm thấy module', moduleRow: null, resourceRow: null, permissionKeyPrefix: null }

  if (!input.resourceId) {
    return { error: null, moduleRow, resourceRow: null, permissionKeyPrefix: String(moduleRow.module_key || '').trim().toLowerCase() }
  }

  const resourceRow = await (db as any).accessResource.findUnique({
    where: { id: input.resourceId },
    select: {
      id: true,
      module_id: true,
      module: { select: { module_key: true } },
    },
  })
  if (!resourceRow) return { error: 'Không tìm thấy resource', moduleRow, resourceRow: null, permissionKeyPrefix: null }
  if (String(resourceRow.module_id || '') !== input.moduleId) {
    return { error: 'Resource không thuộc module đã chọn', moduleRow, resourceRow, permissionKeyPrefix: null }
  }

  return {
    error: null,
    moduleRow,
    resourceRow,
    permissionKeyPrefix: String(resourceRow.module?.module_key || moduleRow.module_key || '').trim().toLowerCase(),
  }
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = String(sp.get('active_only') || 'false') === 'true'
  const moduleId = String(sp.get('module_id') || '').trim()
  const resourceId = String(sp.get('resource_id') || '').trim()
  const search = String(sp.get('search') || '').trim()

  const where: any = {}
  if (activeOnly) where.is_active = true
  if (moduleId) where.module_id = moduleId
  if (resourceId) where.resource_id = resourceId
  if (search) {
    where.OR = [
      { permission_key: { contains: search, mode: 'insensitive' } },
      { permission_name: { contains: search, mode: 'insensitive' } },
      { action_key: { contains: search, mode: 'insensitive' } },
    ]
  }

  const rows = await (db as any).accessPermission.findMany({
    where,
    orderBy: [{ sort_order: 'asc' }, { permission_key: 'asc' }],
    select: {
      id: true,
      permission_key: true,
      permission_name: true,
      action_key: true,
      description: true,
      is_active: true,
      sort_order: true,
      module_id: true,
      resource_id: true,
      module: {
        select: {
          id: true,
          module_key: true,
          module_name: true,
        },
      },
      resource: {
        select: {
          id: true,
          resource_key: true,
          resource_name: true,
        },
      },
      _count: {
        select: {
          role_permissions: true,
        },
      },
    },
  })

  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const permissionName = String(body?.permission_name || '').trim()
  const moduleId = String(body?.module_id || '').trim()
  const resourceIdRaw = String(body?.resource_id || '').trim()
  const resourceId = resourceIdRaw || null
  const actionKey = String(body?.action_key || '').trim().toLowerCase()
  const description = String(body?.description || '').trim()
  const sortOrder = Number(body?.sort_order || 0)

  if (!permissionName || !moduleId || !actionKey) {
    return NextResponse.json({ error: 'Thiếu permission_name, module_id hoặc action_key' }, { status: 400 })
  }

  const resolved = await resolvePermissionNamespace({ moduleId, resourceId })
  if (resolved.error || !resolved.permissionKeyPrefix) {
    return NextResponse.json({ error: resolved.error || 'Không thể sinh permission_key' }, { status: 400 })
  }
  const permissionKey = `${resolved.permissionKeyPrefix}.${actionKey}`

  const row = await (db as any).accessPermission.create({
    data: {
      permission_key: permissionKey,
      permission_name: permissionName,
      module_id: moduleId,
      resource_id: resourceId,
      action_key: actionKey,
      description: description || null,
      is_active: body?.is_active !== false,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    },
  })

  return NextResponse.json({ data: row }, { status: 201 })
}
