import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, requireManageRole, normalizeKey, parseOptionalBigInt, parseOptionalInt, parseOptionalString } from '@/lib/labor/server'

function serialize(row: any) {
  return {
    ...row,
    default_rate: row.default_rate != null ? String(row.default_rate) : null,
    skill_level: row.skill_level
      ? {
          ...row.skill_level,
          default_rate: row.skill_level.default_rate != null ? String(row.skill_level.default_rate) : null,
        }
      : null,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = String(sp.get('active_only') || 'false') === 'true'
  const q = String(sp.get('q') || '').trim()
  const excludeRostered = String(sp.get('exclude_rostered') || 'false') === 'true'
  const workerCategory = String(sp.get('worker_category') || '').trim()
  const skillLevelId = String(sp.get('skill_level_id') || '').trim()
  const where: any = {}
  if (activeOnly) where.is_active = true
  if (workerCategory) where.worker_category = workerCategory
  if (skillLevelId) where.skill_level_id = skillLevelId
  if (q) {
    where.OR = [
      { worker_code: { contains: q, mode: 'insensitive' } },
      { full_name: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
      { home_area: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (excludeRostered) {
    const rostered = await db.projectLaborRoster.findMany({
      where: { is_active: true, worker_id: { not: null } },
      select: { worker_id: true },
    })
    const taken = rostered.map((x) => x.worker_id).filter(Boolean) as string[]
    if (taken.length) where.id = { notIn: taken }
  }
  const data = await db.laborWorker.findMany({
    where,
    include: {
      trade: { select: { id: true, trade_key: true, trade_name: true } },
      crew: { select: { id: true, crew_key: true, crew_name: true } },
      skill_level: { select: { id: true, skill_key: true, skill_name: true, default_rate: true } },
    },
    orderBy: [{ updated_at: 'desc' }],
  })
  return NextResponse.json({ data: data.map(serialize) })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr

  const body = await req.json()
  const workerCode = normalizeKey(body?.worker_code)
  const fullName = String(body?.full_name || '').trim()
  if (!workerCode || !fullName) return NextResponse.json({ error: 'Thieu worker_code hoac full_name' }, { status: 400 })
  if (!/^[a-z0-9_]+$/.test(workerCode)) return NextResponse.json({ error: 'worker_code chi gom a-z, 0-9, _' }, { status: 400 })

  const data = await db.laborWorker.create({
    data: {
      worker_code: workerCode,
      full_name: fullName,
      phone: parseOptionalString(body?.phone),
      trade_id: parseOptionalString(body?.trade_id),
      crew_id: parseOptionalString(body?.crew_id),
      skill_level_id: parseOptionalString(body?.skill_level_id),
      worker_category: parseOptionalString(body?.worker_category),
      employment_mode: parseOptionalString(body?.employment_mode),
      default_unit_text: parseOptionalString(body?.default_unit_text),
      default_rate: parseOptionalBigInt(body?.default_rate),
      home_area: parseOptionalString(body?.home_area),
      status: parseOptionalString(body?.status) || 'active',
      notes: parseOptionalString(body?.notes),
      created_by: auth.session.user.id,
    },
    include: {
      trade: { select: { id: true, trade_key: true, trade_name: true } },
      crew: { select: { id: true, crew_key: true, crew_name: true } },
      skill_level: { select: { id: true, skill_key: true, skill_name: true, default_rate: true } },
    },
  })
  return NextResponse.json({ data: serialize(data) }, { status: 201 })
}
