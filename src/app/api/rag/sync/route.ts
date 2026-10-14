// src/app/api/rag/sync/route.ts — Sync all DB entries to Qdrant
import { NextRequest, NextResponse } from 'next/server'
import { syncAllEntriesToQdrant } from '@/lib/rag/qdrant'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  try {
    const result = await syncAllEntriesToQdrant()
    return NextResponse.json({ data: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET — check Qdrant collection status
export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const QDRANT_URL = process.env.QDRANT_URL || 'http://100.84.109.121:6333'
  const COLLECTION = process.env.QDRANT_COLLECTION || 'crm_rag'

  try {
    const [colRes, dbCount] = await Promise.all([
      fetch(`${QDRANT_URL}/collections/${COLLECTION}`).then(r => r.json()),
      import('@/lib/db').then(m => m.db.ragEntry.count({ where: { is_active: true } })),
    ])
    const dbSynced = await import('@/lib/db').then((m) =>
      m.db.ragEntry.count({ where: { is_active: true, qdrant_id: { not: null } } })
    )
    return NextResponse.json({
      data: {
        qdrant_status:   colRes.status === 'ok' ? 'ok' : 'error',
        qdrant_points:   colRes.result?.points_count ?? 0,
        db_entries:      dbCount,
        db_synced:       dbSynced,
        collection:      COLLECTION,
        in_sync:         colRes.status === 'ok' && dbSynced === dbCount,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
