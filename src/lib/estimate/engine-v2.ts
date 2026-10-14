import { db } from '@/lib/db'

export type EstimateV2Input = {
  customer_id?: string | null
  region_code?: string | null
  quote_date?: string | null
  build_length_m?: number | null
  build_width_m?: number | null
  floor_height_m?: number | null
  stair_void_area?: number | null
  wc_perimeter_m?: number | null
  tum_area_mode?: 'm2' | 'percent' | string | null
  tum_area_m2?: number | null
  tum_area_percent?: number | null
  floor_area_total?: number | null
  floors?: number | null
  tum_count?: number | null
  basement_count?: number | null
  has_elevator?: boolean | null
  finish_level?: 'co_ban' | 'tieu_chuan' | 'cao_cap' | string | null
  house_type?: string | null
  style?: string | null
  foundation_type?: string | null
  bedroom_count?: number | null
  wc_count?: number | null
  kitchen_count?: number | null
  living_room_count?: number | null
  base_cost_per_m2?: number | null
  pricing_policy?: 'lowest' | 'highest' | 'standard' | 'premium' | string | null
  preferred_supplier_key?: string | null
  supplier_match_mode?: 'preferred_first' | 'only_preferred' | 'ignore' | string | null
  template_apply_mode?: 'auto' | 'standard_template' | 'nearest_template' | 'none' | string | null
  context_profile_key?: string | null
  geo_factor?: number | null
  labor_factor?: number | null
  transport_factor?: number | null
  difficulty_factor?: number | null
  market_factor?: number | null
  extra_facts_json?: Record<string, any> | null
  created_by?: string | null
}

type EngineLineItem = {
  material_key: string
  material_name: string | null
  unit: string | null
  quantity: number | null
  unit_price: number | null
  ratio_percent: number | null
  cost: number
  price_source: string
  note: string | null
}

type PricingPolicy = 'lowest' | 'highest' | 'standard' | 'premium'
type TemplateProfileState = 'candidate' | 'validated_by_admin' | 'standard' | 'archived'

type PriceSelectionSnapshot = {
  material_key: string
  policy: PricingPolicy
  match_source: 'exact_region' | 'region_fallback'
  match_mode: 'preferred_first' | 'only_preferred' | 'ignore'
  preferred_supplier_key: string | null
  supplier_key: string | null
  price_row_id: string | null
  region_code: string | null
  unit: string | null
  unit_price: number
  valid_from: string | null
  valid_to: string | null
  source_note: string | null
}

type TemplateMatchTraceItem = {
  tier: string
  description: string
  matched_count: number
  selected_count: number
  selected_template_codes: string[]
}

const DEFAULT_COEFFICIENTS = {
  floors_threshold: 3,
  floors_coeff_per_extra: 0.02,
  tum_coeff: 0.03,
  basement_coeff: 0.08,
  elevator_coeff: 0.06,
  finish_co_ban_multiplier: 1.0,
  finish_tieu_chuan_multiplier: 1.08,
  finish_cao_cap_multiplier: 1.18,
}

