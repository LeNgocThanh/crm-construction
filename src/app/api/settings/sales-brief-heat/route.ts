import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const activeOnly = new URL(req.url).searchParams.get('active_only') !== 'false'
  const rows = await (db as any).salesBriefHeatConfig.findMany({
    where: activeOnly ? { is_active: true } : undefined,
    orderBy: [{ group_name: 'asc' }, { sort_order: 'asc' }, { config_name: 'asc' }],
  }).catch(() => [])

  return NextResponse.json({ data: rows })
}

