import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

const VALID_STATUSES = new Set(['new', 'reviewed', 'approved', 'rejected', 'converted'])

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; snapshotId: string } }
) {
  const auth = await requirePermission(PERMISSIONS.customersWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const existing = await (db as any).projectRequirementSnapshot.findUnique({
    where: { id: params.snapshotId },
    select: { id: true, customer_id: true },
  })
  if (!existing || existing.customer_id !== params.id) {
    return NextResponse.json({ error: 'Khong tim thay requirement snapshot' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const data: any = {}

  if (body.status !== undefined) {
    const status = String(body.status || '').trim().toLowerCase()
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'status khong hop le' }, { status: 400 })
    }
    data.status = status
    if (status === 'approved') {
      data.approved_by = session.user.id
      data.approved_at = new Date()
    }
  }
  if (body.note !== undefined) data.note = body.note ? String(body.note) : null
  if (body.confidence_score !== undefined) data.confidence_score = body.confidence_score === null ? null : Number(body.confidence_score)
  if (body.extracted_json !== undefined) data.extracted_json = body.extracted_json ?? null
  if (body.normalized_json !== undefined) data.normalized_json = body.normalized_json ?? null
  if (body.converted_project_id !== undefined) data.converted_project_id = body.converted_project_id ? String(body.converted_project_id) : null

  const updated = await (db as any).projectRequirementSnapshot.update({
    where: { id: params.snapshotId },
    data,
  })

  return NextResponse.json({ data: updated })
}
