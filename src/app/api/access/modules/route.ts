import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = String(sp.get('active_only') || 'false') === 'true'

  const where: any = {}
  if (activeOnly) where.is_active = true

  const rows = await (db as any).accessModule.findMany({
    where,
    orderBy: [{ sort_order: 'asc' }, { module_name: 'asc' }],
    select: {
      id: true,
      module_key: true,
      module_name: true,
      description: true,
      is_active: true,
      sort_order: true,
      _count: {
        select: {
          resources: true,
          permissions: true,
        },
      },
    },
  })

  return NextResponse.json({ data: rows })
}
