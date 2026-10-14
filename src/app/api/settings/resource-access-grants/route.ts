import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { BASIC_USER_WITH_ROLE_SELECT, mapBasicUserWithRole } from '@/lib/user-profiles'

const RESOURCE_TYPES = new Set(['customer', 'project', 'conversation', 'warehouse', 'asset', 'labor_worker'])
const ACCESS_LEVELS = new Set(['viewer', 'editor', 'approver', 'manager'])

function normalizeText(value: unknown) {
  const text = String(value || '').trim()
  return text || null
}

async function resolveResourceSummary(resourceType: string, resourceId: string) {
  if (resourceType === 'customer') {
    const row = await db.customer.findUnique({
      where: { id: resourceId },
      select: { id: true, full_name: true, phone_number: true },
    })
    return row
      ? { id: row.id, label: row.full_name || row.phone_number || row.id, subtitle: row.phone_number || null }
      : null
  }
  if (resourceType === 'project') {
    const row = await db.constructionProject.findUnique({
      where: { id: resourceId },
      select: { id: true, project_name: true },
    })
    return row
      ? { id: row.id, label: row.project_name || row.id, subtitle: 'Dự án' }
      : null
  }
  if (resourceType === 'conversation') {
    const row = await (db as any).conversation.findUnique({
      where: { id: resourceId },
      select: { id: true, display_name: true, channel: true, external_user_id: true },
    })
    return row
      ? { id: row.id, label: row.display_name || row.external_user_id || row.id, subtitle: row.channel || null }
      : null
  }
  if (resourceType === 'warehouse') {
    const row = await (db as any).warehouse.findUnique({
      where: { id: resourceId },
      select: { id: true, warehouse_code: true, warehouse_name: true },
    })
    return row
      ? { id: row.id, label: row.warehouse_name || row.warehouse_code || row.id, subtitle: row.warehouse_code || null }
      : null
  }
  if (resourceType === 'asset') {
    const row = await db.asset.findUnique({
      where: { id: resourceId },
      select: { id: true, asset_code: true, asset_name: true },
    })
    return row
      ? { id: row.id, label: row.asset_name || row.asset_code || row.id, subtitle: row.asset_code || null }
      : null
  }
  if (resourceType === 'labor_worker') {
    const row = await (db as any).laborWorker.findUnique({
      where: { id: resourceId },
      select: { id: true, worker_code: true, full_name: true },
    })
    return row
      ? { id: row.id, label: row.full_name || row.worker_code || row.id, subtitle: row.worker_code || null }
      : null
  }
  return null
}

