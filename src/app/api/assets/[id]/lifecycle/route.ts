import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireResourceAccess } from '@/lib/access-control'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireResourceAccess({ resourceType: 'asset', action: 'read', resourceId: params.id })
  if (auth.error) return auth.error

  const data = await db.assetLifecycleEvent.findMany({
    where: { asset_id: params.id },
    orderBy: [{ happened_at: 'desc' }],
    include: { actor: { select: { id: true, username: true } } },
  })
  return NextResponse.json({ data })
}
