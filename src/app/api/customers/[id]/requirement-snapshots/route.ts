import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createRequirementSnapshotSafe } from '@/lib/project-requirement-snapshots'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.customersRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const onlyCurrent = sp.get('current') === '1'
  const limitRaw = Number(sp.get('limit') || '50')
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.trunc(limitRaw))) : 50

  const where: any = { customer_id: params.id }
  if (onlyCurrent) where.is_current = true

  const data = await (db as any).projectRequirementSnapshot.findMany({
    where,
    orderBy: [{ version_no: 'desc' }],
    take: limit,
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.customersWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const body = await req.json().catch(() => ({}))
  const sourceType = String(body.source_type || '').trim() || 'manual'

  await createRequirementSnapshotSafe({
    customer_id: params.id,
    source_type: sourceType,
    source_ref_id: body.source_ref_id ? String(body.source_ref_id) : null,
    extracted_json: body.extracted_json ?? null,
    normalized_json: body.normalized_json ?? null,
    confidence_score: body.confidence_score !== undefined ? Number(body.confidence_score) : null,
    note: body.note ? String(body.note) : null,
    created_by: session.user.id,
  })

  const created = await (db as any).projectRequirementSnapshot.findFirst({
    where: { customer_id: params.id, is_current: true },
    orderBy: [{ version_no: 'desc' }],
  })

  return NextResponse.json({ data: created }, { status: 201 })
}
