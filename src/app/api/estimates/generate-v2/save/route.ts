import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateEstimateV2, validateEstimateInputV2 } from '@/lib/estimate/engine-v2'
import { createRequirementSnapshotSafe } from '@/lib/project-requirement-snapshots'

function toNumberOrNull(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function clampPercent(v: unknown) {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  if (n < 0) return 0
  if (n > 100) return 100
  return n
}

function deriveTumArea(footprintArea: number, body: any) {
  const mode = String(body?.tum_area_mode || '').trim().toLowerCase()
  const tumAreaM2 = Number(body?.tum_area_m2)
  const tumAreaPercent = clampPercent(body?.tum_area_percent)

  if (mode === 'm2' && Number.isFinite(tumAreaM2) && tumAreaM2 > 0) {
    return Math.max(0, tumAreaM2)
  }
  if (mode === 'percent' && tumAreaPercent != null) {
    return Math.max(0, footprintArea * (tumAreaPercent / 100))
  }
  if (Number.isFinite(tumAreaM2) && tumAreaM2 > 0) {
    return Math.max(0, tumAreaM2)
  }
  if (tumAreaPercent != null) {
    return Math.max(0, footprintArea * (tumAreaPercent / 100))
  }
  return 0
}

function buildRequirementNormalizedFromEstimateForm(body: any, floorAreaTotal: number) {
  const constructionAddress = body?.construction_address != null ? String(body.construction_address).trim() : ''
  return {
    region_code: body?.region_code || 'ALL',
    address: constructionAddress || null,
    construction_address: constructionAddress || null,
    build_length_m: toNumberOrNull(body?.build_length_m),
    build_width_m: toNumberOrNull(body?.build_width_m),
    floor_height_m: toNumberOrNull(body?.floor_height_m),
    stair_void_area: toNumberOrNull(body?.stair_void_area),
    wc_perimeter_m: toNumberOrNull(body?.wc_perimeter_m),
    floor_area_total: toNumberOrNull(floorAreaTotal),
    tum_area_mode: body?.tum_area_mode ? String(body.tum_area_mode) : null,
    tum_area_m2: toNumberOrNull(body?.tum_area_m2),
    tum_area_percent: toNumberOrNull(body?.tum_area_percent),
    floors: toNumberOrNull(body?.floors),
    tum_count: toNumberOrNull(body?.tum_count),
    basement_count: toNumberOrNull(body?.basement_count),
    has_elevator: Boolean(body?.has_elevator),
    finish_level: body?.finish_level || null,
    house_type: body?.house_type || null,
    style: body?.style || null,
    foundation_type: body?.foundation_type || null,
    bedroom_count: toNumberOrNull(body?.bedroom_count),
    wc_count: toNumberOrNull(body?.wc_count),
    kitchen_count: toNumberOrNull(body?.kitchen_count),
    living_room_count: toNumberOrNull(body?.living_room_count),
    base_cost_per_m2: toNumberOrNull(body?.base_cost_per_m2),
    pricing_policy: body?.pricing_policy || 'standard',
    extra_facts_json: body?.extra_facts_json && typeof body.extra_facts_json === 'object' ? body.extra_facts_json : null,
    source: 'estimate_generate_v2_save',
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body?.confirm_correct) {
    return NextResponse.json(
      { error: 'Can confirm_correct=true de luu ban du toan so bo da xac nhan' },
      { status: 400 }
    )
  }

  const length = Number(body.build_length_m)
  const width = Number(body.build_width_m)
  const floors = Number(body.floors)
  const footprintArea = Number.isFinite(length) && Number.isFinite(width) ? length * width : 0
  const derivedTumArea = deriveTumArea(footprintArea, body)
  const derivedFloorAreaTotal =
    footprintArea > 0 && Number.isFinite(floors) && floors > 0
      ? footprintArea * floors + derivedTumArea
      : Number(body.floor_area_total || 0)

  const input = {
    customer_id: body.customer_id || null,
    region_code: body.region_code || 'ALL',
    quote_date: body.quote_date || null,
    build_length_m: body.build_length_m,
    build_width_m: body.build_width_m,
    floor_height_m: body.floor_height_m,
    stair_void_area: body.stair_void_area,
    wc_perimeter_m: body.wc_perimeter_m,
    tum_area_mode: body.tum_area_mode || null,
    tum_area_m2: body.tum_area_m2,
    tum_area_percent: body.tum_area_percent,
    floor_area_total: derivedFloorAreaTotal,
    floors: body.floors,
    tum_count: body.tum_count,
    basement_count: body.basement_count,
    has_elevator: body.has_elevator,
    finish_level: body.finish_level || 'tieu_chuan',
    house_type: body.house_type || null,
    style: body.style || null,
    foundation_type: body.foundation_type || null,
    bedroom_count: body.bedroom_count,
    wc_count: body.wc_count,
    kitchen_count: body.kitchen_count,
    living_room_count: body.living_room_count,
    base_cost_per_m2: body.base_cost_per_m2,
    pricing_policy: body.pricing_policy || 'standard',
    extra_facts_json: body.extra_facts_json && typeof body.extra_facts_json === 'object' ? body.extra_facts_json : null,
    preferred_supplier_key: body.preferred_supplier_key || null,
    supplier_match_mode: body.supplier_match_mode || 'preferred_first',
    template_apply_mode: body.template_apply_mode || 'auto',
    context_profile_key: body.context_profile_key || null,
    geo_factor: body.geo_factor,
    labor_factor: body.labor_factor,
    transport_factor: body.transport_factor,
    difficulty_factor: body.difficulty_factor,
    market_factor: body.market_factor,
    created_by: session.user.id,
  }

  const validation = validateEstimateInputV2(input)
  if (!validation.ok) {
    return NextResponse.json(
      {
        error: 'Chua du du lieu de luu du toan so bo',
        missing_fields: validation.missing_fields,
        suggested_inputs: validation.suggested_inputs,
        details: validation.details || [],
      },
      { status: 400 }
    )
  }

  try {
    const data = await generateEstimateV2(input, {
      mode: 'save',
      mark_as_standard: Boolean(body?.mark_as_standard),
      template_state: body?.template_state || null,
    })

    if (body?.customer_id && body?.update_customer_snapshot_from_form) {
      await createRequirementSnapshotSafe({
        customer_id: String(body.customer_id),
        source_type: 'manual',
        source_ref_id: String(data?.id || body.customer_id),
        extracted_json: null,
        normalized_json: buildRequirementNormalizedFromEstimateForm(body, derivedFloorAreaTotal),
        note: 'Cap nhat tu form /estimates/generate-v2 (save)',
        created_by: session.user.id,
      })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Khong the luu du toan so bo' }, { status: 400 })
  }
}
