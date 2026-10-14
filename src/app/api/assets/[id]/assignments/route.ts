import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireResourceAccess } from '@/lib/access-control'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

function toNumber(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireResourceAccess({ resourceType: 'asset', action: 'read', resourceId: params.id })
  if (auth.error) return auth.error

  const rows = await db.assetAssignment.findMany({
    where: { asset_id: params.id },
    orderBy: [{ assigned_at: 'desc' }],
    include: {
      assigned_user: { select: { id: true, username: true } },
      assigner: { select: { id: true, username: true } },
      customer: { select: { id: true, full_name: true, phone_number: true } },
      project: { select: { id: true, project_name: true } },
    },
  })
  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.assetsManage)
  if (auth.error) return auth.error
  const access = await requireResourceAccess({ resourceType: 'asset', action: 'assign', resourceId: params.id })
  if (access.error) return access.error
  const session: any = auth.ctx!.session

  const body = await req.json()
  const assignedToUserId = String(body?.assigned_to_user_id || '').trim()
  if (!assignedToUserId) {
    return NextResponse.json({ error: 'Thieu assigned_to_user_id' }, { status: 400 })
  }
  const asset = await db.asset.findUnique({ where: { id: params.id } })
  if (!asset) return NextResponse.json({ error: 'Khong tim thay asset' }, { status: 404 })
  if (!['available', 'in_use'].includes(String(asset.status || ''))) {
    return NextResponse.json({ error: 'Asset khong o trang thai cho phep de gan' }, { status: 400 })
  }

  const qty = toNumber(body?.quantity)
  const now = new Date()
  const assignment = await db.$transaction(async (tx) => {
    const row = await tx.assetAssignment.create({
      data: {
        asset_id: params.id,
        assigned_to_user_id: assignedToUserId,
        customer_id: body?.customer_id ? String(body.customer_id) : null,
        project_id: body?.project_id ? String(body.project_id) : null,
        assigned_by: String(session.user.id || ''),
        purpose: body?.purpose ? String(body.purpose) : null,
        quantity: qty && qty > 0 ? qty : 1,
        assigned_at: now,
        expected_return_at: body?.expected_return_at ? new Date(body.expected_return_at) : null,
        status: 'assigned',
        metadata_json: body?.metadata_json ?? null,
      },
    })

    await tx.asset.update({
      where: { id: params.id },
      data: {
        status: 'in_use',
        current_holder_user_id: assignedToUserId,
        current_customer_id: body?.customer_id ? String(body.customer_id) : null,
        current_project_id: body?.project_id ? String(body.project_id) : null,
      },
    })
    await tx.assetLifecycleEvent.create({
      data: {
        asset_id: params.id,
        event_key: 'assigned',
        title: 'Bàn giao tài sản',
        description: `Bàn giao cho user=${assignedToUserId}`,
        actor_user_id: String(session.user.id || ''),
        metadata_json: {
          customer_id: body?.customer_id ? String(body.customer_id) : null,
          project_id: body?.project_id ? String(body.project_id) : null,
          expected_return_at: body?.expected_return_at || null,
        },
      },
    })
    return row
  })

  return NextResponse.json({ data: assignment }, { status: 201 })
}
