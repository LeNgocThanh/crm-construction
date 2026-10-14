import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function toInt(v: unknown, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const data = await (db as any).slaPolicy.update({
    where: { id: params.id },
    data: {
      ...(body?.policy_key !== undefined ? { policy_key: String(body.policy_key || '').trim() } : {}),
      ...(body?.name !== undefined ? { name: String(body.name || '').trim() } : {}),
      ...(body?.is_active !== undefined ? { is_active: Boolean(body.is_active) } : {}),
      ...(body?.priority !== undefined ? { priority: toInt(body.priority, 0) } : {}),
      ...(body?.target_minutes !== undefined ? { target_minutes: Math.max(1, toInt(body.target_minutes, 1)) } : {}),
      ...(body?.match_json !== undefined ? { match_json: body.match_json ?? null } : {}),
    },
  })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  await (db as any).slaPolicy.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