export async function generateEstimateV2(
  input: EstimateV2Input,
  options?: {
    mode?: 'preview' | 'save'
    mark_as_standard?: boolean
    template_state?: TemplateProfileState | string | null
    forced_template_ids?: string[] | null
  }
) {
  const prismaAny = db as any
  const area = toNumber(input.floor_area_total) || 0
  if (area <= 0) throw new Error('Thieu hoac sai tong dien tich san')

  const quoteDate = input.quote_date ? new Date(input.quote_date) : new Date()
  const regionCode = (input.region_code || 'ALL').trim()
  const baseCostPerM2 = toNumber(input.base_cost_per_m2) || 0
  const pricingPolicy = normalizePricingPolicy(input.pricing_policy)
  const preferredSupplierKey = String(input.preferred_supplier_key || '').trim() || null
  const supplierMatchMode = normalizeSupplierMatchMode(input.supplier_match_mode)

  const assumptions: string[] = []
  const warnings: string[] = []
  const missingFields: string[] = []
  const details: string[] = []
  const suggestions: Array<{ key: string; value: any }> = []
  const matchedRuleCodes: string[] = []
  const shouldSave = options?.mode === 'save'
  const markAsStandard = Boolean(options?.mark_as_standard)
  const templateStateRequested = normalizeTemplateProfileState(options?.template_state)
  const templateStateFinal: TemplateProfileState = markAsStandard ? 'standard' : templateStateRequested
  const estimateStage = 'preliminary_estimate'
  const templateApplyMode = normalizeTemplateApplyMode(input.template_apply_mode)

  let items: EngineLineItem[] = []
  let subtotal = 0
  let pricingMode = 'template_rule'
  let sourceCaseId: string | null = null
  let priceSelections: PriceSelectionSnapshot[] = []

  const coeffConfig = await getCoefficientConfig()
  const featureCoeff = calcFeatureCoefficient({
    floors: toInt(input.floors) || 0,
    tum_count: toInt(input.tum_count) || 0,
    basement_count: toInt(input.basement_count) || 0,
    has_elevator: Boolean(input.has_elevator),
    finish_level: (input.finish_level || 'tieu_chuan').toString(),
    cfg: coeffConfig,
  })

  const facts = buildFacts(input, area)
  const groupKey = buildTemplateGroupKey(input)
  if (!toNumber(input.floor_height_m)) {
    assumptions.push('Khong nhap chieu cao tang, he thong dung mac dinh 3m')
  }
  if (!toNumber(input.stair_void_area)) {
    assumptions.push('Khong nhap hoc thang, he thong tam tinh hoc thang = 0 m2')
  }
  const activeRules = await getActiveRules(quoteDate)
  let ruleCoeff = 1
  const deferredItems: EngineLineItem[] = []
  for (const rule of activeRules) {
    if (!isRuleMatched(rule.conditions || [], facts)) continue
    matchedRuleCodes.push(rule.rule_code)
    for (const action of rule.actions || []) {
      if (action.action_type === 'set_field' && action.target_key) {
        if (action.formula_expr && String(action.formula_expr).trim()) {
          const computed = tryParseFormula(action.formula_expr, facts)
          if (computed !== null) {
            facts[action.target_key] = computed
          } else {
            warnings.push(`Rule ${rule.rule_code}: formula set_field khong hop le cho ${action.target_key}`)
          }
        } else {
          facts[action.target_key] = action.value_number ?? action.value_text ?? action.value_json ?? null
        }
      } else if (action.action_type === 'multiply_coeff') {
        const v = action.value_number || parseFormula(action.formula_expr || '', facts)
        if (v && v > 0) ruleCoeff *= v
      } else if (action.action_type === 'add_warning') {
        warnings.push(action.value_text || action.target_key || `Rule warning (${rule.rule_code})`)
      } else if (action.action_type === 'suggest_value' && action.target_key) {
        if (action.formula_expr && String(action.formula_expr).trim()) {
          const computed = tryParseFormula(action.formula_expr, facts)
          suggestions.push({ key: action.target_key, value: computed ?? (action.value_number ?? action.value_text ?? action.value_json ?? null) })
        } else {
          suggestions.push({ key: action.target_key, value: action.value_number ?? action.value_text ?? action.value_json ?? null })
        }
      } else if (action.action_type === 'add_item') {
        const item = normalizeActionAddItem(action, facts)
        if (item) deferredItems.push(item)
      }
    }
  }
  refreshDerivedFacts(facts)
  const basicMetrics = buildBasicMetrics(facts)
  details.push(
    `So lieu co ban: san=${round2(basicMetrics.slab_area_total_m2)}m2, tran=${round2(basicMetrics.ceiling_area_total_m2)}m2, tuong=${round2(basicMetrics.wall_surface_area_total_m2)}m2, cot=${round2(basicMetrics.column_linear_total_m)}m`
  )
  details.push(`Chinh sach chon gia: ${pricingPolicy}`)
  details.push(`Nha cung cap: ${preferredSupplierKey || 'ALL'} (${supplierMatchMode})`)

  const templateResult = await buildItemsFromTemplates(
    input,
    facts,
    regionCode,
    quoteDate,
    pricingPolicy,
    preferredSupplierKey,
    supplierMatchMode,
    options?.forced_template_ids || null
  )
  warnings.push(...templateResult.warnings)
  missingFields.push(...templateResult.missing_fields)
  details.push(...templateResult.details)
  assumptions.push(...templateResult.assumptions)
  priceSelections = mergePriceSelections(priceSelections, templateResult.price_selections || [])
  const matchTrace = templateResult.match_trace || []

  if (templateResult.items.length > 0 && templateResult.subtotal > 0) {
    items = templateResult.items
    subtotal = templateResult.subtotal
    pricingMode = 'template_rule'
  }

  const caseResult = await findSimilarCase(input)
  const standardCase = await findStandardCaseByGroup(groupKey)
  const recommendation = buildTemplateRecommendations(groupKey, standardCase, caseResult)
  const selectedCase = selectCaseByApplyMode(templateApplyMode, standardCase, caseResult)
  const forceCase = templateApplyMode === 'standard_template' || templateApplyMode === 'nearest_template'
  const selectedSimilarity = selectedCase?.type === 'standard'
    ? 1
    : (selectedCase?.similarity || 0)
  let appliedCase: {
    applied: boolean
    type: 'standard' | 'nearest' | 'none'
    quote_id: string | null
    similarity: number | null
    reason: string
  } = {
    applied: false,
    type: 'none',
    quote_id: null,
    similarity: null,
    reason: 'khong_co_case_hoac_khong_ap_case',
  }

  if (forceCase && !selectedCase) {
    warnings.push(`Khong tim thay case phu hop cho che do ${templateApplyMode}`)
    appliedCase.reason = 'force_mode_but_no_case'
  }

  if (selectedCase && (forceCase || !items.length || subtotal <= 0)) {
    const generated = await buildItemsFromCase(
      selectedCase.quote,
      area,
      regionCode,
      quoteDate,
      pricingPolicy,
      preferredSupplierKey,
      supplierMatchMode
    )
    items = generated.items
    subtotal = generated.subtotal
    warnings.push(...generated.warnings)
    missingFields.push(...generated.missing_fields)
    details.push(...generated.details)
    priceSelections = mergePriceSelections(priceSelections, generated.price_selections || [])
    pricingMode = 'case_based'
    sourceCaseId = selectedCase.quote.id
    appliedCase = {
      applied: true,
      type: selectedCase.type,
      quote_id: selectedCase.quote.id,
      similarity: round2(selectedSimilarity),
      reason: forceCase ? 'forced_by_template_apply_mode' : 'fallback_from_template_rule',
    }
    assumptions.push(`Ap dung case (${selectedCase.type}): ${selectedCase.quote.id} (similarity=${round2(selectedSimilarity)})`)
    assumptions.push('Case-based chi dung dinh luong co ban; don gia duoc lay lai theo bang gia hien tai')
  } else if (items.length > 0 && selectedCase) {
    appliedCase = {
      applied: false,
      type: selectedCase.type,
      quote_id: selectedCase.quote.id,
      similarity: round2(selectedSimilarity),
      reason: 'template_rule_has_priority',
    }
    assumptions.push(`Co case (${selectedCase.type}) ${selectedCase.quote.id} (similarity=${round2(selectedSimilarity)}) nhung uu tien template/rule`)
  }

  if (deferredItems.length > 0) {
    for (const it of deferredItems) {
      items.push(it)
      subtotal += it.cost
    }
    assumptions.push(`Rule da bo sung ${deferredItems.length} hang muc`)
  }

  if (subtotal <= 0 && baseCostPerM2 > 0) {
    subtotal = area * baseCostPerM2
    pricingMode = 'base_cost_only'
    assumptions.push('Fallback sang base_cost_per_m2 vi khong du item tinh gia')
  }
  if (subtotal <= 0 && shouldSave) {
    throw new Error('Khong du du lieu gia de luu du toan so bo. Hay bo sung bang gia hoac base_cost_per_m2')
  }

  const coeffTotal = round2(featureCoeff * ruleCoeff)
  const contextFactors = buildContextFactors(input)
  const contextFactorTotal = round4(
    contextFactors.geo_factor
    * contextFactors.labor_factor
    * contextFactors.transport_factor
    * contextFactors.difficulty_factor
    * contextFactors.market_factor
  )
  const total = subtotal * coeffTotal * contextFactorTotal
  details.push(
    `He so boi canh: geo=${contextFactors.geo_factor}, labor=${contextFactors.labor_factor}, transport=${contextFactors.transport_factor}, difficulty=${contextFactors.difficulty_factor}, market=${contextFactors.market_factor}, total=${round4(contextFactorTotal)}`
  )
  const confidence = calcConfidence({
    source: pricingMode,
    missingCount: missingFields.length,
    matchedRuleCount: matchedRuleCodes.length,
    similarity: selectedSimilarity,
  })

  if (!shouldSave) {
    if (subtotal <= 0) {
      warnings.push('Chua tinh duoc chi phi vi thieu don gia vat tu. He thong van tra ve so lieu boc tach co ban.')
      missingFields.push('pricing_data_missing')
    }
    assumptions.push('Ban preview nay khong luu vao DB va khong duoc dung lam case cho lan sau')
    return {
      id: null,
      customer_id: input.customer_id || null,
      recipe_id: null,
      recipe_key: null,
      recipe_name: pricingMode === 'case_based' ? `CASE:${sourceCaseId}` : 'ESTIMATE_V2_TEMPLATE_RULE',
      region_code: regionCode,
      quote_date: quoteDate.toISOString(),
      floor_area_total: area,
      floors: toInt(input.floors),
      tum_count: toInt(input.tum_count),
      basement_count: toInt(input.basement_count),
      has_elevator: input.has_elevator ?? false,
      finish_level: (input.finish_level || 'tieu_chuan').toString(),
      base_cost_per_m2: baseCostPerM2 > 0 ? baseCostPerM2 : null,
      coeff_total: coeffTotal,
      subtotal_cost: Math.round(subtotal),
      total_cost: Math.round(total),
      pricing_mode: pricingMode,
      status: 'preview_not_saved',
      items: items.map((x, idx) => ({
        id: `preview_${idx + 1}`,
        material_key: x.material_key,
        material_name: x.material_name,
        unit: x.unit,
        quantity: x.quantity,
        unit_price: x.unit_price,
        ratio_percent: x.ratio_percent,
        cost: Math.round(x.cost),
        price_source: x.price_source,
        note: x.note,
      })),
      meta: {
        estimate_stage: estimateStage,
        template_apply_mode: templateApplyMode,
        pricing_policy: pricingPolicy,
        preferred_supplier_key: preferredSupplierKey,
        supplier_match_mode: supplierMatchMode,
        context_profile_key: input.context_profile_key || null,
        assumptions,
        warnings,
        missing_fields: Array.from(new Set(missingFields)),
        details,
        suggestions,
        matched_rule_codes: matchedRuleCodes,
        source_case_id: sourceCaseId,
        applied_case: appliedCase,
        confidence,
        basic_metrics: basicMetrics,
        context_factors: contextFactors,
        context_factor_total: contextFactorTotal,
        pricing_mode: pricingMode,
        template_group_key: groupKey,
        recommendation,
        template_state: 'candidate',
        match_trace: matchTrace,
        pricing_snapshot: {
          policy: pricingPolicy,
          preferred_supplier_key: preferredSupplierKey,
          supplier_match_mode: supplierMatchMode,
          selected_prices: priceSelections,
        },
        saved_to_db: false,
      },
    }
  }

  const quote = await prismaAny.estimationQuote.create({
    data: {
      customer_id: input.customer_id || null,
      recipe_id: null,
      recipe_key: null,
      recipe_name: pricingMode === 'case_based' ? `CASE:${sourceCaseId}` : 'ESTIMATE_V2_TEMPLATE_RULE',
      region_code: regionCode,
      quote_date: quoteDate,
      floor_area_total: area,
      floors: toInt(input.floors),
      tum_count: toInt(input.tum_count),
      basement_count: toInt(input.basement_count),
      has_elevator: input.has_elevator ?? false,
      finish_level: (input.finish_level || 'tieu_chuan').toString(),
      base_cost_per_m2: baseCostPerM2 > 0 ? BigInt(Math.round(baseCostPerM2)) : null,
      coeff_total: coeffTotal,
      subtotal_cost: BigInt(Math.round(subtotal)),
      total_cost: BigInt(Math.round(total)),
      pricing_mode: pricingMode,
      status: 'approved_as_correct',
      extra_facts_json: sanitizeExtraFacts(input.extra_facts_json),
      input_snapshot: {
        ...input,
        region_code: regionCode,
        estimate_stage: estimateStage,
        template_apply_mode: templateApplyMode,
        pricing_policy: pricingPolicy,
        preferred_supplier_key: preferredSupplierKey,
        supplier_match_mode: supplierMatchMode,
        context_profile_key: input.context_profile_key || null,
        template_group_key: groupKey,
        template_state: templateStateFinal,
        pricing_snapshot: {
          policy: pricingPolicy,
          preferred_supplier_key: preferredSupplierKey,
          supplier_match_mode: supplierMatchMode,
          selected_prices: priceSelections,
        },
      },
      result_snapshot: {
        subtotal,
        total,
        feature_coeff: featureCoeff,
        rule_coeff: ruleCoeff,
        coeff_total: coeffTotal,
        matched_rule_codes: matchedRuleCodes,
        source_case_id: sourceCaseId,
        applied_case: appliedCase,
        assumptions,
        warnings,
        missing_fields: Array.from(new Set(missingFields)),
        details,
        suggestions,
        confidence,
        basic_metrics: basicMetrics,
        pricing_policy: pricingPolicy,
        preferred_supplier_key: preferredSupplierKey,
        supplier_match_mode: supplierMatchMode,
        context_factors: contextFactors,
        context_factor_total: contextFactorTotal,
        estimate_stage: estimateStage,
        template_apply_mode: templateApplyMode,
        context_profile_key: input.context_profile_key || null,
        template_group_key: groupKey,
        recommendation,
        match_trace: matchTrace,
        pricing_snapshot: {
          policy: pricingPolicy,
          preferred_supplier_key: preferredSupplierKey,
          supplier_match_mode: supplierMatchMode,
          selected_prices: priceSelections,
        },
        template_profile: {
          group_key: groupKey,
          template_state: templateStateFinal,
          marked_as_standard: markAsStandard,
        },
      },
      created_by: input.created_by || null,
      items: {
        create: items.map((x) => ({
          material_key: x.material_key,
          material_name: x.material_name,
          unit: x.unit,
          quantity: x.quantity,
          unit_price: x.unit_price != null ? BigInt(Math.round(x.unit_price)) : null,
          ratio_percent: x.ratio_percent,
          cost: BigInt(Math.round(x.cost)),
          price_source: x.price_source,
          note: x.note,
        })),
      },
    },
    include: { items: true },
  })

  if (markAsStandard) {
    await demoteOtherStandardTemplates(quote.id, groupKey)
  }

  const serialized = serializeQuote(quote)
  return {
    ...serialized,
    meta: {
      estimate_stage: estimateStage,
      template_apply_mode: templateApplyMode,
      pricing_policy: pricingPolicy,
      preferred_supplier_key: preferredSupplierKey,
      supplier_match_mode: supplierMatchMode,
      context_profile_key: input.context_profile_key || null,
      assumptions,
      warnings,
      missing_fields: Array.from(new Set(missingFields)),
      details,
      suggestions,
      matched_rule_codes: matchedRuleCodes,
      source_case_id: sourceCaseId,
      applied_case: appliedCase,
      confidence,
      basic_metrics: basicMetrics,
      context_factors: contextFactors,
      context_factor_total: contextFactorTotal,
      pricing_mode: pricingMode,
      template_group_key: groupKey,
      recommendation,
      template_state: templateStateFinal,
      match_trace: matchTrace,
      pricing_snapshot: {
        policy: pricingPolicy,
        preferred_supplier_key: preferredSupplierKey,
        supplier_match_mode: supplierMatchMode,
        selected_prices: priceSelections,
      },
      saved_to_db: true,
    },
  }
}