async function serializeGrant(row: any) {
  const resource = await resolveResourceSummary(String(row.resource_type || ''), String(row.resource_id || ''))
  return {
    id: row.id,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    resource,
    user_id: row.user_id,
    user: row.user ? mapBasicUserWithRole(row.user) : null,
    access_level: row.access_level || null,
    can_read: !!row.can_read,
    can_write: !!row.can_write,
    can_approve: !!row.can_approve,
    can_manage: !!row.can_manage,
    granted_by: row.granted_by || null,
    granter: row.granter ? { id: row.granter.id, username: row.granter.username } : null,
    granted_at: row.granted_at,
    expires_at: row.expires_at,
    is_active: !!row.is_active,
    note: row.note || null,
    metadata_json: row.metadata_json ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function applyAccessLevelDefaults(input: {
  accessLevel: string | null
  canRead: boolean
  canWrite: boolean
  canApprove: boolean
  canManage: boolean
}) {
  if (!input.accessLevel) return input
  if (input.accessLevel === 'viewer') return { ...input, canRead: true }
  if (input.accessLevel === 'editor') return { ...input, canRead: true, canWrite: true }
  if (input.accessLevel === 'approver') return { ...input, canRead: true, canWrite: true, canApprove: true }
  if (input.accessLevel === 'manager') return { ...input, canRead: true, canWrite: true, canApprove: true, canManage: true }
  return input
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const resourceType = normalizeText(sp.get('resource_type'))
  const resourceId = normalizeText(sp.get('resource_id'))
  const userId = normalizeText(sp.get('user_id'))
  const activeOnly = sp.get('active_only') !== 'false'

  const where: any = {}
  if (resourceType) where.resource_type = resourceType
  if (resourceId) where.resource_id = resourceId
  if (userId) where.user_id = userId
  if (activeOnly) where.is_active = true

  const rows = await (db as any).resourceAccessGrant.findMany({
    where,
    include: {
      user: { select: BASIC_USER_WITH_ROLE_SELECT },
      granter: { select: { id: true, username: true } },
    },
    orderBy: [{ updated_at: 'desc' }, { granted_at: 'desc' }],
    take: 500,
  })

  const data = await Promise.all(rows.map(serializeGrant))
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error
  if (!auth.ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const resourceType = String(body?.resource_type || '').trim().toLowerCase()
  const resourceId = String(body?.resource_id || '').trim()
  const userId = String(body?.user_id || '').trim()
  const accessLevel = normalizeText(body?.access_level)

  if (!RESOURCE_TYPES.has(resourceType)) {
    return NextResponse.json({ error: 'resource_type không hợp lệ' }, { status: 400 })
  }
  if (!resourceId || !userId) {
    return NextResponse.json({ error: 'Thiếu resource_id hoặc user_id' }, { status: 400 })
  }
  if (accessLevel && !ACCESS_LEVELS.has(accessLevel)) {
    return NextResponse.json({ error: 'access_level không hợp lệ' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Không tìm thấy user' }, { status: 404 })

  const resource = await resolveResourceSummary(resourceType, resourceId)
  if (!resource) {
    return NextResponse.json({ error: 'resource_id không tồn tại với resource_type đã chọn' }, { status: 400 })
  }

  const flags = applyAccessLevelDefaults({
    accessLevel,
    canRead: Boolean(body?.can_read),
    canWrite: Boolean(body?.can_write),
    canApprove: Boolean(body?.can_approve),
    canManage: Boolean(body?.can_manage),
  })

  if (!flags.canRead && !flags.canWrite && !flags.canApprove && !flags.canManage) {
    return NextResponse.json({ error: 'Cần chọn ít nhất một quyền' }, { status: 400 })
  }

  const row = await (db as any).resourceAccessGrant.upsert({
    where: {
      resource_type_resource_id_user_id: {
        resource_type: resourceType,
        resource_id: resourceId,
        user_id: userId,
      },
    },
    update: {
      access_level: accessLevel,
      can_read: flags.canRead,
      can_write: flags.canWrite,
      can_approve: flags.canApprove,
      can_manage: flags.canManage,
      granted_by: auth.ctx.userId,
      granted_at: new Date(),
      expires_at: body?.expires_at ? new Date(body.expires_at) : null,
      is_active: body?.is_active === undefined ? true : Boolean(body.is_active),
      note: normalizeText(body?.note),
      metadata_json: body?.metadata_json ?? null,
    },
    create: {
      resource_type: resourceType,
      resource_id: resourceId,
      user_id: userId,
      access_level: accessLevel,
      can_read: flags.canRead,
      can_write: flags.canWrite,
      can_approve: flags.canApprove,
      can_manage: flags.canManage,
      granted_by: auth.ctx.userId,
      expires_at: body?.expires_at ? new Date(body.expires_at) : null,
      is_active: body?.is_active === undefined ? true : Boolean(body.is_active),
      note: normalizeText(body?.note),
      metadata_json: body?.metadata_json ?? null,
    },
    include: {
      user: { select: BASIC_USER_WITH_ROLE_SELECT },
      granter: { select: { id: true, username: true } },
    },
  })

  return NextResponse.json({ data: await serializeGrant(row) }, { status: 201 })
}
