import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

type RoleKey = 'all' | 'actor' | 'handover_from' | 'handover_to'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.assetsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const userId = String(sp.get('user_id') || '').trim()
  const role = (String(sp.get('role') || 'all').trim() as RoleKey)
  const from = String(sp.get('from') || '').trim()
  const to = String(sp.get('to') || '').trim()
  const limit = Math.max(1, Math.min(1000, Number(sp.get('limit') || 200)))

  if (!userId) return NextResponse.json({ error: 'Thieu user_id' }, { status: 400 })
  if (!['all', 'actor', 'handover_from', 'handover_to'].includes(role)) {
    return NextResponse.json({ error: 'role khong hop le' }, { status: 400 })
  }

  const where: any = {}
  if (from || to) {
    where.happened_at = {}
    if (from) where.happened_at.gte = new Date(from)
    if (to) where.happened_at.lte = new Date(to)
  }

  const rows = await db.assetLifecycleEvent.findMany({
    where,
    include: {
      asset: { select: { id: true, asset_code: true, asset_name: true } },
      actor: { select: { id: true, username: true } },
    },
    orderBy: [{ happened_at: 'desc' }],
    take: limit,
  })

  const filtered = rows
    .map((r) => {
      const meta = (r.metadata_json || {}) as any
      const participants = Array.isArray(meta.participants) ? meta.participants : []
      const rolesForUser = participants
        .filter((p: any) => String(p?.user_id || '') === userId)
        .map((p: any) => String(p?.role || '').trim())
        .filter(Boolean)
      const isActor = String(meta?.actor?.id || r.actor_user_id || '') === userId
      const mergedRoles = Array.from(new Set([...(isActor ? ['actor'] : []), ...rolesForUser]))
      const matched =
        role === 'all'
          ? mergedRoles.length > 0
          : mergedRoles.includes(role)
      if (!matched) return null
      return {
        id: r.id,
        event_key: r.event_key,
        title: r.title,
        description: r.description,
        happened_at: r.happened_at,
        asset: r.asset,
        actor: r.actor,
        user_roles: mergedRoles,
        metadata_json: r.metadata_json,
      }
    })
    .filter(Boolean) as any[]

  const summary = {
    total: filtered.length,
    actor_count: filtered.filter((x) => x.user_roles.includes('actor')).length,
    handover_from_count: filtered.filter((x) => x.user_roles.includes('handover_from')).length,
    handover_to_count: filtered.filter((x) => x.user_roles.includes('handover_to')).length,
  }

  return NextResponse.json({ data: filtered, summary })
}