export function validateEstimateInputV2(input: EstimateV2Input) {
  const missingFields: string[] = []
  const suggestedInputs: Record<string, string> = {}
  const details: string[] = []

  const length = toNumber(input.build_length_m) || 0
  const width = toNumber(input.build_width_m) || 0
  if (length <= 0) {
    missingFields.push('build_length_m')
    suggestedInputs.build_length_m = 'Chieu dai xay dung (m), vi du: 15'
  }
  if (width <= 0) {
    missingFields.push('build_width_m')
    suggestedInputs.build_width_m = 'Chieu rong xay dung (m), vi du: 4'
  }
  if (length > 0 && width > 0) {
    details.push(`Dien tich 1 san tam tinh = ${round2(length * width)} m2`)
  }

  const floors = toInt(input.floors) || 0
  if (floors <= 0) {
    missingFields.push('floors')
    suggestedInputs.floors = 'So tang toi thieu = 1'
  }

  const foundationType = String(input.foundation_type || '').trim()
  if (!foundationType) {
    details.push('Khong co foundation_type: tam ap mac dinh mong_bang')
  }

  const houseType = String(input.house_type || '').trim()
  if (!houseType) {
    missingFields.push('house_type')
    suggestedInputs.house_type = 'Loai nha (nha_pho, biet_thu...)'
  }

  return {
    ok: missingFields.length === 0,
    missing_fields: missingFields,
    suggested_inputs: suggestedInputs,
    details,
  }
}

async function buildItemsFromTemplates(
  input: EstimateV2Input,
  facts: Record<string, any>,
  regionCode: string,
  quoteDate: Date,
  pricingPolicy: PricingPolicy,
  preferredSupplierKey: string | null,
  supplierMatchMode: 'preferred_first' | 'only_preferred' | 'ignore',
  forcedTemplateIds?: string[] | null
) {
  const area = toNumber(input.floor_area_total) || 0
  const prismaAny = db as any
  const normalizedHouseType = normalizeTemplateKey(input.house_type)
  const normalizedStyle = normalizeTemplateKey(input.style)
  const normalizedDefaultStyle = 'mac_dinh'
  const normalizedFinishLevel = normalizeFinishLevel(input.finish_level)
  const normalizedFoundationType = normalizeTemplateKey(input.foundation_type || facts.foundation_type || 'mong_bang')
  const includeDef = {
    items: {
      where: {
        is_active: true,
        OR: [{ effective_from: null }, { effective_from: { lte: quoteDate } }],
        AND: [{ OR: [{ effective_to: null }, { effective_to: { gte: quoteDate } }] }],
      },
      orderBy: { sort_order: 'asc' },
      include: { catalog_item: true },
    },
  }
  const baseWhere: any = {
    is_active: true,
    OR: [{ effective_from: null }, { effective_from: { lte: quoteDate } }],
    AND: [{ OR: [{ effective_to: null }, { effective_to: { gte: quoteDate } }] }],
  }

  const candidates = await prismaAny.estimationTemplateHeader.findMany({
    where: {
      ...baseWhere,
      AND: [
        ...(baseWhere.AND || []),
        { OR: [{ house_type: null }, { house_type: normalizedHouseType || null }] },
        { OR: [{ finish_level: null }, { finish_level: normalizedFinishLevel || null }] },
        { OR: [{ style: null }, { style: normalizedStyle || null }, { style: normalizedDefaultStyle }] },
      ],
    },
    orderBy: [{ priority: 'desc' }, { updated_at: 'desc' }],
    include: includeDef,
  })

  const matchTrace: TemplateMatchTraceItem[] = []
  const usedGroupKeys = new Set<string>()
  const templates: any[] = []
  const effectiveStyle = normalizedStyle || normalizedDefaultStyle

  const tiers: Array<{
    key: string
    description: string
    house?: string | null
    finish?: string | null
    style?: string | null
  }> = [
    {
      key: 'T1_exact_house_style_finish',
      description: 'Khop chinh xac house_type + style + finish_level',
      house: normalizedHouseType || null,
      finish: normalizedFinishLevel || null,
      style: effectiveStyle || null,
    },
    {
      key: 'T2_style_default_fallback',
      description: 'Khop house_type + finish_level, fallback style=mac_dinh',
      house: normalizedHouseType || null,
      finish: normalizedFinishLevel || null,
      style: normalizedDefaultStyle,
    },
    {
      key: 'T3_style_null_fallback',
      description: 'Khop house_type + finish_level, fallback style=null',
      house: normalizedHouseType || null,
      finish: normalizedFinishLevel || null,
      style: null,
    },
    {
      key: 'T4_finish_fallback',
      description: 'Khop house_type + style, fallback finish_level=null',
      house: normalizedHouseType || null,
      finish: null,
      style: effectiveStyle || null,
    },
    {
      key: 'T5_house_only_default_style',
      description: 'Khop house_type, fallback finish_level/style ve mac_dinh-null',
      house: normalizedHouseType || null,
      finish: null,
      style: normalizedDefaultStyle,
    },
    {
      key: 'T6_house_only_null_style',
      description: 'Khop house_type, fallback finish_level/style=null',
      house: normalizedHouseType || null,
      finish: null,
      style: null,
    },
    {
      key: 'T7_generic_default_style',
      description: 'Fallback generic template house_type=null + style=mac_dinh',
      house: null,
      finish: null,
      style: normalizedDefaultStyle,
    },
    {
      key: 'T8_generic_null_style',
      description: 'Fallback generic template house_type=null + style=null',
      house: null,
      finish: null,
      style: null,
    },
  ]

  const isTemplateCompatible = (tpl: any, t: { house?: string | null; finish?: string | null; style?: string | null }) => {
    const tplHouse = normalizeTemplateKey(tpl.house_type)
    const tplFinish = normalizeFinishLevel(tpl.finish_level)
    const tplStyle = normalizeTemplateKey(tpl.style)
    const tplType = normalizeTemplateKey(tpl.template_type)
    const tplRoomType = normalizeTemplateKey(tpl.room_type)

    if (t.house === null) {
      if (tplHouse) return false
    } else if (tplHouse !== normalizeTemplateKey(t.house)) {
      return false
    }

    if (t.finish === null) {
      if (tpl.finish_level != null && String(tpl.finish_level).trim()) return false
    } else if (tplFinish !== normalizeFinishLevel(t.finish)) {
      return false
    }

    if (t.style === null) {
      if (tpl.style != null && String(tpl.style).trim()) return false
    } else if (tplStyle !== normalizeTemplateKey(t.style)) {
      return false
    }

    if (tplType === 'foundation') {
      if (tplRoomType && normalizedFoundationType && tplRoomType !== normalizedFoundationType) return false
    }
    return true
  }

  const getGroupKey = (tpl: any) => {
    const tType = normalizeTemplateKey(tpl.template_type) || 'unknown'
    const rType = normalizeTemplateKey(tpl.room_type) || 'all'
    return `${tType}|${rType}`
  }

  const forcedIds = Array.from(new Set((forcedTemplateIds || []).map((x) => String(x || '').trim()).filter(Boolean)))
  if (forcedIds.length) {
    const forcedRows = await prismaAny.estimationTemplateHeader.findMany({
      where: {
        ...baseWhere,
        id: { in: forcedIds },
      },
      orderBy: [{ priority: 'desc' }, { updated_at: 'desc' }],
      include: includeDef,
    })
    const forcedSelected: any[] = []
    for (const tpl of forcedRows) {
      const groupKey = getGroupKey(tpl)
      if (usedGroupKeys.has(groupKey)) continue
      usedGroupKeys.add(groupKey)
      forcedSelected.push(tpl)
      templates.push(tpl)
    }
    matchTrace.push({
      tier: 'T0_forced_from_blocks',
      description: 'Uu tien template duoc gan truc tiep trong blocks',
      matched_count: forcedRows.length,
      selected_count: forcedSelected.length,
      selected_template_codes: forcedSelected.map((x: any) => `${x.template_code}@v${x.version}`),
    })
  }

  for (const tier of tiers) {
    const tierCandidates = candidates.filter((tpl: any) => isTemplateCompatible(tpl, tier))
    const selectedNow: any[] = []
    for (const tpl of tierCandidates) {
      const groupKey = getGroupKey(tpl)
      if (usedGroupKeys.has(groupKey)) continue
      usedGroupKeys.add(groupKey)
      selectedNow.push(tpl)
    }
    for (const s of selectedNow) templates.push(s)
    matchTrace.push({
      tier: tier.key,
      description: tier.description,
      matched_count: tierCandidates.length,
      selected_count: selectedNow.length,
      selected_template_codes: selectedNow.map((x: any) => `${x.template_code}@v${x.version}`),
    })
  }

  const warnings: string[] = []
  const missingFields: string[] = []
  const details: string[] = []
  const assumptions: string[] = []
  const items: EngineLineItem[] = []
  const priceSelections: PriceSelectionSnapshot[] = []
  let subtotal = 0

  if (!templates.length) {
    missingFields.push('template_not_found')
    details.push(`Khong tim thay template active. Input house_type=${normalizedHouseType || '-'} style=${normalizedStyle || '-'} finish_level=${normalizedFinishLevel || '-'}`)
    return { items, subtotal, warnings, missing_fields: missingFields, details, assumptions, price_selections: priceSelections, match_trace: matchTrace }
  }

  const firstTier = matchTrace.find((x) => x.selected_count > 0)?.tier || 'unknown'
  assumptions.push(`Da ap dung ${templates.length} template active (first_match_tier=${firstTier}, house_type=${normalizedHouseType || '-'}, style=${normalizedStyle || normalizedDefaultStyle}, finish_level=${normalizedFinishLevel || '-'}, foundation_type=${normalizedFoundationType || '-'})`)
  if (!normalizedStyle) {
    assumptions.push(`Khong nhap style, he thong dung style mac dinh (${normalizedDefaultStyle}) de match template`)
  }
  for (const template of templates) {
    for (const tItem of template.items || []) {
      const qty = calcTemplateQuantity(tItem, area, tItem.scope_key || template.room_type, facts)
      if (!qty || qty <= 0) continue

      const priceInfo = await findMaterialPrice(
        tItem.catalog_item.item_code,
        regionCode,
        quoteDate,
        pricingPolicy,
        preferredSupplierKey,
        supplierMatchMode
      )
      const wasteMul = 1 + (tItem.waste_factor || 0)
      const unitPrice = priceInfo?.unit_price || null
      const cost = unitPrice != null ? qty * unitPrice * wasteMul : 0
      if (unitPrice == null) {
        missingFields.push('template_item_missing_price')
        details.push(`Thieu gia item: ${tItem.catalog_item.item_code} (${tItem.catalog_item.item_name})`)
      } else if (priceInfo?.selection) {
        priceSelections.push(priceInfo.selection)
      }

      items.push({
        material_key: tItem.catalog_item.item_code,
        material_name: tItem.catalog_item.item_name || null,
        unit: tItem.catalog_item.item_unit || null,
        quantity: qty,
        unit_price: unitPrice,
        ratio_percent: null,
        cost,
        price_source: priceInfo?.source || 'missing_price',
        note: `template:${template.template_code}@v${template.version}|${String(template.template_name || '').trim()}`,
      })
      subtotal += cost
    }
  }

  return {
    items,
    subtotal,
    warnings,
    missing_fields: Array.from(new Set(missingFields)),
    details,
    assumptions,
    price_selections: priceSelections,
    match_trace: matchTrace,
  }
}

