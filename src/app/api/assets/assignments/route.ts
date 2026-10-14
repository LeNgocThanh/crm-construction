import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.assetsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const status = String(sp.get('status') || '').trim()
  const assignedTo = String(sp.get('assigned_to_user_id') || '').trim()
  const assetId = String(sp.get('asset_id') || '').trim()
  const customerId = String(sp.get('customer_id') || '').trim()
  const projectId = String(sp.get('project_id') || '').trim()

  const where: any = {}
  if (status) where.status = status
  if (assignedTo) where.assigned_to_user_id = assignedTo
  if (assetId) where.asset_id = assetId
  if (customerId) where.customer_id = customerId
  if (projectId) where.project_id = projectId

  const rows = await db.assetAssignment.findMany({
    where,
    orderBy: [{ assigned_at: 'desc' }],
    include: {
      asset: { select: { id: true, asset_code: true, asset_name: true, asset_type: true, status: true } },
      assigned_user: { select: { id: true, username: true } },
      assigner: { select: { id: true, username: true } },
      customer: { select: { id: true, full_name: true, phone_number: true } },
      project: { select: { id: true, project_name: true } },
    },
  })

  return NextResponse.json({ data: rows })
}
