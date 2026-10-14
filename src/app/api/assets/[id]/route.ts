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

function normalizeAccessories(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map((x) => String(x || '').trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/g)
      .map((x) => x.trim())
      .filter(Boolean)
  }
  return []
}

function serAsset(a: any) {
  return {
    ...a,
    purchase_cost: a.purchase_cost != null ? Number(a.purchase_cost) : null,
    salvage_value: a.salvage_value != null ? Number(a.salvage_value) : null,
    asset_type_data: a.asset_type_ref
      ? { id: a.asset_type_ref.id, type_key: a.asset_type_ref.type_key, type_name: a.asset_type_ref.type_name }
      : null,
    unit: a.unit_ref
      ? { id: a.unit_ref.id, unit_key: a.unit_ref.unit_key, unit_name: a.unit_ref.unit_name, symbol: a.unit_ref.symbol }
      : null,
  }
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireResourceAccess({ resourceType: 'asset', action: 'read', resourceId: params.id })
  if (auth.error) return auth.error

  const row = await db.asset.findUnique({
    where: { id: params.id },
    include: {
      asset_type_ref: { select: { id: true, type_key: true, type_name: true, default_unit_id: true } },
      unit_ref: { select: { id: true, unit_key: true, unit_name: true, symbol: true } },
      current_holder: { select: { id: true, username: true } },
      current_customer: { select: { id: true, full_name: true, phone_number: true } },
      current_project: { select: { id: true, project_name: true } },
    },
  })
  if (!row) return NextResponse.json({ error: 'Khong tim thay asset' }, { status: 404 })
  return NextResponse.json({ data: serAsset(row) })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requirePermission(PERMISSIONS.assetsManage)
  if (access.error) return access.error
  const scopedAccess = await requireResourceAccess({ resourceType: 'asset', action: 'write', resourceId: params.id })
  if (scopedAccess.error) return scopedAccess.error
  const session: any = access.ctx!.session

  const body = await req.json()
  const current = await db.asset.findUnique({
    where: { id: params.id },
    select: { metadata_json: true },
  })
  if (!current) return NextResponse.json({ error: 'Khong tim thay asset' }, { status: 404 })
  const patch: any = {
    ...(body?.asset_code !== undefined ? { asset_code: String(body.asset_code || '').trim() } : {}),
    ...(body?.asset_name !== undefined ? { asset_name: String(body.asset_name || '').trim() } : {}),
    ...(body?.category !== undefined ? { category: body.category ? String(body.category) : null } : {}),
    ...(body?.asset_type_id !== undefined ? { asset_type_id: body.asset_type_id ? String(body.asset_type_id) : null } : {}),
    ...(body?.asset_type !== undefined ? { asset_type: body.asset_type ? String(body.asset_type) : 'equipment' } : {}),
    ...(body?.unit_id !== undefined ? { unit_id: body.unit_id ? String(body.unit_id) : null } : {}),
    ...(body?.unit_text !== undefined ? { unit_text: body.unit_text ? String(body.unit_text) : null } : {}),
    ...(body?.serial_no !== undefined ? { serial_no: body.serial_no ? String(body.serial_no) : null } : {}),
    ...(body?.brand !== undefined ? { brand: body.brand ? String(body.brand) : null } : {}),
    ...(body?.model !== undefined ? { model: body.model ? String(body.model) : null } : {}),
    ...(body?.manufacturer !== undefined ? { manufacturer: body.manufacturer ? String(body.manufacturer) : null } : {}),
    ...(body?.origin_country !== undefined ? { origin_country: body.origin_country ? String(body.origin_country) : null } : {}),
    ...(body?.purchase_date !== undefined ? { purchase_date: body.purchase_date ? new Date(body.purchase_date) : null } : {}),
    ...(body?.acquisition_method !== undefined ? { acquisition_method: body.acquisition_method ? String(body.acquisition_method) : null } : {}),
    ...(body?.acquisition_note !== undefined ? { acquisition_note: body.acquisition_note ? String(body.acquisition_note) : null } : {}),
    ...(body?.co_number !== undefined ? { co_number: body.co_number ? String(body.co_number) : null } : {}),
    ...(body?.cq_number !== undefined ? { cq_number: body.cq_number ? String(body.cq_number) : null } : {}),
    ...(body?.doc_urls_json !== undefined ? { doc_urls_json: body.doc_urls_json ?? null } : {}),
    ...(body?.warranty_months !== undefined ? { warranty_months: body.warranty_months != null ? Number(body.warranty_months) : null } : {}),
    ...(body?.warranty_start_date !== undefined ? { warranty_start_date: body.warranty_start_date ? new Date(body.warranty_start_date) : null } : {}),
    ...(body?.warranty_end_date !== undefined ? { warranty_end_date: body.warranty_end_date ? new Date(body.warranty_end_date) : null } : {}),
    ...(body?.warranty_provider !== undefined ? { warranty_provider: body.warranty_provider ? String(body.warranty_provider) : null } : {}),
    ...(body?.warranty_terms !== undefined ? { warranty_terms: body.warranty_terms ? String(body.warranty_terms) : null } : {}),
    ...(body?.depreciation_method !== undefined ? { depreciation_method: body.depreciation_method ? String(body.depreciation_method) : null } : {}),
    ...(body?.depreciation_months !== undefined ? { depreciation_months: body.depreciation_months != null ? Number(body.depreciation_months) : null } : {}),
    ...(body?.depreciation_start_date !== undefined ? { depreciation_start_date: body.depreciation_start_date ? new Date(body.depreciation_start_date) : null } : {}),
    ...(body?.commissioned_at !== undefined ? { commissioned_at: body.commissioned_at ? new Date(body.commissioned_at) : null } : {}),
    ...(body?.retired_at !== undefined ? { retired_at: body.retired_at ? new Date(body.retired_at) : null } : {}),
    ...(body?.status !== undefined ? { status: body.status ? String(body.status) : 'available' } : {}),
    ...(body?.condition_status !== undefined ? { condition_status: body.condition_status ? String(body.condition_status) : 'good' } : {}),
    ...(body?.current_location !== undefined ? { current_location: body.current_location ? String(body.current_location) : null } : {}),
    ...(body?.notes !== undefined ? { notes: body.notes ? String(body.notes) : null } : {}),
    ...(body?.metadata_json !== undefined ? { metadata_json: body.metadata_json ?? null } : {}),
    ...(body?.is_active !== undefined ? { is_active: Boolean(body.is_active) } : {}),
  }
  if (body?.purchase_cost !== undefined) {
    const n = toNumber(body.purchase_cost)
    patch.purchase_cost = n == null ? null : BigInt(Math.round(n))
  }
  if (body?.salvage_value !== undefined) {
    const n = toNumber(body.salvage_value)
    patch.salvage_value = n == null ? null : BigInt(Math.round(n))
  }
  if (body?.accessories_default !== undefined) {
    const base = current?.metadata_json && typeof current.metadata_json === 'object' ? current.metadata_json as Record<string, any> : {}
    patch.metadata_json = {
      ...base,
      ...(patch.metadata_json && typeof patch.metadata_json === 'object' ? patch.metadata_json : {}),
      accessories_default: normalizeAccessories(body.accessories_default),
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.asset.update({ where: { id: params.id }, data: patch })
    await tx.assetLifecycleEvent.create({
      data: {
        asset_id: row.id,
        event_key: 'updated',
        title: 'Cập nhật hồ sơ tài sản',
        actor_user_id: String(session.user.id || ''),
      },
    })
    return row
  })
  return NextResponse.json({ data: serAsset(updated) })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const access = await requirePermission(PERMISSIONS.assetsManage)
  if (access.error) return access.error
  const scopedAccess = await requireResourceAccess({ resourceType: 'asset', action: 'delete', resourceId: params.id })
  if (scopedAccess.error) return scopedAccess.error

  const openAssignment = await db.assetAssignment.findFirst({
    where: { asset_id: params.id, status: { in: ['assigned', 'overdue'] } },
  })
  if (openAssignment) {
    return NextResponse.json({ error: 'Asset dang duoc gan, khong the xoa' }, { status: 400 })
  }

  await db.asset.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