function normalizeTemplateKey(v: unknown) {
  const raw = String(v || '').trim().toLowerCase()
  if (!raw) return ''
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['"`]/g, '')
    .replace(/\s+/g, '_')
}

function normalizeFinishLevel(v: unknown) {
  const key = normalizeTemplateKey(v)
  if (!key) return 'tieu_chuan'
  if (key === 'co_ban' || key === 'coban' || key === 'basic') return 'co_ban'
  if (key === 'tieu_chuan' || key === 'tieuchuan' || key === 'standard') return 'tieu_chuan'
  if (key === 'cao_cap' || key === 'caocap' || key === 'premium') return 'cao_cap'
  return key
}

function deriveTumAreaFromInput(input: EstimateV2Input, footprintArea: number) {
  const mode = String(input.tum_area_mode || '').trim().toLowerCase()
  const tumAreaM2 = toNumber(input.tum_area_m2)
  const tumAreaPercentRaw = toNumber(input.tum_area_percent)
  const tumAreaPercent = tumAreaPercentRaw == null ? null : Math.max(0, Math.min(100, tumAreaPercentRaw))
  if (mode === 'm2' && tumAreaM2 != null) return Math.max(0, tumAreaM2)
  if (mode === 'percent' && tumAreaPercent != null) return Math.max(0, footprintArea * (tumAreaPercent / 100))
  if (tumAreaM2 != null) return Math.max(0, tumAreaM2)
  if (tumAreaPercent != null) return Math.max(0, footprintArea * (tumAreaPercent / 100))
  return 0
}

function normalizeFactKey(v: unknown) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function parseRequiredFacts(raw: unknown): string[] {
  if (!raw) return []
  const arr = Array.isArray(raw)
    ? raw
    : String(raw)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
  return arr.map((x) => normalizeFactKey(x)).filter(Boolean)
}

function hasFactValue(v: unknown) {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (typeof v === 'number') return Number.isFinite(v)
  return true
}

function calcTemplateQuantity(
  tItem: any,
  area: number,
  roomType: string | null,
  facts: Record<string, any>
) {
  const applyMode = normalizeApplyMode(tItem.apply_mode)
  const scopeKey = String(roomType || '').toLowerCase()
  const basisKey = String(tItem.quantity_basis_key || '').trim()
  const qv = toNumber(tItem.quantity_value) || 0
  if (applyMode === 'per_area') {
    const basisValue = getBasisValue(basisKey, scopeKey, area, facts)
    return qv * basisValue
  }
  if (applyMode === 'per_unit') {
    const basisValue = basisKey ? (toNumber(facts[basisKey]) || 0) : getRoomCount(roomType, facts)
    return qv * basisValue
  }
  // Legacy compatibility
  if (applyMode === 'per_m2') {
    if (isTumScope(scopeKey)) {
      return qv * (toNumber(facts.tum_area_total) || 0)
    }
    if (isRoomScope(scopeKey)) {
      return qv * (toNumber(facts.main_floor_area_total) || toNumber(facts.slab_area_total) || area)
    }
    if (isFloorScope(scopeKey)) return qv * (toNumber(facts.slab_area_total) || area)
    if (isCeilingScope(scopeKey)) return qv * (toNumber(facts.ceiling_area_total) || area)
    if (isWallScope(scopeKey)) {
      const wallBase = toNumber(facts.wall_surface_area_total) || toNumber(facts.wall_length_total) || area
      return qv * wallBase
    }
    if (isColumnScope(scopeKey)) {
      const columnBase = toNumber(facts.column_linear_total) || 0
      return qv * columnBase
    }
    return qv * area
  }
  if (applyMode === 'per_room') {
    const roomCount = getRoomCount(roomType, facts)
    return qv * roomCount
  }
  if (applyMode === 'fixed') return qv
  if (applyMode === 'formula') {
    const requiredFacts = parseRequiredFacts(tItem?.required_facts)
    if (requiredFacts.length > 0) {
      for (const k of requiredFacts) {
        if (!hasFactValue(facts[k])) return 0
      }
    }
    const v = parseFormula(tItem.formula_expr || '', facts)
    return v > 0 ? v : 0
  }
  return 0
}

function normalizeApplyMode(v: unknown) {
  const raw = String(v || '').trim().toLowerCase()
  if (raw === 'per_area' || raw === 'per_m2') return raw
  if (raw === 'per_unit' || raw === 'per_room') return raw
  if (raw === 'fixed' || raw === 'formula') return raw
  return raw
}

function getBasisValue(basisKey: string, scopeKey: string, area: number, facts: Record<string, any>) {
  if (basisKey) {
    return toNumber(facts[basisKey]) || 0
  }
  if (isTumScope(scopeKey)) return toNumber(facts.tum_area_total) || 0
  if (isRoomScope(scopeKey)) return toNumber(facts.main_floor_area_total) || toNumber(facts.slab_area_total) || area
  if (isFloorScope(scopeKey)) return toNumber(facts.slab_area_total) || area
  if (isCeilingScope(scopeKey)) return toNumber(facts.ceiling_area_total) || area
  if (isWallScope(scopeKey)) return toNumber(facts.wall_surface_area_total) || toNumber(facts.wall_length_total) || area
  if (isColumnScope(scopeKey)) return toNumber(facts.column_linear_total) || 0
  return area
}

function getRoomCount(roomType: string | null, facts: Record<string, any>) {
  if (!roomType) return 1
  const k = roomType.toLowerCase()
  if (k.includes('bed')) return toInt(facts.bedroom_count) || 0
  if (k.includes('wc') || k.includes('toilet')) return toInt(facts.wc_count) || 0
  if (k.includes('kitchen') || k.includes('bep')) return toInt(facts.kitchen_count) || 0
  if (k.includes('living') || k.includes('khach')) return toInt(facts.living_room_count) || 0
  return 1
}

function isFloorScope(scopeKey: string) {
  return scopeKey.includes('san') || scopeKey.includes('floor')
}

function isRoomScope(scopeKey: string) {
  return scopeKey.includes('bed')
    || scopeKey.includes('wc')
    || scopeKey.includes('toilet')
    || scopeKey.includes('kitchen')
    || scopeKey.includes('bep')
    || scopeKey.includes('living')
    || scopeKey.includes('khach')
    || scopeKey.includes('room')
    || scopeKey.includes('phong')
}

function isTumScope(scopeKey: string) {
  return scopeKey.includes('tum')
}

function isCeilingScope(scopeKey: string) {
  return scopeKey.includes('tran') || scopeKey.includes('ceiling')
}

function isWallScope(scopeKey: string) {
  return scopeKey.includes('tuong') || scopeKey.includes('wall')
}

function isColumnScope(scopeKey: string) {
  return scopeKey.includes('cot') || scopeKey.includes('column')
}

function parseFormula(expr: string, facts: Record<string, any>) {
  if (!expr) return 0
  const safe = expr.trim()
  if (!/^[\d\s+\-*/().,_a-zA-Z]+$/.test(safe)) return 0
  const names = Object.keys(facts)
  const values = names.map((x) => Number(facts[x] ?? 0))
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(...names, `return (${safe});`)
    const out = fn(...values)
    const n = Number(out)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function tryParseFormula(expr: string, facts: Record<string, any>): number | null {
  if (!expr || !String(expr).trim()) return null
  const safe = String(expr).trim()
  if (!/^[\d\s+\-*/().,_a-zA-Z]+$/.test(safe)) return null
  const names = Object.keys(facts)
  const values = names.map((x) => Number(facts[x] ?? 0))
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(...names, `return (${safe});`)
    const out = fn(...values)
    const n = Number(out)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

async function findSimilarCase(input: EstimateV2Input) {
  const prismaAny = db as any
  const area = toNumber(input.floor_area_total) || 0
  const floors = toInt(input.floors) || 0
  const tum = toInt(input.tum_count) || 0
  const basement = toInt(input.basement_count) || 0
  const finish = String(input.finish_level || 'tieu_chuan')
  const style = String(input.style || 'mac_dinh')

  const quotes = await prismaAny.estimationQuote.findMany({
    where: {
      status: 'approved_as_correct',
      floor_area_total: { not: null },
      floors: { not: null },
    },
    orderBy: { created_at: 'desc' },
    take: 120,
    include: { items: true },
  })

  let best: any = null
  let bestScore = 0
  for (const q of quotes) {
    const qArea = Number(q.floor_area_total || 0)
    const qFloors = Number(q.floors || 0)
    const qTum = Number(q.tum_count || 0)
    const qBasement = Number(q.basement_count || 0)
    const qFinish = String(q.finish_level || '')
    const qStyle = String((q.input_snapshot || {})?.style || 'mac_dinh')

    const areaScore = area > 0 && qArea > 0 ? 1 - Math.min(1, Math.abs(area - qArea) / Math.max(area, qArea)) : 0
    const floorScore = floors > 0 ? 1 - Math.min(1, Math.abs(floors - qFloors) / Math.max(1, floors)) : 0
    const tumScore = 1 - Math.min(1, Math.abs(tum - qTum) / 2)
    const basementScore = 1 - Math.min(1, Math.abs(basement - qBasement) / 2)
    const finishScore = qFinish === finish ? 1 : 0.4
    const styleScore = qStyle === style ? 1 : 0.5

    const s = round4(areaScore * 0.42 + floorScore * 0.23 + tumScore * 0.1 + basementScore * 0.1 + finishScore * 0.1 + styleScore * 0.05)
    if (s > bestScore) {
      bestScore = s
      best = q
    }
  }

  if (!best) return null
  return { quote: best, similarity: bestScore }
}

async function findStandardCaseByGroup(groupKey: string) {
  const prismaAny = db as any
  const rows = await prismaAny.estimationQuote.findMany({
    where: { status: 'approved_as_correct' },
    orderBy: { created_at: 'desc' },
    take: 220,
    include: { items: true },
  })
  for (const q of rows) {
    const rs = (q.result_snapshot || {}) as Record<string, any>
    const profile = (rs.template_profile || {}) as Record<string, any>
    if (String(profile.group_key || '') !== groupKey) continue
    if (String(profile.template_state || '') !== 'standard') continue
    return q
  }
  return null
}

function buildTemplateGroupKey(input: EstimateV2Input) {
  const houseType = String(input.house_type || 'unknown').trim() || 'unknown'
  const style = String(input.style || 'mac_dinh').trim() || 'mac_dinh'
  const foundationType = String(input.foundation_type || 'unknown').trim() || 'unknown'
  const finishLevel = String(input.finish_level || 'tieu_chuan').trim() || 'tieu_chuan'
  const floors = toInt(input.floors) || 0
  const area = toNumber(input.floor_area_total) || 0
  const regionCode = String(input.region_code || 'ALL').trim() || 'ALL'
  return [
    `house:${houseType}`,
    `style:${style}`,
    `foundation:${foundationType}`,
    `finish:${finishLevel}`,
    `floors:${toBand(floors, [1, 2, 3, 4, 6])}`,
    `area:${toBand(area, [80, 120, 180, 250, 350])}`,
    `region:${regionCode}`,
  ].join('|')
}

function buildTemplateRecommendations(
  groupKey: string,
  standardCase: any | null,
  caseResult: { quote: any; similarity: number } | null
) {
  return {
    mode_default: standardCase ? 'standard_template' : (caseResult ? 'nearest_template' : 'none'),
    standard_template: standardCase
      ? {
          quote_id: standardCase.id,
          group_key: groupKey,
          total_cost: Number(standardCase.total_cost || 0),
          created_at: standardCase.created_at,
        }
      : null,
    nearest_template: caseResult
      ? {
          quote_id: caseResult.quote.id,
          similarity: round2(caseResult.similarity),
          total_cost: Number(caseResult.quote.total_cost || 0),
          created_at: caseResult.quote.created_at,
        }
      : null,
    group_key: groupKey,
    can_mark_as_standard: true,
  }
}

function selectCaseByApplyMode(
  mode: 'auto' | 'standard_template' | 'nearest_template' | 'none',
  standardCase: any | null,
  nearestCase: { quote: any; similarity: number } | null
) {
  if (mode === 'none') return null
  if (mode === 'standard_template') {
    if (!standardCase) return null
    return { type: 'standard' as const, quote: standardCase, similarity: 1 }
  }
  if (mode === 'nearest_template') {
    if (!nearestCase) return null
    return { type: 'nearest' as const, quote: nearestCase.quote, similarity: nearestCase.similarity }
  }
  if (standardCase) return { type: 'standard' as const, quote: standardCase, similarity: 1 }
  if (nearestCase && nearestCase.similarity >= 0.78) {
    return { type: 'nearest' as const, quote: nearestCase.quote, similarity: nearestCase.similarity }
  }
  return null
}

async function demoteOtherStandardTemplates(currentQuoteId: string, groupKey: string) {
  const prismaAny = db as any
  const rows = await prismaAny.estimationQuote.findMany({
    where: { status: 'approved_as_correct' },
    orderBy: { created_at: 'desc' },
    take: 300,
  })

  for (const q of rows) {
    if (q.id === currentQuoteId) continue
    const resultSnapshot = ((q.result_snapshot || {}) as Record<string, any>)
    const profile = ((resultSnapshot.template_profile || {}) as Record<string, any>)
    if (String(profile.group_key || '') !== groupKey) continue
    if (String(profile.template_state || '') !== 'standard') continue

    await prismaAny.estimationQuote.update({
      where: { id: q.id },
      data: {
        result_snapshot: {
          ...resultSnapshot,
          template_profile: {
            ...profile,
            template_state: 'validated_by_admin',
            marked_as_standard: false,
          },
        },
      },
    })
  }
}

function toBand(value: number, thresholds: number[]) {
  if (!Number.isFinite(value) || value <= 0) return 'unknown'
  let lower = 0
  for (const t of thresholds) {
    if (value <= t) return `${lower + 1}-${t}`
    lower = t
  }
  return `${thresholds[thresholds.length - 1] + 1}+`
}

async function buildItemsFromCase(
  quote: any,
  area: number,
  regionCode: string,
  quoteDate: Date,
  pricingPolicy: PricingPolicy,
  preferredSupplierKey: string | null,
  supplierMatchMode: 'preferred_first' | 'only_preferred' | 'ignore'
) {
  const oldArea = Number(quote.floor_area_total || 0)
  const ratioByArea = oldArea > 0 && area > 0 ? (area / oldArea) : 1
  const warnings: string[] = []
  const missingFields: string[] = []
  const details: string[] = []
  const items: EngineLineItem[] = []
  const priceSelections: PriceSelectionSnapshot[] = []
  let subtotal = 0

  for (const it of (quote.items || [])) {
    const oldQty = it.quantity != null ? Number(it.quantity) : null
    const qty = oldQty != null ? oldQty * ratioByArea : null
    const priceInfo = await findMaterialPrice(
      String(it.material_key || ''),
      regionCode,
      quoteDate,
      pricingPolicy,
      preferredSupplierKey,
      supplierMatchMode
    )
    const unitPrice = priceInfo?.unit_price ?? null
    const cost = qty != null && unitPrice != null ? qty * unitPrice : 0
    if (unitPrice == null) {
      missingFields.push('case_item_missing_price')
      details.push(`Thieu gia case item: ${String(it.material_key || '')} (${String(it.material_name || '')})`)
    } else if (priceInfo?.selection) {
      priceSelections.push(priceInfo.selection)
    }
    items.push({
      material_key: it.material_key,
      material_name: it.material_name || null,
      unit: it.unit || null,
      quantity: qty,
      unit_price: unitPrice,
      ratio_percent: it.ratio_percent ?? null,
      cost,
      price_source: 'case_based',
      note: `scaled_qty_from_quote:${quote.id}`,
    })
    subtotal += cost
  }

  if (items.length === 0) {
    warnings.push('Case được chọn không có line item để tái sử dụng')
  }

  return {
    items,
    subtotal,
    warnings,
    missing_fields: Array.from(new Set(missingFields)),
    details,
    price_selections: priceSelections,
  }
}

function normalizeActionAddItem(action: any, facts: Record<string, any>): EngineLineItem | null {
  const v = action.value_json || {}
  const key = String(v.item_code || action.target_key || '').trim()
  if (!key) return null
  const qty = toNumber(v.quantity) || parseFormula(action.formula_expr || '', facts)
  if (!qty || qty <= 0) return null
  const unitPrice = toNumber(v.unit_price)
  return {
    material_key: key,
    material_name: v.item_name ? String(v.item_name) : key,
    unit: v.unit ? String(v.unit) : null,
    quantity: qty,
    unit_price: unitPrice,
    ratio_percent: null,
    cost: unitPrice != null ? qty * unitPrice : 0,
    price_source: unitPrice != null ? 'rule_action' : 'rule_action_missing_price',
    note: `rule_action:${action.action_type}`,
  }
}

function buildFacts(input: EstimateV2Input, area: number) {
  const floors = toInt(input.floors) || 0
  const floorHeight = toNumber(input.floor_height_m) || 3
  const length = toNumber(input.build_length_m) || 0
  const width = toNumber(input.build_width_m) || 0
  const footprintArea = length > 0 && width > 0
    ? length * width
    : (floors > 0 ? area / Math.max(1, floors) : area)

  const stairVoidAreaRaw = toNumber(input.stair_void_area) || 0
  const stairVoidArea = Math.max(0, Math.min(stairVoidAreaRaw, footprintArea))
  const slabNetArea = Math.max(0, footprintArea - stairVoidArea)
  const baseMainFloorArea = footprintArea > 0 && floors > 0
    ? footprintArea * floors
    : Math.max(0, area)
  const tumAreaTotal = deriveTumAreaFromInput(input, footprintArea)
  const mainFloorAreaTotal = Math.max(0, baseMainFloorArea)

  const middleFloorCount = Math.max(0, floors - 2)
  const slabAreaTotal = floors <= 0
    ? 0
    : floors === 1
      ? footprintArea
      : footprintArea + middleFloorCount * slabNetArea
  const ceilingAreaTotal = floors <= 0
    ? 0
    : floors === 1
      ? footprintArea
      : middleFloorCount * slabNetArea + footprintArea

  const perimeter = length > 0 && width > 0 ? 2 * (length + width) : 0
  const roomCount = (toInt(input.bedroom_count) || 0) + (toInt(input.kitchen_count) || 0) + (toInt(input.living_room_count) || 0)
  const wcCount = toInt(input.wc_count) || 0
  const wcPerimeter = toNumber(input.wc_perimeter_m) || 8
  const wallLengthTotal = perimeter * floors + width * 2 * roomCount + wcCount * wcPerimeter
  const grossWallAreaTotal = wallLengthTotal * floorHeight
  const openingAreaTotal = 0
  const wallSurfaceAreaTotal = Math.max(0, grossWallAreaTotal - openingAreaTotal)

  const columnCount = 0
  const columnLinearTotal = columnCount * floorHeight * floors

  const facts = {
    area,
    floor_area_total: area,
    main_floor_area_total: mainFloorAreaTotal,
    tum_area_total: tumAreaTotal,
    floor_area_without_tum: Math.max(0, mainFloorAreaTotal),
    tum_area_mode: String(input.tum_area_mode || '').trim().toLowerCase() || null,
    tum_area_m2: toNumber(input.tum_area_m2) || null,
    tum_area_percent: toNumber(input.tum_area_percent) || null,
    floors,
    tum_count: toInt(input.tum_count) || 0,
    floor_count_total: floors + (toInt(input.tum_count) || 0),
    basement_count: toInt(input.basement_count) || 0,
    has_elevator: input.has_elevator ? 1 : 0,
    build_length_m: length,
    build_width_m: width,
    footprint_area: footprintArea,
    stair_void_area: stairVoidArea,
    slab_net_area: slabNetArea,
    slab_area_total: slabAreaTotal,
    ceiling_area_total: ceilingAreaTotal,
    floor_height_m: floorHeight,
    perimeter,
    room_count: roomCount,
    wc_perimeter_m: wcPerimeter,
    wall_length_total: wallLengthTotal,
    gross_wall_area_total: grossWallAreaTotal,
    net_wall_area_total: wallSurfaceAreaTotal,
    wall_surface_area_total: wallSurfaceAreaTotal,
    wall_surface_area_gross: grossWallAreaTotal,
    wall_surface_area_net: wallSurfaceAreaTotal,
    opening_area_total: openingAreaTotal,
    opening_count_total: 0,
    door_count_total: 0,
    window_count_total: 0,
    vent_count_total: 0,
    door_area_total: 0,
    window_area_total: 0,
    column_count: columnCount,
    column_linear_total: columnLinearTotal,
    finish_level: String(input.finish_level || 'tieu_chuan'),
    house_type: input.house_type ? String(input.house_type) : '',
    style: input.style ? String(input.style) : 'mac_dinh',
    foundation_type: input.foundation_type ? String(input.foundation_type) : 'mong_bang',
    bedroom_count: toInt(input.bedroom_count) || 0,
    wc_count: toInt(input.wc_count) || 0,
    kitchen_count: toInt(input.kitchen_count) || 0,
    living_room_count: toInt(input.living_room_count) || 0,
  } as Record<string, any>

  const extraFacts = sanitizeExtraFacts(input.extra_facts_json)
  for (const [key, val] of Object.entries(extraFacts)) {
    facts[key] = val
    facts[`extra_${key}`] = val
  }

  return facts
}

function refreshDerivedFacts(facts: Record<string, any>) {
  const floors = toInt(facts.floors) || 0
  const floorHeight = toNumber(facts.floor_height_m) || 3
  const length = toNumber(facts.build_length_m) || 0
  const width = toNumber(facts.build_width_m) || 0
  const footprintArea = toNumber(facts.footprint_area) || (length > 0 && width > 0 ? length * width : 0)
  const stairVoidArea = Math.max(0, Math.min(toNumber(facts.stair_void_area) || 0, footprintArea))
  const slabNetArea = Math.max(0, footprintArea - stairVoidArea)
  const middleFloorCount = Math.max(0, floors - 2)

  facts.footprint_area = footprintArea
  facts.stair_void_area = stairVoidArea
  facts.slab_net_area = slabNetArea
  facts.main_floor_area_total = toNumber(facts.main_floor_area_total)
    ?? (footprintArea > 0 && floors > 0 ? footprintArea * floors : Math.max(0, (toNumber(facts.floor_area_total) || 0)))
  facts.tum_area_total = Math.max(0, toNumber(facts.tum_area_total) || 0)
  facts.floor_area_without_tum = Math.max(0, toNumber(facts.floor_area_without_tum) ?? toNumber(facts.main_floor_area_total) ?? 0)
  facts.floor_count_total = toInt(facts.floor_count_total) || (floors + (toInt(facts.tum_count) || 0))
  if (toNumber(facts.slab_area_total) === null) {
    facts.slab_area_total = floors <= 0 ? 0 : floors === 1 ? footprintArea : footprintArea + middleFloorCount * slabNetArea
  }
  if (toNumber(facts.ceiling_area_total) === null) {
    facts.ceiling_area_total = floors <= 0 ? 0 : floors === 1 ? footprintArea : middleFloorCount * slabNetArea + footprintArea
  }

  const perimeter = length > 0 && width > 0 ? 2 * (length + width) : (toNumber(facts.perimeter) || 0)
  const roomCount = toInt(facts.room_count) || ((toInt(facts.bedroom_count) || 0) + (toInt(facts.kitchen_count) || 0) + (toInt(facts.living_room_count) || 0))
  facts.room_count = roomCount
  const wcCount = toInt(facts.wc_count) || 0
  const wcPerimeter = toNumber(facts.wc_perimeter_m) || 8
  const wallLengthTotal = toNumber(facts.wall_length_total) ?? (perimeter * floors + width * 2 * roomCount + wcCount * wcPerimeter)
  const grossWallAreaTotal = toNumber(facts.gross_wall_area_total) ?? (wallLengthTotal * floorHeight)
  const openingAreaTotal = Math.max(0, toNumber(facts.opening_area_total) || 0)
  facts.perimeter = perimeter
  facts.wall_length_total = wallLengthTotal
  facts.gross_wall_area_total = grossWallAreaTotal
  facts.net_wall_area_total = Math.max(0, toNumber(facts.net_wall_area_total) ?? (grossWallAreaTotal - openingAreaTotal))
  facts.wall_surface_area_total = Math.max(0, toNumber(facts.wall_surface_area_total) ?? facts.net_wall_area_total)
  facts.wall_surface_area_gross = toNumber(facts.wall_surface_area_gross) ?? grossWallAreaTotal
  facts.wall_surface_area_net = Math.max(0, toNumber(facts.wall_surface_area_net) ?? facts.wall_surface_area_total)
  facts.opening_area_total = openingAreaTotal
  facts.opening_count_total = Math.max(0, toInt(facts.opening_count_total) || 0)
  facts.door_count_total = Math.max(0, toInt(facts.door_count_total) || 0)
  facts.window_count_total = Math.max(0, toInt(facts.window_count_total) || 0)
  facts.vent_count_total = Math.max(0, toInt(facts.vent_count_total) || 0)
  facts.door_area_total = Math.max(0, toNumber(facts.door_area_total) || 0)
  facts.window_area_total = Math.max(0, toNumber(facts.window_area_total) || 0)

  const columnCount = toInt(facts.column_count) || 0
  facts.column_linear_total = toNumber(facts.column_linear_total) ?? (columnCount * floorHeight * floors)
}

function buildBasicMetrics(facts: Record<string, any>) {
  return {
    footprint_area_m2: toNumber(facts.footprint_area) || 0,
    main_floor_area_total_m2: toNumber(facts.main_floor_area_total) || 0,
    tum_area_total_m2: toNumber(facts.tum_area_total) || 0,
    slab_area_total_m2: toNumber(facts.slab_area_total) || 0,
    ceiling_area_total_m2: toNumber(facts.ceiling_area_total) || 0,
    wall_length_total_m: toNumber(facts.wall_length_total) || 0,
    wall_surface_area_total_m2: toNumber(facts.wall_surface_area_total) || 0,
    column_count: toInt(facts.column_count) || 0,
    column_linear_total_m: toNumber(facts.column_linear_total) || 0,
    floor_height_m: toNumber(facts.floor_height_m) || 3,
    stair_void_area_m2: toNumber(facts.stair_void_area) || 0,
  }
}

function isRuleMatched(conditions: any[], facts: Record<string, any>) {
  for (const c of conditions) {
    const key = String(c.fact_key || '')
    const op = String(c.operator || '').toLowerCase()
    const left = facts[key]
    const right = c.value_number ?? c.value_text ?? c.value_json
    if (!compare(left, op, right)) return false
  }
  return true
}

function compare(left: any, op: string, right: any) {
  if (op === 'eq') return String(left) === String(right)
  if (op === 'neq') return String(left) !== String(right)
  if (op === 'gt') return Number(left) > Number(right)
  if (op === 'gte') return Number(left) >= Number(right)
  if (op === 'lt') return Number(left) < Number(right)
  if (op === 'lte') return Number(left) <= Number(right)
  if (op === 'in') {
    const arr = Array.isArray(right) ? right : String(right || '').split(',').map((x) => x.trim()).filter(Boolean)
    return arr.includes(String(left))
  }
  if (op === 'between') {
    const arr = Array.isArray(right) ? right : []
    if (arr.length < 2) return false
    const l = Number(left)
    return l >= Number(arr[0]) && l <= Number(arr[1])
  }
  return false
}

async function getActiveRules(quoteDate: Date) {
  const prismaAny = db as any
  return prismaAny.estimationRuleHeader.findMany({
    where: {
      is_active: true,
      OR: [{ effective_from: null }, { effective_from: { lte: quoteDate } }],
      AND: [{ OR: [{ effective_to: null }, { effective_to: { gte: quoteDate } }] }],
    },
    orderBy: [{ priority: 'desc' }, { updated_at: 'desc' }],
    include: {
      conditions: { orderBy: { sort_order: 'asc' } },
      actions: { orderBy: { sort_order: 'asc' } },
    },
  })
}

function calcConfidence(input: {
  source: string
  missingCount: number
  matchedRuleCount: number
  similarity: number
}) {
  let score = 0.65
  if (input.source === 'case_based') score += 0.18
  if (input.source === 'base_cost_only') score -= 0.12
  score += Math.min(0.1, input.matchedRuleCount * 0.015)
  score += Math.min(0.08, input.similarity * 0.08)
  score -= Math.min(0.25, input.missingCount * 0.04)
  return round2(Math.max(0.1, Math.min(0.98, score)))
}

function calcFeatureCoefficient(input: {
  floors: number
  tum_count: number
  basement_count: number
  has_elevator: boolean
  finish_level: string
  cfg: {
    floors_threshold: number
    floors_coeff_per_extra: number
    tum_coeff: number
    basement_coeff: number
    elevator_coeff: number
    finish_co_ban_multiplier: number
    finish_tieu_chuan_multiplier: number
    finish_cao_cap_multiplier: number
  }
}) {
  let coeff = 1
  if (input.floors > input.cfg.floors_threshold) {
    coeff += (input.floors - input.cfg.floors_threshold) * input.cfg.floors_coeff_per_extra
  }
  if (input.tum_count > 0) coeff += input.tum_count * input.cfg.tum_coeff
  if (input.basement_count > 0) coeff += input.basement_count * input.cfg.basement_coeff
  if (input.has_elevator) coeff += input.cfg.elevator_coeff

  const finishMap: Record<string, number> = {
    co_ban: input.cfg.finish_co_ban_multiplier,
    tieu_chuan: input.cfg.finish_tieu_chuan_multiplier,
    cao_cap: input.cfg.finish_cao_cap_multiplier,
  }
  coeff *= finishMap[input.finish_level] || finishMap.tieu_chuan
  return round2(coeff)
}

async function getCoefficientConfig() {
  const prismaAny = db as any
  const row = await prismaAny.estimationCoefficientConfig.findUnique({ where: { id: 'default' } })
  if (!row) return DEFAULT_COEFFICIENTS
  return {
    floors_threshold: row.floors_threshold,
    floors_coeff_per_extra: row.floors_coeff_per_extra,
    tum_coeff: row.tum_coeff,
    basement_coeff: row.basement_coeff,
    elevator_coeff: row.elevator_coeff,
    finish_co_ban_multiplier: row.finish_co_ban_multiplier,
    finish_tieu_chuan_multiplier: row.finish_tieu_chuan_multiplier,
    finish_cao_cap_multiplier: row.finish_cao_cap_multiplier,
  }
}

async function findMaterialPrice(
  materialKey: string,
  regionCode: string,
  quoteDate: Date,
  pricingPolicy: PricingPolicy,
  preferredSupplierKey: string | null,
  supplierMatchMode: 'preferred_first' | 'only_preferred' | 'ignore'
) {
  const exactRows = await loadCandidatePriceRows({
    materialKey,
    regionCode,
    quoteDate,
    exactRegionOnly: true,
  })
  const exact = pickPriceByPolicy(
    filterRowsBySupplier(exactRows as any[], preferredSupplierKey, supplierMatchMode),
    pricingPolicy
  )
  if (exact) {
    return {
      unit_price: Number(exact.price_per_unit),
      unit: exact.unit,
      source: buildPriceSource('exact_region', pricingPolicy, preferredSupplierKey, supplierMatchMode, exact.source_note),
      selection: buildPriceSelection({
        row: exact,
        materialKey,
        pricingPolicy,
        matchSource: 'exact_region',
        preferredSupplierKey,
        supplierMatchMode,
      }),
    }
  }
  const fallbackRows = await loadCandidatePriceRows({
    materialKey,
    regionCode,
    quoteDate,
    exactRegionOnly: false,
  })
  const fallback = pickPriceByPolicy(
    filterRowsBySupplier(fallbackRows as any[], preferredSupplierKey, supplierMatchMode),
    pricingPolicy
  )
  if (fallback) {
    return {
      unit_price: Number(fallback.price_per_unit),
      unit: fallback.unit,
      source: buildPriceSource('region_fallback', pricingPolicy, preferredSupplierKey, supplierMatchMode, fallback.source_note),
      selection: buildPriceSelection({
        row: fallback,
        materialKey,
        pricingPolicy,
        matchSource: 'region_fallback',
        preferredSupplierKey,
        supplierMatchMode,
      }),
    }
  }
  return null
}

async function loadCandidatePriceRows(args: {
  materialKey: string
  regionCode: string
  quoteDate: Date
  exactRegionOnly: boolean
}) {
  const legacyRows = await db.estimationMaterialPrice.findMany({
    where: {
      material_key: args.materialKey,
      is_active: true,
      valid_from: { lte: args.quoteDate },
      AND: [
        args.exactRegionOnly
          ? { region_code: args.regionCode }
          : { OR: [{ region_code: 'ALL' }, { region_code: null }] },
        { OR: [{ valid_to: null }, { valid_to: { gte: args.quoteDate } }] },
      ],
    },
    orderBy: [{ valid_from: 'desc' }, { created_at: 'desc' }],
  })

  const supplierRows = await loadSupplierPriceRowsSafe(args)
  const merged = [...legacyRows.map((x) => ({ ...x } as any)), ...supplierRows]

  return merged.sort((a: any, b: any) => {
    const av = a?.valid_from ? new Date(a.valid_from).getTime() : 0
    const bv = b?.valid_from ? new Date(b.valid_from).getTime() : 0
    if (av !== bv) return bv - av
    const ac = a?.created_at ? new Date(a.created_at).getTime() : 0
    const bc = b?.created_at ? new Date(b.created_at).getTime() : 0
    return bc - ac
  })
}

async function loadSupplierPriceRowsSafe(args: {
  materialKey: string
  regionCode: string
  quoteDate: Date
  exactRegionOnly: boolean
}) {
  try {
    const rows = await (db as any).supplierMaterialPrice.findMany({
      where: {
        material_key: args.materialKey,
        is_active: true,
        valid_from: { lte: args.quoteDate },
        AND: [
          args.exactRegionOnly
            ? { region_code: args.regionCode }
            : { OR: [{ region_code: 'ALL' }, { region_code: null }] },
          { OR: [{ valid_to: null }, { valid_to: { gte: args.quoteDate } }] },
          { supplier: { is_active: true } },
        ],
      },
      include: { supplier: true },
      orderBy: [{ valid_from: 'desc' }, { created_at: 'desc' }],
    })

    return (Array.isArray(rows) ? rows : []).map((x: any) => {
      const supplierCode = x?.supplier?.supplier_code ? String(x.supplier.supplier_code).trim() : ''
      const supplierName = x?.supplier?.supplier_name ? String(x.supplier.supplier_name).trim() : ''
      const prefix = supplierCode ? `[supplier:${supplierCode}]` : ''
      const note = String(x?.source_note || '').trim()
      const mergedNote = [prefix, supplierName ? `[supplier_name:${supplierName}]` : '', note]
        .filter(Boolean)
        .join(' ')
        .trim()

      return {
        id: String(x.id),
        material_key: String(x.material_key || args.materialKey),
        unit: x.unit ? String(x.unit) : null,
        price_per_unit: x.price_per_unit,
        region_code: x.region_code ? String(x.region_code) : null,
        source_note: mergedNote || null,
        valid_from: x.valid_from,
        valid_to: x.valid_to,
        created_at: x.created_at,
      }
    })
  } catch {
    return [] as any[]
  }
}

function filterRowsBySupplier(
  rows: any[],
  preferredSupplierKey: string | null,
  mode: 'preferred_first' | 'only_preferred' | 'ignore'
) {
  if (!rows.length) return rows
  if (!preferredSupplierKey || mode === 'ignore') return rows
  const preferredRows = rows.filter((r) => hasSupplierTag(r?.source_note, preferredSupplierKey))
  if (mode === 'only_preferred') return preferredRows
  return preferredRows.length ? preferredRows : rows
}

function hasSupplierTag(sourceNote: unknown, supplierKey: string) {
  const note = String(sourceNote || '').toLowerCase()
  if (!note) return false
  const key = supplierKey.toLowerCase().trim()
  if (!key) return false
  return (
    note.includes(`supplier:${key}`) ||
    note.includes(`supplier=${key}`) ||
    note.includes(`[supplier:${key}]`) ||
    note.includes(`[supplier=${key}]`)
  )
}

function buildPriceSource(
  base: 'exact_region' | 'region_fallback',
  policy: PricingPolicy,
  preferredSupplierKey: string | null,
  mode: 'preferred_first' | 'only_preferred' | 'ignore',
  sourceNote: unknown
) {
  const supplierInRow = extractSupplierTag(sourceNote)
  const pref = preferredSupplierKey ? `pref_${preferredSupplierKey}` : 'pref_none'
  const rowSupplier = supplierInRow ? `row_${supplierInRow}` : 'row_unknown'
  return `${base}_${policy}_${mode}_${pref}_${rowSupplier}`
}

function buildPriceSelection(args: {
  row: any
  materialKey: string
  pricingPolicy: PricingPolicy
  matchSource: 'exact_region' | 'region_fallback'
  preferredSupplierKey: string | null
  supplierMatchMode: 'preferred_first' | 'only_preferred' | 'ignore'
}): PriceSelectionSnapshot {
  const supplierKey = extractSupplierTag(args.row?.source_note)
  return {
    material_key: args.materialKey,
    policy: args.pricingPolicy,
    match_source: args.matchSource,
    match_mode: args.supplierMatchMode,
    preferred_supplier_key: args.preferredSupplierKey,
    supplier_key: supplierKey,
    price_row_id: args.row?.id ? String(args.row.id) : null,
    region_code: args.row?.region_code ? String(args.row.region_code) : null,
    unit: args.row?.unit ? String(args.row.unit) : null,
    unit_price: Number(args.row?.price_per_unit || 0),
    valid_from: args.row?.valid_from ? new Date(args.row.valid_from).toISOString() : null,
    valid_to: args.row?.valid_to ? new Date(args.row.valid_to).toISOString() : null,
    source_note: args.row?.source_note ? String(args.row.source_note) : null,
  }
}

function mergePriceSelections(current: PriceSelectionSnapshot[], incoming: PriceSelectionSnapshot[]) {
  if (!incoming.length) return current
  const map = new Map<string, PriceSelectionSnapshot>()
  for (const x of current) {
    const k = `${x.material_key}|${x.policy}|${x.match_source}|${x.match_mode}|${x.preferred_supplier_key || '-'}|${x.supplier_key || '-'}|${x.price_row_id || '-'}|${x.region_code || '-'}|${x.unit_price}`
    map.set(k, x)
  }
  for (const x of incoming) {
    const k = `${x.material_key}|${x.policy}|${x.match_source}|${x.match_mode}|${x.preferred_supplier_key || '-'}|${x.supplier_key || '-'}|${x.price_row_id || '-'}|${x.region_code || '-'}|${x.unit_price}`
    if (!map.has(k)) map.set(k, x)
  }
  return Array.from(map.values())
}

function extractSupplierTag(sourceNote: unknown) {
  const note = String(sourceNote || '')
  if (!note) return null
  const m = note.match(/supplier\s*[:=]\s*([a-zA-Z0-9_-]+)/i)
  return m?.[1] ? m[1].toLowerCase() : null
}

function pickPriceByPolicy(rows: any[], policy: PricingPolicy) {
  if (!rows.length) return null
  const withPrice = rows
    .map((x) => ({ row: x, price: Number(x.price_per_unit || 0) }))
    .filter((x) => Number.isFinite(x.price) && x.price > 0)
    .sort((a, b) => a.price - b.price)
  if (!withPrice.length) return null

  if (policy === 'lowest') return withPrice[0].row
  if (policy === 'highest') return withPrice[withPrice.length - 1].row
  if (policy === 'premium') {
    const idx = Math.min(withPrice.length - 1, Math.max(0, Math.ceil((withPrice.length - 1) * 0.75)))
    return withPrice[idx].row
  }
  const mid = Math.floor((withPrice.length - 1) / 2)
  return withPrice[mid].row
}

function serializeQuote(quote: any) {
  return {
    ...quote,
    base_cost_per_m2: quote.base_cost_per_m2 ? Number(quote.base_cost_per_m2) : null,
    subtotal_cost: quote.subtotal_cost ? Number(quote.subtotal_cost) : null,
    total_cost: Number(quote.total_cost),
    items: (quote.items || []).map((x: any) => ({
      ...x,
      unit_price: x.unit_price ? Number(x.unit_price) : null,
      cost: Number(x.cost),
    })),
  }
}

function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function sanitizeExtraFacts(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {} as Record<string, number | string | boolean>
  const out: Record<string, number | string | boolean> = {}
  for (const [k, val] of Object.entries(raw as Record<string, unknown>)) {
    const key = normalizeFactKey(k)
    if (!key) continue
    if (typeof val === 'number' && Number.isFinite(val)) {
      out[key] = val
      continue
    }
    if (typeof val === 'boolean') {
      out[key] = val
      continue
    }
    if (typeof val === 'string' && val.trim()) {
      const n = Number(val)
      out[key] = Number.isFinite(n) ? n : val.trim()
    }
  }
  return out
}

function normalizeTemplateApplyMode(v: unknown): 'auto' | 'standard_template' | 'nearest_template' | 'none' {
  const x = String(v || 'auto').trim()
  if (x === 'standard_template' || x === 'nearest_template' || x === 'none') return x
  return 'auto'
}

function normalizePricingPolicy(v: unknown): PricingPolicy {
  const x = String(v || 'standard').trim()
  if (x === 'lowest' || x === 'highest' || x === 'premium') return x
  return 'standard'
}

function normalizeSupplierMatchMode(v: unknown): 'preferred_first' | 'only_preferred' | 'ignore' {
  const x = String(v || 'preferred_first').trim()
  if (x === 'only_preferred' || x === 'ignore') return x
  return 'preferred_first'
}

function normalizeTemplateProfileState(v: unknown): TemplateProfileState {
  const x = String(v || 'validated_by_admin').trim()
  if (x === 'candidate' || x === 'archived') return x
  return 'validated_by_admin'
}

function normalizeFactor(v: unknown) {
  const n = toNumber(v)
  if (n == null || !Number.isFinite(n) || n <= 0) return 1
  return n
}

function buildContextFactors(input: EstimateV2Input) {
  return {
    geo_factor: normalizeFactor(input.geo_factor),
    labor_factor: normalizeFactor(input.labor_factor),
    transport_factor: normalizeFactor(input.transport_factor),
    difficulty_factor: normalizeFactor(input.difficulty_factor),
    market_factor: normalizeFactor(input.market_factor),
  }
}

function round2(v: number) {
  return Math.round(v * 100) / 100
}

function round4(v: number) {
  return Math.round(v * 10000) / 10000
}
