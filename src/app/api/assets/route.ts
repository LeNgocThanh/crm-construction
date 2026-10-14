import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import {
  ASSET_ACQUISITION_METHOD_LABELS,
  ASSET_CONDITION_LABELS,
  ASSET_STATUS_LABELS,
  ASSET_TYPE_LABELS,
  viLabelFromMap,
} from '@/lib/assets/dictionaries'

function toNumber(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function normalizeAccessories(value: any): string[] {
  if (Array.isArray(value)) {
    return value
      .map((x) => String(x || '').trim())
      .filter(Boolean)
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
  const lastEvent = Array.isArray(a.lifecycle_events) && a.lifecycle_events.length ? a.lifecycle_events[0] : null
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
    status_label: viLabelFromMap(ASSET_STATUS_LABELS, a.status),
    condition_status_label: viLabelFromMap(ASSET_CONDITION_LABELS, a.condition_status),
    asset_type_label: viLabelFromMap(ASSET_TYPE_LABELS, a.asset_type),
    acquisition_method_label: viLabelFromMap(ASSET_ACQUISITION_METHOD_LABELS, a.acquisition_method, '-'),
    last_action: lastEvent
      ? {
        id: lastEvent.id,
        event_key: lastEvent.event_key,
        title: lastEvent.title,
        happened_at: lastEvent.happened_at,
      }
      : null,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.assetsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const q = String(sp.get('q') || '').trim()
  const status = String(sp.get('status') || '').trim()
  const assetType = String(sp.get('asset_type') || '').trim()
  const isActiveRaw = sp.get('is_active')
  const isActive = isActiveRaw == null ? undefined : isActiveRaw === 'true'

  const where: any = {}
  if (q) {
    where.OR = [
      { asset_code: { contains: q, mode: 'insensitive' } },
      { asset_name: { contains: q, mode: 'insensitive' } },
      { serial_no: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (status) where.status = status
  if (assetType) where.asset_type = assetType
  if (typeof isActive === 'boolean') where.is_active = isActive

  const rows = await db.asset.findMany({
    where,
    orderBy: [{ updated_at: 'desc' }],
    include: {
      asset_type_ref: { select: { id: true, type_key: true, type_name: true, default_unit_id: true } },
      unit_ref: { select: { id: true, unit_key: true, unit_name: true, symbol: true } },
      current_holder: { select: { id: true, username: true } },
      current_customer: { select: { id: true, full_name: true, phone_number: true } },
      current_project: { select: { id: true, project_name: true } },
      lifecycle_events: {
        select: { id: true, event_key: true, title: true, happened_at: true },
        orderBy: [{ happened_at: 'desc' }],
        take: 1,
      },
    },
  })

  return NextResponse.json({ data: rows.map(serAsset) })
}

export async function POST(req: NextRequest) {
  const access = await requirePermission(PERMISSIONS.assetsManage)
  if (access.error) return access.error
  const session: any = access.ctx!.session

  const body = await req.json()
  const assetCode = String(body?.asset_code || '').trim()
  const assetName = String(body?.asset_name || '').trim()
  if (!assetCode || !assetName) {
    return NextResponse.json({ error: 'Thieu asset_code hoac asset_name' }, { status: 400 })
  }

  const purchaseCost = toNumber(body?.purchase_cost)
  const salvageValue = toNumber(body?.salvage_value)
  const assetTypeId = body?.asset_type_id ? String(body.asset_type_id) : null
  let resolvedUnitId = body?.unit_id ? String(body.unit_id) : null
  if (!resolvedUnitId && assetTypeId) {
    const t = await db.assetType.findUnique({ where: { id: assetTypeId }, select: { default_unit_id: true } })
    if (t?.default_unit_id) resolvedUnitId = t.default_unit_id
  }

  const created = await db.$transaction(async (tx) => {
    const row = await tx.asset.create({
      data: {
      asset_code: assetCode,
      asset_name: assetName,
      category: body?.category ? String(body.category) : null,
      asset_type_id: assetTypeId,
      asset_type: body?.asset_type ? String(body.asset_type) : 'equipment',
      unit_id: resolvedUnitId,
      unit_text: body?.unit_text ? String(body.unit_text) : null,
      serial_no: body?.serial_no ? String(body.serial_no) : null,
      brand: body?.brand ? String(body.brand) : null,
      model: body?.model ? String(body.model) : null,
      manufacturer: body?.manufacturer ? String(body.manufacturer) : null,
      origin_country: body?.origin_country ? String(body.origin_country) : null,
      purchase_date: body?.purchase_date ? new Date(body.purchase_date) : null,
      purchase_cost: purchaseCost != null ? BigInt(Math.round(purchaseCost)) : null,
      acquisition_method: body?.acquisition_method ? String(body.acquisition_method) : null,
      acquisition_note: body?.acquisition_note ? String(body.acquisition_note) : null,
      co_number: body?.co_number ? String(body.co_number) : null,
      cq_number: body?.cq_number ? String(body.cq_number) : null,
      doc_urls_json: body?.doc_urls_json ?? null,
      warranty_months: body?.warranty_months != null ? Number(body.warranty_months) : null,
      warranty_start_date: body?.warranty_start_date ? new Date(body.warranty_start_date) : null,
      warranty_end_date: body?.warranty_end_date ? new Date(body.warranty_end_date) : null,
      warranty_provider: body?.warranty_provider ? String(body.warranty_provider) : null,
      warranty_terms: body?.warranty_terms ? String(body.warranty_terms) : null,
      depreciation_method: body?.depreciation_method ? String(body.depreciation_method) : null,
      depreciation_months: body?.depreciation_months != null ? Number(body.depreciation_months) : null,
      depreciation_start_date: body?.depreciation_start_date ? new Date(body.depreciation_start_date) : null,
      salvage_value: salvageValue != null ? BigInt(Math.round(salvageValue)) : null,
      commissioned_at: body?.commissioned_at ? new Date(body.commissioned_at) : null,
      retired_at: body?.retired_at ? new Date(body.retired_at) : null,
      status: body?.status ? String(body.status) : 'available',
      condition_status: body?.condition_status ? String(body.condition_status) : 'good',
      current_location: body?.current_location ? String(body.current_location) : null,
      notes: body?.notes ? String(body.notes) : null,
      metadata_json: body?.metadata_json ?? null,
      ...(body?.accessories_default !== undefined
        ? {
          metadata_json: {
            ...(body?.metadata_json && typeof body.metadata_json === 'object' ? body.metadata_json : {}),
            accessories_default: normalizeAccessories(body.accessories_default),
          },
        }
        : {}),
      is_active: body?.is_active === undefined ? true : Boolean(body.is_active),
      },
    })
    await tx.assetLifecycleEvent.create({
      data: {
        asset_id: row.id,
        event_key: 'created',
        title: 'Tạo tài sản',
        description: `Tạo mới tài sản ${row.asset_name} (${row.asset_code})`,
        actor_user_id: String(session.user.id || ''),
      },
    })
    return row
  })

  return NextResponse.json({ data: serAsset(created) }, { status: 201 })
}
