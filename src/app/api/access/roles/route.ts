import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = String(sp.get('active_only') || 'false') === 'true'
  const search = String(sp.get('search') || '').trim()

  const where: any = {}
  if (activeOnly) where.is_active = true
  if (search) {
    where.OR = [
      { role_key: { contains: search, mode: 'insensitive' } },
      { role_name: { contains: search, mode: 'insensitive' } },
    ]
  }

  const rows = await (db as any).accessRole.findMany({
    where,
    orderBy: [{ sort_order: 'asc' }, { role_name: 'asc' }],
    select: {
      id: true,
      role_key: true,
      role_name: true,
      description: true,
      is_system: true,
      is_active: true,
      sort_order: true,
      role_permissions: {
        select: {
          permission: {
            select: {
              id: true,
              permission_key: true,
              permission_name: true,
              module: {
                select: {
                  module_key: true,
                  module_name: true,
                },
              },
            },
          },
        },
      },
      _count: {
        select: {
          role_permissions: true,
          user_memberships: true,
        },
      },
    },
  })

  const data = rows.map((row: any) => ({
    ...row,
    permissions: (row.role_permissions || []).map((item: any) => item.permission),
  }))

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const roleKey = String(body?.role_key || '').trim().toLowerCase()
  const roleName = String(body?.role_name || '').trim()
  const description = String(body?.description || '').trim()
  const permissionIds: string[] = Array.isArray(body?.permission_ids)
    ? (Array.from(new Set(body.permission_ids.map((x: any) => String(x || '').trim()).filter(Boolean))) as string[])
    : []
  const sortOrder = Number(body?.sort_order || 0)

  if (!roleKey || !roleName) {
    return NextResponse.json({ error: 'Thiếu role_key hoặc role_name' }, { status: 400 })
  }
  if (!/^[a-z0-9_]+$/.test(roleKey)) {
    return NextResponse.json({ error: 'role_key chỉ gồm a-z, 0-9, _' }, { status: 400 })
  }

  const role = await db.$transaction(async (tx) => {
    const roleRow = await (tx as any).accessRole.create({
      data: {
        role_key: roleKey,
        role_name: roleName,
        description: description || null,
        is_system: false,
        is_active: body?.is_active !== false,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      },
    })

    if (permissionIds.length) {
      await (tx as any).accessRolePermission.createMany({
        data: permissionIds.map((permissionId: string) => ({
          role_id: roleRow.id,
          permission_id: permissionId,
        })),
        skipDuplicates: true,
      })
    }

    return roleRow
  })

  return NextResponse.json({ data: role }, { status: 201 })
}
