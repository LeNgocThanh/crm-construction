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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const data: any = {}

  if (body.level !== undefined) {
    const level = normalizeLevel(body.level)
    if (!level) return NextResponse.json({ error: 'level phai la province hoac ward' }, { status: 400 })
    data.level = level
  }
  if (body.code !== undefined) data.code = String(body.code || '').trim()
  if (body.name !== undefined) data.name = String(body.name || '').trim()
  if (body.parent_code !== undefined) data.parent_code = toNullableStr(body.parent_code)
  if (body.source !== undefined) data.source = toNullableStr(body.source) || 'manual'
  if (body.source_version !== undefined) data.source_version = toNullableStr(body.source_version)
  if (body.latitude !== undefined) data.latitude = toNullableNumber(body.latitude)
  if (body.longitude !== undefined) data.longitude = toNullableNumber(body.longitude)
  if (body.meta_json !== undefined) data.meta_json = body.meta_json
  if (body.is_active !== undefined) data.is_active = Boolean(body.is_active)
  if (body.sort_order !== undefined) data.sort_order = Number(body.sort_order) || 0

  const updated = await (db as any).geoRegion.update({
    where: { id: params.id },
    data,
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  await (db as any).geoRegion.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
