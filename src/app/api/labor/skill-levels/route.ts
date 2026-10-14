import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, requireManageRole, normalizeKey, parseOptionalBigInt, parseOptionalInt, parseOptionalString } from '@/lib/labor/server'

function serialize(row: any) {
  return {
    ...row,
    default_rate: row.default_rate != null ? String(row.default_rate) : null,
  }
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
      { skill_key: { contains: q, mode: 'insensitive' } },
      { skill_name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ]
  }

  const data = await db.laborSkillLevel.findMany({
    where,
    orderBy: [{ sort_order: 'asc' }, { skill_name: 'asc' }],
  })
  return NextResponse.json({ data: data.map(serialize) })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error
  const roleErr = requireManageRole(auth)
  if (roleErr) return roleErr

  const body = await req.json()
  const skillKey = normalizeKey(body?.skill_key)
  const skillName = String(body?.skill_name || '').trim()
  if (!skillKey || !skillName) return NextResponse.json({ error: 'Thieu skill_key hoac skill_name' }, { status: 400 })
  if (!/^[a-z0-9_]+$/.test(skillKey)) return NextResponse.json({ error: 'skill_key chi gom a-z, 0-9, _' }, { status: 400 })

  const data = await db.laborSkillLevel.create({
    data: {
      skill_key: skillKey,
      skill_name: skillName,
      default_rate: parseOptionalBigInt(body?.default_rate),
      description: parseOptionalString(body?.description),
      sort_order: parseOptionalInt(body?.sort_order) ?? 0,
      is_active: body?.is_active === undefined ? true : Boolean(body.is_active),
      created_by: auth.session.user.id,
    },
  })
  return NextResponse.json({ data: serialize(data) }, { status: 201 })
}
