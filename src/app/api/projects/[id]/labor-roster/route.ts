import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const rows = await db.projectLaborRoster.findMany({
    where: { project_id: params.id, is_active: true },
    include: {
      worker: { select: { id: true, worker_code: true, full_name: true, phone: true } },
      crew: { select: { id: true, crew_key: true, crew_name: true } },
      trade: { select: { id: true, trade_key: true, trade_name: true, unit_text: true } },
      creator: { select: { id: true, username: true } },
    },
    orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }, { created_at: 'asc' }],
  })
  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const body = await req.json().catch(() => ({}))
  const workerIds = Array.isArray(body?.worker_ids)
    ? body.worker_ids.map((x: any) => String(x || '').trim()).filter(Boolean)
    : (body?.worker_id ? [String(body.worker_id).trim()] : [])
  const crewId = String(body?.crew_id || '').trim() || null
  const tradeId = String(body?.trade_id || '').trim() || null
  const note = String(body?.note || '').trim() || null
  const sortOrder = Number(body?.sort_order || 0)
  const isPrimary = Boolean(body?.is_primary)
  const isActive = body?.is_active !== false

  if (!workerIds.length && !crewId && !tradeId) {
    return NextResponse.json({ error: 'Thieu nhan cong hoac doi hoac nghe' }, { status: 400 })
  }

  const workers = workerIds.length
    ? await db.laborWorker.findMany({
        where: { id: { in: workerIds } },
        select: { id: true, worker_code: true, full_name: true, trade_id: true, crew_id: true },
      })
    : []
  if (workerIds.length && workers.length !== workerIds.length) {
    return NextResponse.json({ error: 'Co nhan cong khong ton tai' }, { status: 404 })
  }

  const taken = workerIds.length
    ? await db.projectLaborRoster.findMany({
        where: { is_active: true, project_id: params.id, worker_id: { in: workerIds } },
        select: { worker_id: true, project_id: true },
      })
    : []
  if (taken.length) {
    return NextResponse.json({ error: 'Co nhan cong da duoc chon trong du an nay' }, { status: 409 })
  }

  const created = await db.$transaction(
    workers.map((worker, index) =>
      db.projectLaborRoster.create({
        data: {
          project_id: params.id,
          worker_id: worker.id,
          crew_id: crewId || worker.crew_id || null,
          trade_id: tradeId || worker.trade_id || null,
          is_primary: isPrimary && index === 0,
          is_active: isActive,
          sort_order: Number.isFinite(sortOrder) ? sortOrder + index : index,
          note,
          created_by: session.user.id,
        },
        include: {
          worker: { select: { id: true, worker_code: true, full_name: true, phone: true } },
          crew: { select: { id: true, crew_key: true, crew_name: true } },
          trade: { select: { id: true, trade_key: true, trade_name: true, unit_text: true } },
          creator: { select: { id: true, username: true } },
        },
      }),
    ),
  )

  return NextResponse.json({ data: workerIds.length > 1 ? created : created[0] }, { status: 201 })
}
