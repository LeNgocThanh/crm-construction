import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string; rosterId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const existed = await db.projectLaborRoster.findUnique({ where: { id: params.rosterId } })
  if (!existed || existed.project_id !== params.id) return NextResponse.json({ error: 'Khong tim thay roster' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const nextWorkerId = body?.worker_id !== undefined ? (String(body.worker_id || '').trim() || null) : undefined
  if (nextWorkerId) {
    const taken = await db.projectLaborRoster.findFirst({
      where: {
        is_active: true,
        project_id: params.id,
        worker_id: nextWorkerId,
        id: { not: params.rosterId },
      },
      select: { id: true, project_id: true },
    })
    if (taken) {
      return NextResponse.json({ error: 'Nhan cong da duoc chon trong du an nay' }, { status: 409 })
    }
  }
  const data = await db.projectLaborRoster.update({
    where: { id: params.rosterId },
    data: {
      worker_id: nextWorkerId,
      crew_id: body?.crew_id !== undefined ? (String(body.crew_id || '').trim() || null) : undefined,
      trade_id: body?.trade_id !== undefined ? (String(body.trade_id || '').trim() || null) : undefined,
      is_primary: body?.is_primary !== undefined ? Boolean(body.is_primary) : undefined,
      is_active: body?.is_active !== undefined ? Boolean(body.is_active) : undefined,
      sort_order: body?.sort_order !== undefined ? Number(body.sort_order || 0) : undefined,
      note: body?.note !== undefined ? (body.note ? String(body.note) : null) : undefined,
    },
    include: {
      worker: { select: { id: true, worker_code: true, full_name: true, phone: true } },
      crew: { select: { id: true, crew_key: true, crew_name: true } },
      trade: { select: { id: true, trade_key: true, trade_name: true, unit_text: true } },
      creator: { select: { id: true, username: true } },
    },
  })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string; rosterId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session
  const existed = await db.projectLaborRoster.findUnique({ where: { id: params.rosterId } })
  if (!existed || existed.project_id !== params.id) return NextResponse.json({ error: 'Khong tim thay roster' }, { status: 404 })
  await db.projectLaborRoster.update({ where: { id: params.rosterId }, data: { is_active: false } })
  return NextResponse.json({ ok: true })
}
