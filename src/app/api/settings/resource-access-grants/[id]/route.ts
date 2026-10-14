import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { BASIC_USER_WITH_ROLE_SELECT, mapBasicUserWithRole } from '@/lib/user-profiles'

const ACCESS_LEVELS = new Set(['viewer', 'editor', 'approver', 'manager'])

function normalizeText(value: unknown) {
  const text = String(value || '').trim()
  return text || null
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error || !auth.ctx) return auth.error

  const current = await (db as any).resourceAccessGrant.findUnique({ where: { id: params.id } })
  if (!current) return NextResponse.json({ error: 'Không tìm thấy grant' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const accessLevel = body?.access_level !== undefined ? normalizeText(body.access_level) : current.access_level
  if (accessLevel && !ACCESS_LEVELS.has(accessLevel)) {
    return NextResponse.json({ error: 'access_level không hợp lệ' }, { status: 400 })
  }

  const flags = applyAccessLevelDefaults({
    accessLevel,
    canRead: body?.can_read !== undefined ? Boolean(body.can_read) : Boolean(current.can_read),
    canWrite: body?.can_write !== undefined ? Boolean(body.can_write) : Boolean(current.can_write),
    canApprove: body?.can_approve !== undefined ? Boolean(body.can_approve) : Boolean(current.can_approve),
    canManage: body?.can_manage !== undefined ? Boolean(body.can_manage) : Boolean(current.can_manage),
  })

  if (!flags.canRead && !flags.canWrite && !flags.canApprove && !flags.canManage) {
    return NextResponse.json({ error: 'Cần chọn ít nhất một quyền' }, { status: 400 })
  }

  const row = await (db as any).resourceAccessGrant.update({
    where: { id: params.id },
    data: {
      access_level: accessLevel,
      can_read: flags.canRead,
      can_write: flags.canWrite,
      can_approve: flags.canApprove,
      can_manage: flags.canManage,
      granted_by: auth.ctx.userId,
      granted_at: new Date(),
      expires_at: body?.expires_at !== undefined ? (body.expires_at ? new Date(body.expires_at) : null) : undefined,
      is_active: body?.is_active !== undefined ? Boolean(body.is_active) : undefined,
      note: body?.note !== undefined ? normalizeText(body.note) : undefined,
      metadata_json: body?.metadata_json !== undefined ? (body.metadata_json ?? null) : undefined,
    },
    include: {
      user: { select: BASIC_USER_WITH_ROLE_SELECT },
      granter: { select: { id: true, username: true } },
    },
  })

  return NextResponse.json({
    data: {
      ...row,
      user: row.user ? mapBasicUserWithRole(row.user) : null,
    },
  })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  await (db as any).resourceAccessGrant.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
