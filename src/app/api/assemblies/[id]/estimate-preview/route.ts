import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateEstimateV2, validateEstimateInputV2 } from '@/lib/estimate/engine-v2'
import { createCareActivitySafe } from '@/lib/customer-care'
import { buildAssemblyEstimateFacts, resolveTemplateIdsByCode } from '@/lib/estimate/assembly-facts'

type Ctx = { params: { id: string } }

function text(v: unknown) {
  return String(v || '').trim()
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assemblyId = String(ctx.params.id || '')
  const body = await req.json().catch(() => ({}))
  const prismaAny = db as any

  const assembly = await prismaAny.projectAssembly.findUnique({
    where: { id: assemblyId },
    include: {
      blocks: {
        where: { is_active: true },
        orderBy: [{ level_index: 'asc' }, { sort_order: 'asc' }, { created_at: 'asc' }],
        include: { template: true },
      },
    },
  })
  if (!assembly) return NextResponse.json({ error: 'Assembly not found' }, { status: 404 })
  const presetTaxonomies = await prismaAny.estimationTaxonomy.findMany({
    where: {
      is_active: true,
      kind: { in: ['opening_preset', 'roof_preset', 'stair_preset', 'interior_preset', 'assembly_template_bundle_map'] },
    },
    select: { kind: true, value: true, name: true, description: true, is_active: true, sort_order: true },
  })
  const templateRows = await prismaAny.estimationTemplateHeader.findMany({
    where: { is_active: true },
    select: { id: true, template_code: true, version: true, is_active: true },
  })
  const templateIdsByCode = resolveTemplateIdsByCode(templateRows)
  const sharedFacts = buildAssemblyEstimateFacts({
    assembly,
    presetTaxonomies,
    bundleTaxonomies: presetTaxonomies,
    templateIdsByCode,
  })
  const forcedTemplateIds = Array.from(
    new Set([
      ...sharedFacts.forced_template_ids_from_blocks,
      ...sharedFacts.forced_template_ids_from_bundles,
    ])
  )

  const input: any = {
    customer_id: assembly.customer_id || null,
    region_code: body?.region_code || assembly.region_code || 'ALL',
    quote_date: body?.quote_date || null,
    build_length_m: body?.build_length_m ?? sharedFacts.inferred_input.build_length_m,
    build_width_m: body?.build_width_m ?? sharedFacts.inferred_input.build_width_m,
    floor_height_m: body?.floor_height_m ?? sharedFacts.inferred_input.floor_height_m,
    floor_area_total: body?.floor_area_total ?? sharedFacts.inferred_input.floor_area_total,
    floors: body?.floors ?? sharedFacts.inferred_input.floors,
    tum_count: body?.tum_count ?? sharedFacts.inferred_input.tum_count,
    finish_level: body?.finish_level || assembly.level || 'tieu_chuan',
    house_type: body?.house_type || assembly.house_type || null,
    style: body?.style || assembly.style || null,
    foundation_type: body?.foundation_type || sharedFacts.inferred_input.foundation_type,
    bedroom_count: body?.bedroom_count ?? sharedFacts.inferred_input.bedroom_count,
    wc_count: body?.wc_count ?? sharedFacts.inferred_input.wc_count,
    kitchen_count: body?.kitchen_count ?? sharedFacts.inferred_input.kitchen_count,
    living_room_count: body?.living_room_count ?? sharedFacts.inferred_input.living_room_count,
    base_cost_per_m2: body?.base_cost_per_m2 ?? null,
    pricing_policy: body?.pricing_policy || 'standard',
    preferred_supplier_key: body?.preferred_supplier_key || null,
    supplier_match_mode: body?.supplier_match_mode || 'preferred_first',
    template_apply_mode: body?.template_apply_mode || 'auto',
    context_profile_key: body?.context_profile_key || null,
    extra_facts_json: sharedFacts.extra_facts,
    created_by: session.user.id,
  }

  const validation = validateEstimateInputV2(input)
  if (!validation.ok) {
    return NextResponse.json(
      {
        error: 'Assembly chua du du lieu de tinh preview',
        missing_fields: validation.missing_fields,
        suggested_inputs: validation.suggested_inputs,
        details: validation.details || [],
        inferred_input: input,
      },
      { status: 400 }
    )
  }

  try {
    const data = await generateEstimateV2(input, {
      mode: 'preview',
      forced_template_ids: forcedTemplateIds,
    })
    const shouldCreateNextAction = Boolean(body?.create_next_action_from_preview)
    if (shouldCreateNextAction && assembly.customer_id) {
      const explicitRefId = text(body?.preview_ref_id)
      const generatedRefId = data?.id ? String(data.id) : ''
      const refId = explicitRefId || generatedRefId || assembly.id
      const defaultText = `Gui du toan block vua tao cho khach (ref: ${refId})`
      const actionText = text(body?.next_action_text) || defaultText
      await createCareActivitySafe({
        customer_id: String(assembly.customer_id),
        activity_type: 'next_action_update',
        summary: 'Can gui du toan theo block cho khach',
        detail: actionText,
        next_action_snapshot: actionText,
        source_ref_type: 'assembly_estimate_preview',
        source_ref_id: refId,
        channel: body?.next_action_channel ? String(body.next_action_channel) : 'other',
        pipeline_phase: 'construction_pre_sale',
        created_by: session.user.id,
        due_at: body?.next_action_due_at ? new Date(body.next_action_due_at) : null,
        metadata_json: {
          source: '/api/assemblies/[id]/estimate-preview',
          assembly_id: assembly.id,
          assembly_name: assembly.name,
          preview_ref_id: refId,
          generated_estimate_id: data?.id ? String(data.id) : null,
        },
      })
      await db.customer.update({
        where: { id: String(assembly.customer_id) },
        data: { next_action: actionText },
      })
    }
    return NextResponse.json({
      data,
      inferred_input: input,
      assembly_summary: sharedFacts.assembly_summary,
    }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Khong the tinh preview tu assembly' }, { status: 400 })
  }
}
