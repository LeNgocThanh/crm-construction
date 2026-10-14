import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateEstimateV2, validateEstimateInputV2 } from '@/lib/estimate/engine-v2'
import { createRequirementSnapshotSafe } from '@/lib/project-requirement-snapshots'
import { createCareActivitySafe } from '@/lib/customer-care'
import { db } from '@/lib/db'

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
    source: 'estimate_generate_v2_preview',
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sourceBody = await req.json()

  const length = Number(sourceBody.build_length_m)
  const width = Number(sourceBody.build_width_m)
  const floors = Number(sourceBody.floors)
  const footprintArea = Number.isFinite(length) && Number.isFinite(width) ? length * width : 0
  const derivedTumArea = deriveTumArea(footprintArea, sourceBody)
  const derivedFloorAreaTotal =
    footprintArea > 0 && Number.isFinite(floors) && floors > 0
      ? footprintArea * floors + derivedTumArea
      : Number(sourceBody.floor_area_total || 0)

  const input = {
    customer_id: sourceBody.customer_id || null,
    region_code: sourceBody.region_code || 'ALL',
    quote_date: sourceBody.quote_date || null,
    build_length_m: sourceBody.build_length_m,
    build_width_m: sourceBody.build_width_m,
    floor_height_m: sourceBody.floor_height_m,
    stair_void_area: sourceBody.stair_void_area,
    wc_perimeter_m: sourceBody.wc_perimeter_m,
    tum_area_mode: sourceBody.tum_area_mode || null,
    tum_area_m2: sourceBody.tum_area_m2,
    tum_area_percent: sourceBody.tum_area_percent,
    floor_area_total: derivedFloorAreaTotal,
    floors: sourceBody.floors,
    tum_count: sourceBody.tum_count,
    basement_count: sourceBody.basement_count,
    has_elevator: sourceBody.has_elevator,
    finish_level: sourceBody.finish_level || 'tieu_chuan',
    house_type: sourceBody.house_type || null,
    style: sourceBody.style || null,
    foundation_type: sourceBody.foundation_type || null,
    bedroom_count: sourceBody.bedroom_count,
    wc_count: sourceBody.wc_count,
    kitchen_count: sourceBody.kitchen_count,
    living_room_count: sourceBody.living_room_count,
    base_cost_per_m2: sourceBody.base_cost_per_m2,
    pricing_policy: sourceBody.pricing_policy || 'standard',
    extra_facts_json: sourceBody.extra_facts_json && typeof sourceBody.extra_facts_json === 'object' ? sourceBody.extra_facts_json : null,
    preferred_supplier_key: sourceBody.preferred_supplier_key || null,
    supplier_match_mode: sourceBody.supplier_match_mode || 'preferred_first',
    template_apply_mode: sourceBody.template_apply_mode || 'auto',
    context_profile_key: sourceBody.context_profile_key || null,
    geo_factor: sourceBody.geo_factor,
    labor_factor: sourceBody.labor_factor,
    transport_factor: sourceBody.transport_factor,
    difficulty_factor: sourceBody.difficulty_factor,
    market_factor: sourceBody.market_factor,
    created_by: session.user.id,
  }

  const validation = validateEstimateInputV2(input)
  if (!validation.ok) {
    return NextResponse.json(
      {
        error: 'Chua du du lieu de tao du toan so bo',
        missing_fields: validation.missing_fields,
        suggested_inputs: validation.suggested_inputs,
        details: validation.details || [],
      },
      { status: 400 }
    )
  }

  try {
    const data = await generateEstimateV2(input, { mode: 'preview' })

    const shouldCreateNextAction = Boolean(sourceBody?.create_next_action_from_preview)
    if (shouldCreateNextAction && input.customer_id) {
      const explicitRefId = String(sourceBody?.preview_ref_id || '').trim()
      const generatedRefId = data?.id ? String(data.id) : ''
      const refId = explicitRefId || generatedRefId || null
      const defaultText = refId
        ? `Gui du toan so bo vua tao cho khach (ref: ${refId})`
        : 'Gui du toan so bo vua tao cho khach'
      const actionText = String(sourceBody?.next_action_text || '').trim() || defaultText

      await createCareActivitySafe({
        customer_id: String(input.customer_id),
        activity_type: 'next_action_update',
        summary: 'Can gui du toan so bo cho khach',
        detail: actionText,
        next_action_snapshot: actionText,
        source_ref_type: 'estimate_preview',
        source_ref_id: refId,
        channel: sourceBody?.next_action_channel ? String(sourceBody.next_action_channel) : 'other',
        pipeline_phase: 'construction_pre_sale',
        created_by: session.user.id,
        due_at: sourceBody?.next_action_due_at ? new Date(sourceBody.next_action_due_at) : null,
        metadata_json: {
          action_origin: 'estimate_generate_v2_preview',
          source: '/api/estimates/generate-v2',
          generated_estimate_id: data?.id ? String(data.id) : null,
          preview_ref_id: refId,
        },
      })
      await db.customer.update({
        where: { id: String(input.customer_id) },
        data: { next_action: actionText },
      })
    }

    if (sourceBody?.customer_id && sourceBody?.update_customer_snapshot_from_form) {
      await createRequirementSnapshotSafe({
        customer_id: String(sourceBody.customer_id),
        source_type: 'manual',
        source_ref_id: String(data?.id || sourceBody.customer_id),
        extracted_json: null,
        normalized_json: buildRequirementNormalizedFromEstimateForm(sourceBody, derivedFloorAreaTotal),
        note: 'Cap nhat tu form /estimates/generate-v2 (preview)',
        created_by: session.user.id,
      })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Khong the tao du toan so bo' }, { status: 400 })
  }
}
