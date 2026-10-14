import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = String(sp.get('active_only') || 'false') === 'true'
  const moduleId = String(sp.get('module_id') || '').trim()

  const where: any = {}
  if (activeOnly) where.is_active = true
  if (moduleId) where.module_id = moduleId

  const rows = await (db as any).accessResource.findMany({
    where,
    orderBy: [{ sort_order: 'asc' }, { resource_name: 'asc' }],
    select: {
      id: true,
      resource_key: true,
      resource_name: true,
      description: true,
      is_active: true,
      sort_order: true,
      module_id: true,
      module: {
        select: {
          id: true,
          module_key: true,
          module_name: true,
        },
      },
      _count: {
        select: {
          permissions: true,
        },
      },
    },
  })

  return NextResponse.json({ data: rows })
}
