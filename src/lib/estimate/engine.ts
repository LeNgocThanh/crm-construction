import { db } from '@/lib/db'

export type EstimateInput = {
  customer_id?: string | null
  recipe_id?: string | null
  recipe_key?: string | null
  region_code?: string | null
  quote_date?: string | null
  floor_area_total?: number | null
  floors?: number | null
  tum_count?: number | null
  basement_count?: number | null
  has_elevator?: boolean | null
  finish_level?: 'co_ban' | 'tieu_chuan' | 'cao_cap' | string | null
  base_cost_per_m2?: number | null
  created_by?: string | null
}

export type EstimateValidationResult = {
  ok: boolean
  missing_fields: string[]
  suggested_inputs: Record<string, string>
  details: string[]
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

export async function generateEstimate(input: EstimateInput) {
  const prismaAny = db as any

  const area = toNumber(input.floor_area_total) || 0
  if (area <= 0) throw new Error('Thieu hoac sai tong dien tich san')

  const quoteDate = input.quote_date ? new Date(input.quote_date) : new Date()
  const regionCode = (input.region_code || 'ALL').trim()
  const baseCostPerM2 = toNumber(input.base_cost_per_m2) || 0

  const hasRecipeInput = Boolean(input.recipe_id || input.recipe_key)
  const recipe = hasRecipeInput ? await resolveRecipe(input.recipe_id, input.recipe_key) : null
  if (hasRecipeInput && !recipe) throw new Error('Khong tim thay recipe')

  const coeffConfig = await getCoefficientConfig()
  const featureCoeff = calcFeatureCoefficient({
    floors: toInt(input.floors) || 0,
    tum_count: toInt(input.tum_count) || 0,
    basement_count: toInt(input.basement_count) || 0,
    has_elevator: Boolean(input.has_elevator),
    finish_level: (input.finish_level || 'tieu_chuan').toString(),
    cfg: coeffConfig,
  })

  let subtotal = 0
  const items: Array<{
    material_key: string
    material_name: string | null
    unit: string | null
    quantity: number | null
    unit_price: number | null
    ratio_percent: number | null
    cost: number
    price_source: string
    note: string | null
  }> = []

  if (recipe) {
    for (const item of recipe.items) {
      const priceInfo = await findMaterialPrice(item.material_key, regionCode, quoteDate)
      let quantity: number | null = null
      const unitPrice: number | null = priceInfo?.unit_price || null
      let cost = 0
      let priceSource = priceInfo?.source || 'missing_price'

      if (item.quantity_per_m2 != null && unitPrice != null) {
        quantity = item.quantity_per_m2 * area
        const wasteMul = 1 + (item.waste_factor || 0)
        cost = quantity * unitPrice * wasteMul
      } else if (item.ratio_percent != null && baseCostPerM2 > 0) {
        const ratio = item.ratio_percent / 100
        cost = area * baseCostPerM2 * ratio
        priceSource = 'base_ratio'
      }

      subtotal += cost
      items.push({
        material_key: item.material_key,
        material_name: item.material_name || null,
        unit: priceInfo?.unit || null,
        quantity,
        unit_price: unitPrice,
        ratio_percent: item.ratio_percent ?? null,
        cost,
        price_source: priceSource,
        note: item.note || null,
      })
    }
  }

  // Base mode fallback: no recipe or recipe cannot compute but base cost is provided.
  if (subtotal <= 0 && baseCostPerM2 > 0) {
    subtotal = area * baseCostPerM2
  }
  if (subtotal <= 0) {
    throw new Error('Khong du du lieu gia/dinh muc de tinh khai toan')
  }

  const total = subtotal * featureCoeff
  const pricingMode = items.length === 0 && baseCostPerM2 > 0 ? 'base_cost_only' : inferPricingMode(items)

  const quote = await prismaAny.estimationQuote.create({
    data: {
      customer_id: input.customer_id || null,
      recipe_id: recipe?.id || null,
      recipe_key: recipe?.recipe_key || null,
      recipe_name: recipe?.recipe_name || null,
      region_code: regionCode,
      quote_date: quoteDate,
      floor_area_total: area,
      floors: toInt(input.floors),
      tum_count: toInt(input.tum_count),
      basement_count: toInt(input.basement_count),
      has_elevator: input.has_elevator ?? false,
      finish_level: (input.finish_level || 'tieu_chuan').toString(),
      base_cost_per_m2: baseCostPerM2 > 0 ? BigInt(Math.round(baseCostPerM2)) : null,
      coeff_total: featureCoeff,
      subtotal_cost: BigInt(Math.round(subtotal)),
      total_cost: BigInt(Math.round(total)),
      pricing_mode: pricingMode,
      input_snapshot: {
        ...input,
        region_code: regionCode,
      },
      result_snapshot: {
        subtotal,
        total,
        feature_coeff: featureCoeff,
        coefficient_config_used: coeffConfig,
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

  return serializeQuote(quote)
}

export async function validateEstimateInput(input: EstimateInput): Promise<EstimateValidationResult> {
  const missingFields: string[] = []
  const suggestedInputs: Record<string, string> = {}
  const details: string[] = []

  const area = toNumber(input.floor_area_total) || 0
  if (area <= 0) {
    missingFields.push('floor_area_total')
    suggestedInputs.floor_area_total = 'Tong dien tich san (m2), vi du: 250'
  }

  const quoteDate = input.quote_date ? new Date(input.quote_date) : new Date()
  const regionCode = (input.region_code || 'ALL').trim()
  const baseCostPerM2 = toNumber(input.base_cost_per_m2) || 0
  const hasBase = baseCostPerM2 > 0
  const hasRecipeInput = Boolean(input.recipe_id || input.recipe_key)

  let recipe = null as Awaited<ReturnType<typeof resolveRecipe>> | null
  if (hasRecipeInput) {
    recipe = await resolveRecipe(input.recipe_id, input.recipe_key)
    if (!recipe) {
      missingFields.push('recipe_not_found')
      suggestedInputs.recipe_not_found = 'Recipe khong ton tai hoac da bi xoa'
    }
  }

  if (!hasRecipeInput && !hasBase) {
    missingFields.push('recipe_or_base_cost')
    suggestedInputs.recipe_or_base_cost = 'Chon recipe hoac nhap base_cost_per_m2'
  }

  if (!recipe) {
    return {
      ok: missingFields.length === 0,
      missing_fields: dedupe(missingFields),
      suggested_inputs: suggestedInputs,
      details,
    }
  }

  if (!recipe.items.length) {
    missingFields.push('recipe_items_empty')
    suggestedInputs.recipe_items_empty = 'Recipe nay chua co item vat tu'
    return {
      ok: false,
      missing_fields: dedupe(missingFields),
      suggested_inputs: suggestedInputs,
      details,
    }
  }

  const invalidItems: string[] = []
  const ratioNeedsBase: string[] = []
  const qtyNeedsPrice: string[] = []
  let computableCount = 0

  for (const item of recipe.items) {
    const hasRatio = item.ratio_percent != null
    const hasQty = item.quantity_per_m2 != null

    if (hasRatio === hasQty) {
      invalidItems.push(item.material_key)
      continue
    }

    if (hasRatio) {
      if (hasBase) computableCount += 1
      else ratioNeedsBase.push(item.material_key)
      continue
    }

    const priceInfo = await findMaterialPrice(item.material_key, regionCode, quoteDate)
    if (priceInfo?.unit_price != null) computableCount += 1
    else qtyNeedsPrice.push(item.material_key)
  }

  if (invalidItems.length > 0) {
    missingFields.push('recipe_item_ratio_or_qty')
    suggestedInputs.recipe_item_ratio_or_qty = 'Moi item phai co dung 1 trong 2: ratio_percent hoac quantity_per_m2'
    details.push(`Item sai dinh dang (recipe): ${invalidItems.join(', ')}`)
  }

  if (ratioNeedsBase.length > 0 && !hasBase) {
    missingFields.push('base_cost_per_m2_for_ratio_items')
    suggestedInputs.base_cost_per_m2_for_ratio_items = 'Item dang dung ratio_percent can base_cost_per_m2 de tinh thanh tien'
    details.push(`Item ratio can base_cost_per_m2: ${ratioNeedsBase.join(', ')}`)
  }

  if (qtyNeedsPrice.length > 0) {
    missingFields.push('material_price_for_qty_items')
    suggestedInputs.material_price_for_qty_items = `Can bang gia vat tu theo region_code=${regionCode} hoac ALL`
    details.push(`Thieu gia vat tu cho item qty/m2: ${qtyNeedsPrice.join(', ')}`)
  }

  if (computableCount <= 0 && !hasBase) {
    missingFields.push('no_computable_cost_source')
    suggestedInputs.no_computable_cost_source = 'Can it nhat 1 item tinh duoc tu gia vat tu hoac nhap base_cost_per_m2'
  }

  return {
    ok: missingFields.length === 0,
    missing_fields: dedupe(missingFields),
    suggested_inputs: suggestedInputs,
    details,
  }
}

export async function listRecentQuotes(customerId?: string | null, limit = 20) {
  const prismaAny = db as any
  const data = await prismaAny.estimationQuote.findMany({
    where: customerId ? { customer_id: customerId } : undefined,
    orderBy: { created_at: 'desc' },
    take: limit,
    include: { items: true },
  })
  return data.map(serializeQuote)
}

async function resolveRecipe(recipeId?: string | null, recipeKey?: string | null) {
  if (recipeId) {
    return db.estimationRecipe.findUnique({
      where: { id: recipeId },
      include: { items: { orderBy: { sort_order: 'asc' } } },
    })
  }
  if (recipeKey) {
    return db.estimationRecipe.findUnique({
      where: { recipe_key: recipeKey },
      include: { items: { orderBy: { sort_order: 'asc' } } },
    })
  }

  return db.estimationRecipe.findFirst({
    where: { is_active: true },
    orderBy: { updated_at: 'desc' },
    include: { items: { orderBy: { sort_order: 'asc' } } },
  })
}

async function findMaterialPrice(materialKey: string, regionCode: string, quoteDate: Date) {
  const exact = await db.estimationMaterialPrice.findFirst({
    where: {
      material_key: materialKey,
      is_active: true,
      region_code: regionCode,
      valid_from: { lte: quoteDate },
      OR: [{ valid_to: null }, { valid_to: { gte: quoteDate } }],
    },
    orderBy: { valid_from: 'desc' },
  })
  if (exact) {
    return {
      unit_price: Number(exact.price_per_unit),
      unit: exact.unit,
      source: 'exact_region',
    }
  }

  const fallback = await db.estimationMaterialPrice.findFirst({
    where: {
      material_key: materialKey,
      is_active: true,
      valid_from: { lte: quoteDate },
      AND: [
        { OR: [{ region_code: 'ALL' }, { region_code: null }] },
        { OR: [{ valid_to: null }, { valid_to: { gte: quoteDate } }] },
      ],
    },
    orderBy: { valid_from: 'desc' },
  })
  if (fallback) {
    return {
      unit_price: Number(fallback.price_per_unit),
      unit: fallback.unit,
      source: 'region_fallback',
    }
  }

  return null
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
  const row = await prismaAny.estimationCoefficientConfig.findUnique({
    where: { id: 'default' },
  })
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

function inferPricingMode(items: Array<{ price_source: string }>) {
  const unique = Array.from(new Set(items.map((x) => x.price_source)))
  if (unique.length === 0) return 'base_cost_only'
  if (unique.length === 1) return unique[0]
  return 'mixed'
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

function round2(v: number) {
  return Math.round(v * 100) / 100
}

function dedupe(items: string[]) {
  return Array.from(new Set(items))
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
