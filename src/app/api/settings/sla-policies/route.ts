import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function toInt(v: unknown, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = sp.get('active_only') !== 'false'
  const where: any = {}
  if (activeOnly) where.is_active = true

  const data = await (db as any).slaPolicy.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { created_at: 'asc' }],
    include: {
      levels: {
        orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
      },
    },
  })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const policyKey = String(body?.policy_key || '').trim()
  const name = String(body?.name || '').trim()
  const targetMinutes = toInt(body?.target_minutes, 0)
  if (!policyKey || !name || targetMinutes <= 0) {
    return NextResponse.json({ error: 'Thieu policy_key, name hoac target_minutes khong hop le' }, { status: 400 })
  }

  const data = await (db as any).slaPolicy.create({
    data: {
      policy_key: policyKey,
      name,
      is_active: body?.is_active !== false,
      priority: toInt(body?.priority, 0),
      target_minutes: targetMinutes,
      match_json: body?.match_json ?? null,
    },
  })
  return NextResponse.json({ data }, { status: 201 })
}

