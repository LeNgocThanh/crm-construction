import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function toInt(v: unknown, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

export async function PATCH(req: NextRequest, { params }: { params: { levelId: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const data = await (db as any).slaPolicyLevel.update({
    where: { id: params.levelId },
    data: {
      ...(body?.level_key !== undefined ? { level_key: String(body.level_key || '').trim() } : {}),
      ...(body?.level_name !== undefined ? { level_name: String(body.level_name || '').trim() } : {}),
      ...(body?.sort_order !== undefined ? { sort_order: toInt(body.sort_order, 0) } : {}),
      ...(body?.trigger_type !== undefined ? { trigger_type: String(body.trigger_type || '').trim() } : {}),
      ...(body?.trigger_minutes !== undefined ? { trigger_minutes: Math.max(0, toInt(body.trigger_minutes, 0)) } : {}),
      ...(body?.cooldown_minutes !== undefined ? { cooldown_minutes: Math.max(0, toInt(body.cooldown_minutes, 60)) } : {}),
      ...(body?.notify_type !== undefined ? { notify_type: body.notify_type ? String(body.notify_type) : null } : {}),
      ...(body?.notify_targets_json !== undefined ? { notify_targets_json: body.notify_targets_json ?? null } : {}),
      ...(body?.is_active !== undefined ? { is_active: Boolean(body.is_active) } : {}),
    },
  })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: { levelId: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  await (db as any).slaPolicyLevel.delete({ where: { id: params.levelId } })
  return NextResponse.json({ ok: true })
}

