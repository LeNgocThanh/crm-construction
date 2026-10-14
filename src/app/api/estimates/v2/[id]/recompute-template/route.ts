import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

type SupplierMode = 'preferred_first' | 'only_preferred' | 'ignore'
type PricingPolicy = 'lowest' | 'highest' | 'standard' | 'premium'

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function toInt(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.trunc(n)
}
function round2(n: number) {
  return Math.round(n * 100) / 100
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
function normalizePricingPolicy(v: unknown): PricingPolicy {
  const x = String(v || '').trim().toLowerCase()
  if (x === 'lowest' || x === 'highest' || x === 'premium') return x
  return 'standard'
}
function normalizeSupplierMode(v: unknown): SupplierMode {
  const x = String(v || '').trim().toLowerCase()
  if (x === 'only_preferred' || x === 'ignore') return x
  return 'preferred_first'
}
function parseTemplateNote(note: unknown) {
  const raw = String(note || '').trim()
  if (!raw.startsWith('template:')) return null
  const body = raw.slice('template:'.length).trim()
  if (!body) return null
  const [codeVerRaw] = body.split('|')
  const codeVer = String(codeVerRaw || '').trim()
  const at = codeVer.indexOf('@v')
  if (at < 0) return null
  const code = codeVer.slice(0, at).trim()
  const version = Number(codeVer.slice(at + 2).trim())
  if (!code || !Number.isFinite(version)) return null
  return { key: `${code}@v${version}`, code, version }
}

function normalizeFactKey(v: unknown) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function sanitizeExtraFacts(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {} as Record<string, number | string | boolean>
  const out: Record<string, number | string | boolean> = {}
  for (const [k, val] of Object.entries(raw as Record<string, unknown>)) {
    const key = normalizeFactKey(k)
    if (!key) continue
    if (typeof val === 'number' && Number.isFinite(val)) out[key] = val
    else if (typeof val === 'boolean') out[key] = val
    else if (typeof val === 'string' && val.trim()) {
      const n = Number(val)
      out[key] = Number.isFinite(n) ? n : val.trim()
    }
  }
  return out
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

function deriveTumAreaFromSnapshot(inputSnapshot: Record<string, any>, footprintArea: number) {
  const mode = String(inputSnapshot?.tum_area_mode || '').trim().toLowerCase()
  const tumAreaM2 = toNumber(inputSnapshot?.tum_area_m2)
  const percentRaw = toNumber(inputSnapshot?.tum_area_percent)
  const percent = percentRaw == null ? null : Math.max(0, Math.min(100, percentRaw))
  if (mode === 'm2' && tumAreaM2 != null) return Math.max(0, tumAreaM2)
  if (mode === 'percent' && percent != null) return Math.max(0, footprintArea * (percent / 100))
  if (tumAreaM2 != null) return Math.max(0, tumAreaM2)
  if (percent != null) return Math.max(0, footprintArea * (percent / 100))
  return 0
}

function buildFactsFromInput(inputSnapshot: Record<string, any>, area: number) {
  const floors = toInt(inputSnapshot?.floors)
  const floorHeight = toNumber(inputSnapshot?.floor_height_m) || 3
  const length = toNumber(inputSnapshot?.build_length_m) || 0
  const width = toNumber(inputSnapshot?.build_width_m) || 0
  const footprintArea = length > 0 && width > 0
    ? length * width
    : (floors > 0 ? area / Math.max(1, floors) : area)

  const stairVoidAreaRaw = toNumber(inputSnapshot?.stair_void_area) || 0
  const stairVoidArea = Math.max(0, Math.min(stairVoidAreaRaw, footprintArea))
  const slabNetArea = Math.max(0, footprintArea - stairVoidArea)
  const tumAreaTotal = deriveTumAreaFromSnapshot(inputSnapshot, footprintArea)
  const mainFloorAreaTotal = footprintArea > 0 && floors > 0
    ? footprintArea * floors
    : Math.max(0, area)
  const middleFloorCount = Math.max(0, floors - 2)
  const slabAreaTotal = floors <= 0 ? 0 : floors === 1 ? footprintArea : footprintArea + middleFloorCount * slabNetArea
  const ceilingAreaTotal = floors <= 0 ? 0 : floors === 1 ? footprintArea : middleFloorCount * slabNetArea + footprintArea

  const perimeter = length > 0 && width > 0 ? 2 * (length + width) : 0
  const roomCount = toInt(inputSnapshot?.bedroom_count) + toInt(inputSnapshot?.kitchen_count) + toInt(inputSnapshot?.living_room_count)
  const wcCount = toInt(inputSnapshot?.wc_count)
  const wcPerimeter = toNumber(inputSnapshot?.wc_perimeter_m) || 8
  const wallLengthTotal = perimeter * floors + width * 2 * roomCount + wcCount * wcPerimeter
  const wallSurfaceAreaTotal = wallLengthTotal * floorHeight

  const columnCount = 0
  const columnLinearTotal = columnCount * floorHeight * floors

  const facts = {
    area,
    floor_area_total: area,
    main_floor_area_total: mainFloorAreaTotal,
    tum_area_total: tumAreaTotal,
    floor_area_without_tum: Math.max(0, mainFloorAreaTotal),
    floors,
    tum_count: toInt(inputSnapshot?.tum_count),
    floor_count_total: floors + toInt(inputSnapshot?.tum_count),
    basement_count: toInt(inputSnapshot?.basement_count),
    has_elevator: inputSnapshot?.has_elevator ? 1 : 0,
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
    wall_surface_area_total: wallSurfaceAreaTotal,
    column_count: columnCount,
    column_linear_total: columnLinearTotal,
    finish_level: String(inputSnapshot?.finish_level || 'tieu_chuan'),
    house_type: String(inputSnapshot?.house_type || ''),
    style: String(inputSnapshot?.style || 'mac_dinh'),
    foundation_type: String(inputSnapshot?.foundation_type || 'mong_bang'),
    bedroom_count: toInt(inputSnapshot?.bedroom_count),
    wc_count: wcCount,
    kitchen_count: toInt(inputSnapshot?.kitchen_count),
    living_room_count: toInt(inputSnapshot?.living_room_count),
  } as Record<string, any>

  const extraFacts = sanitizeExtraFacts(inputSnapshot?.extra_facts_json)
  for (const [k, v] of Object.entries(extraFacts)) {
    if (facts[k] === undefined) facts[k] = v
    facts[`extra_${k}`] = v
  }
  return facts
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
function getRoomCount(roomType: string | null, facts: Record<string, any>) {
  if (!roomType) return 1
  const k = roomType.toLowerCase()
  if (k.includes('bed')) return toInt(facts.bedroom_count)
  if (k.includes('wc') || k.includes('toilet')) return toInt(facts.wc_count)
  if (k.includes('kitchen') || k.includes('bep')) return toInt(facts.kitchen_count)
  if (k.includes('living') || k.includes('khach')) return toInt(facts.living_room_count)
  return 1
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
    if (isTumScope(scopeKey)) return qv * (toNumber(facts.tum_area_total) || 0)
    if (isRoomScope(scopeKey)) return qv * (toNumber(facts.main_floor_area_total) || toNumber(facts.slab_area_total) || area)
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
  if (applyMode === 'per_room') return qv * getRoomCount(roomType, facts)
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
  if (basisKey) return toNumber(facts[basisKey]) || 0
  if (isTumScope(scopeKey)) return toNumber(facts.tum_area_total) || 0
  if (isRoomScope(scopeKey)) return toNumber(facts.main_floor_area_total) || toNumber(facts.slab_area_total) || area
  if (isFloorScope(scopeKey)) return toNumber(facts.slab_area_total) || area
  if (isCeilingScope(scopeKey)) return toNumber(facts.ceiling_area_total) || area
  if (isWallScope(scopeKey)) return toNumber(facts.wall_surface_area_total) || toNumber(facts.wall_length_total) || area
  if (isColumnScope(scopeKey)) return toNumber(facts.column_linear_total) || 0
  return area
}

function hasSupplierTag(sourceNote: unknown, supplierKey: string) {
  const note = String(sourceNote || '').toLowerCase()
  if (!note) return false
  const key = supplierKey.toLowerCase().trim()
  if (!key) return false
  return note.includes(`supplier:${key}`) || note.includes(`supplier=${key}`) || note.includes(`[supplier:${key}]`) || note.includes(`[supplier=${key}]`)
}

async function loadPriceRows(materialKey: string, regionCode: string, quoteDate: Date, exact: boolean) {
  const legacyRows = await db.estimationMaterialPrice.findMany({
    where: {
      material_key: materialKey,
      is_active: true,
      valid_from: { lte: quoteDate },
      AND: [
        exact ? { region_code: regionCode } : { OR: [{ region_code: 'ALL' }, { region_code: null }] },
        { OR: [{ valid_to: null }, { valid_to: { gte: quoteDate } }] },
      ],
    },
    orderBy: [{ valid_from: 'desc' }, { created_at: 'desc' }],
  })

  let supplierRows: any[] = []
  try {
    const rows = await (db as any).supplierMaterialPrice.findMany({
      where: {
        material_key: materialKey,
        is_active: true,
        valid_from: { lte: quoteDate },
        AND: [
          exact ? { region_code: regionCode } : { OR: [{ region_code: 'ALL' }, { region_code: null }] },
          { OR: [{ valid_to: null }, { valid_to: { gte: quoteDate } }] },
          { supplier: { is_active: true } },
        ],
      },
      include: { supplier: true },
      orderBy: [{ valid_from: 'desc' }, { created_at: 'desc' }],
    })
    supplierRows = (Array.isArray(rows) ? rows : []).map((x: any) => {
      const supplierCode = x?.supplier?.supplier_code ? String(x.supplier.supplier_code).trim() : ''
      const supplierName = x?.supplier?.supplier_name ? String(x.supplier.supplier_name).trim() : ''
      const prefix = supplierCode ? `[supplier:${supplierCode}]` : ''
      const note = String(x?.source_note || '').trim()
      return {
        id: String(x.id),
        material_key: String(x.material_key || materialKey),
        unit: x.unit ? String(x.unit) : null,
        price_per_unit: x.price_per_unit,
        region_code: x.region_code ? String(x.region_code) : null,
        source_note: [prefix, supplierName ? `[supplier_name:${supplierName}]` : '', note].filter(Boolean).join(' ').trim() || null,
        valid_from: x.valid_from,
        valid_to: x.valid_to,
        created_at: x.created_at,
      }
    })
  } catch {
    supplierRows = []
  }
  return [...legacyRows.map((x) => ({ ...x } as any)), ...supplierRows]
}

function pickPriceByPolicy(rows: any[], policy: PricingPolicy) {
  if (!rows.length) return null
  const sorted = [...rows].sort((a, b) => Number(a.price_per_unit) - Number(b.price_per_unit))
  if (policy === 'lowest') return sorted[0]
  if (policy === 'highest') return sorted[sorted.length - 1]
  if (policy === 'premium') return sorted[Math.floor((sorted.length - 1) * 0.75)]
  return sorted[Math.floor((sorted.length - 1) * 0.5)]
}

async function findMaterialPriceForTemplate(args: {
  materialKey: string
  regionCode: string
  quoteDate: Date
  pricingPolicy: PricingPolicy
  preferredSupplierKey: string | null
  supplierMatchMode: SupplierMode
  forcedSupplierKey: string | null
}) {
  const select = (rows: any[]) => {
    let filtered = rows
    const supplierKey = args.forcedSupplierKey || args.preferredSupplierKey
    const mode: SupplierMode = args.forcedSupplierKey ? 'only_preferred' : args.supplierMatchMode
    if (supplierKey && mode !== 'ignore') {
      const preferredRows = filtered.filter((r) => hasSupplierTag(r?.source_note, supplierKey))
      if (mode === 'only_preferred') filtered = preferredRows
      else filtered = preferredRows.length ? preferredRows : filtered
    }
    return pickPriceByPolicy(filtered, args.pricingPolicy)
  }

  const exact = select(await loadPriceRows(args.materialKey, args.regionCode, args.quoteDate, true))
  if (exact) return exact
  const fallback = select(await loadPriceRows(args.materialKey, args.regionCode, args.quoteDate, false))
  return fallback
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const templateKey = String(body?.template_key || '').trim()
  const replacementTemplateId = String(body?.replacement_template_id || '').trim() || null
  const supplierOverrides = (body?.supplier_overrides || {}) as Record<string, string | null | undefined>
  if (!templateKey) return NextResponse.json({ error: 'Thieu template_key' }, { status: 400 })

  const prismaAny = db as any
  const quote = await prismaAny.estimationQuote.findUnique({
    where: { id: params.id },
    include: { items: true },
  })
  if (!quote) return NextResponse.json({ error: 'Khong tim thay du toan' }, { status: 404 })

  const affectedOldItems = (quote.items || []).filter((it: any) => {
    const p = parseTemplateNote(it.note)
    return p?.key === templateKey
  })
  if (!affectedOldItems.length) {
    return NextResponse.json({ error: 'Khong tim thay nhom template can thay' }, { status: 400 })
  }

  const currentParsed = parseTemplateNote(affectedOldItems[0]?.note)
  if (!currentParsed) return NextResponse.json({ error: 'Template note khong hop le' }, { status: 400 })

  const currentHeader = await prismaAny.estimationTemplateHeader.findFirst({
    where: { template_code: currentParsed.code, version: currentParsed.version },
    include: { items: { where: { is_active: true }, include: { catalog_item: true }, orderBy: { sort_order: 'asc' } } },
  })
  if (!currentHeader) return NextResponse.json({ error: 'Khong tim thay template hien tai' }, { status: 404 })

  let replacementHeader = currentHeader
  if (replacementTemplateId) {
    const found = await prismaAny.estimationTemplateHeader.findUnique({
      where: { id: replacementTemplateId },
      include: { items: { where: { is_active: true }, include: { catalog_item: true }, orderBy: { sort_order: 'asc' } } },
    })
    if (!found) return NextResponse.json({ error: 'Template thay the khong ton tai' }, { status: 404 })
    if (normalizeTemplateKey(found.template_type) !== normalizeTemplateKey(currentHeader.template_type)) {
      return NextResponse.json({ error: 'Chi duoc thay template cung template_type' }, { status: 400 })
    }
    replacementHeader = found
  }

  const inputSnapshot = (quote.input_snapshot || {}) as Record<string, any>
  const area = toNumber(quote.floor_area_total) || toNumber(inputSnapshot?.floor_area_total) || 0
  if (area <= 0) return NextResponse.json({ error: 'Khong co dien tich hop le de tinh lai' }, { status: 400 })

  const quoteDate = quote.quote_date ? new Date(quote.quote_date) : new Date()
  const regionCode = String(quote.region_code || inputSnapshot?.region_code || 'ALL')
  const pricingPolicy = normalizePricingPolicy(inputSnapshot?.pricing_policy)
  const preferredSupplierKey = String(inputSnapshot?.preferred_supplier_key || '').trim() || null
  const supplierMode = normalizeSupplierMode(inputSnapshot?.supplier_match_mode)
  const facts = buildFactsFromInput(inputSnapshot, area)

  const newGroupItems: any[] = []
  let newGroupSubtotal = 0
  const warnings: string[] = []

  for (const tItem of replacementHeader.items || []) {
    const qty = calcTemplateQuantity(tItem, area, tItem.scope_key || replacementHeader.room_type, facts)
    if (!qty || qty <= 0) continue
    const materialKey = String(tItem.catalog_item?.item_code || '')
    if (!materialKey) continue
    const forcedSupplierKey = String(supplierOverrides[materialKey] || '').trim() || null
    const picked = await findMaterialPriceForTemplate({
      materialKey,
      regionCode,
      quoteDate,
      pricingPolicy,
      preferredSupplierKey,
      supplierMatchMode: supplierMode,
      forcedSupplierKey,
    })
    const unitPrice = picked ? Number(picked.price_per_unit || 0) : null
    const waste = 1 + (toNumber(tItem.waste_factor) || 0)
    const cost = unitPrice != null ? qty * unitPrice * waste : 0
    if (unitPrice == null) {
      warnings.push(`Thieu gia: ${materialKey} (${tItem.catalog_item?.item_name || ''})`)
    }
    newGroupItems.push({
      material_key: materialKey,
      material_name: tItem.catalog_item?.item_name || null,
      unit: tItem.catalog_item?.item_unit || null,
      quantity: round2(qty),
      unit_price: unitPrice,
      cost: Math.round(cost),
      price_source: forcedSupplierKey ? `forced_supplier:${forcedSupplierKey}` : `policy:${pricingPolicy}`,
      note: `template:${replacementHeader.template_code}@v${replacementHeader.version}|${String(replacementHeader.template_name || '').trim()}`,
    })
    newGroupSubtotal += cost
  }

  const oldGroupSubtotal = affectedOldItems.reduce((s: number, x: any) => s + Number(x.cost || 0), 0)
  const oldSubtotal = Number(quote.subtotal_cost || 0)
  const oldTotal = Number(quote.total_cost || 0)
  const newSubtotal = Math.max(0, oldSubtotal - oldGroupSubtotal + newGroupSubtotal)
  const multiplier = oldSubtotal > 0 ? oldTotal / oldSubtotal : 1
  const newTotal = Math.round(newSubtotal * multiplier)

  return NextResponse.json({
    data: {
      quote_id: quote.id,
      template_key: templateKey,
      old_template: {
        template_id: currentHeader.id,
        template_code: currentHeader.template_code,
        template_name: currentHeader.template_name,
        template_type: currentHeader.template_type,
        version: currentHeader.version,
      },
      new_template: {
        template_id: replacementHeader.id,
        template_code: replacementHeader.template_code,
        template_name: replacementHeader.template_name,
        template_type: replacementHeader.template_type,
        version: replacementHeader.version,
      },
      old_group_subtotal: Math.round(oldGroupSubtotal),
      new_group_subtotal: Math.round(newGroupSubtotal),
      totals: {
        old_subtotal: Math.round(oldSubtotal),
        new_subtotal: Math.round(newSubtotal),
        old_total: Math.round(oldTotal),
        new_total: Math.round(newTotal),
      },
      old_group_items: affectedOldItems.map((x: any) => ({
        id: x.id,
        material_key: x.material_key,
        material_name: x.material_name,
        unit: x.unit,
        quantity: x.quantity,
        unit_price: x.unit_price != null ? Number(x.unit_price) : null,
        cost: Number(x.cost || 0),
        note: x.note,
      })),
      new_group_items: newGroupItems,
      warnings,
      supplier_overrides: supplierOverrides,
      changed_only_this_template: true,
    },
  })
}
