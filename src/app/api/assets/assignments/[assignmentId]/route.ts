import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function PATCH(req: NextRequest, { params }: { params: { assignmentId: string } }) {
  const access = await requirePermission(PERMISSIONS.assetsManage)
  if (access.error) return access.error
  const session: any = access.ctx!.session

  const body = await req.json()
  const action = String(body?.action || '').trim()
  const row = await db.assetAssignment.findUnique({ where: { id: params.assignmentId } })
  if (!row) return NextResponse.json({ error: 'Khong tim thay assignment' }, { status: 404 })

  if (action === 'return') {
    const returnedAt = body?.returned_at ? new Date(body.returned_at) : new Date()
    const returnNote = body?.return_note ? String(body.return_note) : null

    const updated = await db.$transaction(async (tx) => {
      const a = await tx.assetAssignment.update({
        where: { id: row.id },
        data: {
          status: 'returned',
          returned_at: returnedAt,
          return_note: returnNote,
        },
      })
      const latestOpen = await tx.assetAssignment.findFirst({
        where: { asset_id: row.asset_id, id: { not: row.id }, status: { in: ['assigned', 'overdue'] } },
        orderBy: [{ assigned_at: 'desc' }],
      })
      if (latestOpen) {
        await tx.asset.update({
          where: { id: row.asset_id },
          data: {
            status: 'in_use',
            current_holder_user_id: latestOpen.assigned_to_user_id,
            current_customer_id: latestOpen.customer_id,
            current_project_id: latestOpen.project_id,
          },
        })
      } else {
        await tx.asset.update({
          where: { id: row.asset_id },
          data: {
            status: 'available',
            current_holder_user_id: null,
            current_customer_id: null,
            current_project_id: null,
          },
        })
      }
      await tx.assetLifecycleEvent.create({
        data: {
          asset_id: row.asset_id,
          event_key: 'returned',
          title: 'Thu hồi tài sản',
          description: returnNote || null,
          actor_user_id: String(session.user.id || ''),
        },
      })
      return a
    })
    return NextResponse.json({ data: updated })
  }

  if (action === 'cancel') {
    if (!String(body?.reason || '').trim()) {
      return NextResponse.json({ error: 'Cancel bat buoc reason' }, { status: 400 })
    }
    const updated = await db.$transaction(async (tx) => {
      const a = await tx.assetAssignment.update({
        where: { id: row.id },
        data: {
          status: 'cancelled',
          return_note: String(body.reason),
        },
      })
      await tx.assetLifecycleEvent.create({
        data: {
          asset_id: row.asset_id,
          event_key: 'updated',
          title: 'Hủy bàn giao tài sản',
          description: String(body.reason),
          actor_user_id: String(session.user.id || ''),
        },
      })
      return a
    })
    return NextResponse.json({ data: updated })
  }

  return NextResponse.json({ error: 'Action khong hop le' }, { status: 400 })
}
