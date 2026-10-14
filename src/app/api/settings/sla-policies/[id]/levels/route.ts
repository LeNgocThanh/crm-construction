import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function toInt(v: unknown, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const data = await (db as any).slaPolicyLevel.findMany({
    where: { policy_id: params.id },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const levelKey = String(body?.level_key || '').trim()
  const levelName = String(body?.level_name || '').trim()
  const triggerType = String(body?.trigger_type || '').trim()
  const triggerMinutes = toInt(body?.trigger_minutes, -1)
  if (!levelKey || !levelName || !['before_due', 'after_due'].includes(triggerType) || triggerMinutes < 0) {
    return NextResponse.json({ error: 'Level data khong hop le' }, { status: 400 })
  }

  const data = await (db as any).slaPolicyLevel.create({
    data: {
      policy_id: params.id,
      level_key: levelKey,
      level_name: levelName,
      sort_order: toInt(body?.sort_order, 0),
      trigger_type: triggerType,
      trigger_minutes: triggerMinutes,
      cooldown_minutes: Math.max(0, toInt(body?.cooldown_minutes, 60)),
      notify_type: body?.notify_type ? String(body.notify_type) : null,
      notify_targets_json: body?.notify_targets_json ?? null,
      is_active: body?.is_active !== false,
    },
  })
  return NextResponse.json({ data }, { status: 201 })
}

