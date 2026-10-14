import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function normalizeLevel(v: unknown): 'province' | 'ward' | null {
  const x = String(v || '').trim().toLowerCase()
  if (x === 'province' || x === 'ward') return x
  return null
}

function toNullableStr(v: unknown) {
  const x = String(v || '').trim()
  return x || null
}

function toNullableNumber(v: unknown) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = sp.get('active_only') !== 'false'
  const level = normalizeLevel(sp.get('level'))
  const parentCode = String(sp.get('parent_code') || '').trim()
  const q = String(sp.get('q') || '').trim()
  const limitRaw = Number(sp.get('limit') || '300')
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(2000, Math.trunc(limitRaw))) : 300

  const where: any = {}
  if (activeOnly) where.is_active = true
  if (level) where.level = level
  if (parentCode) where.parent_code = parentCode
  if (q) {
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
    ]
  }

  const data = await (db as any).geoRegion.findMany({
    where,
    orderBy: [{ level: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }],
    take: limit,
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const level = normalizeLevel(body.level)
  const code = String(body.code || '').trim()
  const name = String(body.name || '').trim()
  const parentCode = toNullableStr(body.parent_code)

  if (!level) return NextResponse.json({ error: 'level phai la province hoac ward' }, { status: 400 })
  if (!code || !name) return NextResponse.json({ error: 'Thieu code hoac name' }, { status: 400 })
  if (level === 'ward' && !parentCode) {
    return NextResponse.json({ error: 'Ward bat buoc co parent_code (ma tinh/thanh)' }, { status: 400 })
  }

  const created = await (db as any).geoRegion.create({
    data: {
      code,
      name,
      level,
      parent_code: level === 'province' ? null : parentCode,
      source: toNullableStr(body.source) || 'manual',
      source_version: toNullableStr(body.source_version),
      latitude: toNullableNumber(body.latitude),
      longitude: toNullableNumber(body.longitude),
      meta_json: body.meta_json ?? null,
      is_active: body.is_active !== false,
      sort_order: body.sort_order !== undefined ? Number(body.sort_order) || 0 : 0,
    },
  })

  return NextResponse.json({ data: created }, { status: 201 })
}
