import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, requireManageRole, normalizeKey, parseOptionalInt, parseOptionalString } from '@/lib/labor/server'

function serialize(row: any) {
  return row
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = String(sp.get('active_only') || 'false') === 'true'
  const q = String(sp.get('q') || '').trim()
  const where: any = {}
  if (activeOnly) where.is_active = true
  if (q) {
    where.OR = [
      { crew_key: { contains: q, mode: 'insensitive' } },
      { crew_name: { contains: q, mode: 'insensitive' } },
      { leader_name: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
    ]
  }
  const data = await db.laborCrew.findMany({
    where,
    orderBy: [{ sort_order: 'asc' }, { crew_name: 'asc' }],
  })
  return NextResponse.json({ data: data.map(serialize) })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr

  const body = await req.json()
  const crewKey = normalizeKey(body?.crew_key)
  const crewName = String(body?.crew_name || '').trim()
  if (!crewKey || !crewName) return NextResponse.json({ error: 'Thieu crew_key hoac crew_name' }, { status: 400 })
  if (!/^[a-z0-9_]+$/.test(crewKey)) return NextResponse.json({ error: 'crew_key chi gom a-z, 0-9, _' }, { status: 400 })

  const data = await db.laborCrew.create({
    data: {
      crew_key: crewKey,
      crew_name: crewName,
      leader_name: parseOptionalString(body?.leader_name),
      phone: parseOptionalString(body?.phone),
      description: parseOptionalString(body?.description),
      sort_order: parseOptionalInt(body?.sort_order) ?? 0,
      is_active: body?.is_active === undefined ? true : Boolean(body.is_active),
      created_by: auth.session.user.id,
    },
  })
  return NextResponse.json({ data }, { status: 201 })
}
