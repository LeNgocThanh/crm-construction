'use client'

import { useEffect, useMemo, useState } from 'react'
import { getAssemblyComponentVisual } from '@/lib/estimate/block-visuals'

type Taxonomy = {
  id: string
  kind: string
  value: string
  name: string
  description?: string | null
  is_active: boolean
}

type CatalogItem = {
  id: string
  item_code: string
  item_name: string
  item_type: string
  item_group: string
  item_unit: string
  is_active: boolean
}

type TemplateItem = {
  id: string
  catalog_item_id: string
  apply_mode: string
  quantity_basis_key?: string | null
  scope_key?: string | null
  quantity_value?: number | null
  formula_expr?: string | null
  required_facts?: string[] | null
  waste_factor?: number | null
  sort_order: number
  is_active: boolean
  catalog_item?: CatalogItem
}

type TemplateHeader = {
  id: string
  template_code: string
  template_name: string
  template_type: string
  house_type?: string | null
  style?: string | null
  finish_level?: string | null
  room_type?: string | null
  priority: number
  version: number
  is_active: boolean
  items: TemplateItem[]
}

type RuleCondition = {
  id: string
  fact_key: string
  operator: string
  value_text?: string | null
  value_number?: number | null
  sort_order?: number
}

type RuleAction = {
  id: string
  action_type: string
  target_key?: string | null
  value_text?: string | null
  value_number?: number | null
  formula_expr?: string | null
  sort_order?: number
}

type RuleHeader = {
  id: string
  rule_code: string
  rule_name: string
  scope: string
  priority: number
  version: number
  is_active: boolean
  conditions: RuleCondition[]
  actions: RuleAction[]
}

const RULE_ACTION_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'set_field', label: 'Gán giá trị vào Fact (set_field)' },
  { value: 'multiply_coeff', label: 'Nhân hệ số (multiply_coeff)' },
  { value: 'add_warning', label: 'Thêm cảnh báo (add_warning)' },
  { value: 'suggest_value', label: 'Gợi ý giá trị (suggest_value)' },
  { value: 'add_item', label: 'Thêm hạng mục vào kết quả (add_item)' },
]

const APPLY_MODE_OPTIONS: Array<{ value: string; label: string; hint: string }> = [
  { value: 'per_area', label: 'Theo diện tích / khối lượng', hint: 'Lấy một chỉ số nền rồi nhân với hệ số' },
  { value: 'per_unit', label: 'Theo đơn vị đếm', hint: 'Tính theo số phòng, số block, số lần...' },
  { value: 'fixed', label: 'Số lượng cố định', hint: 'Luôn ra một số lượng cố định cho phạm vi này' },
  { value: 'formula', label: 'Theo công thức', hint: 'Tính bằng biểu thức tùy chỉnh từ các fact' },
  { value: 'per_m2', label: 'Legacy: theo m2', hint: 'Cơ chế cũ, nên chuyển dần sang per_area' },
  { value: 'per_room', label: 'Legacy: theo phòng', hint: 'Cơ chế cũ, nên chuyển dần sang per_unit' },
]

const PREVIEW_FACT_DEFAULTS: Record<string, number> = {
  footprint_area: 20,
  floor_area_total: 20,
  main_floor_area_total: 20,
  gross_wall_area_total: 54,
  net_wall_area_total: 50,
  wall_surface_area_total: 50,
  wall_surface_area_gross: 54,
  wall_surface_area_net: 50,
  wall_area_total: 50,
  ceiling_area_total: 20,
  room_count: 1,
  opening_area_total: 4,
  opening_count_total: 2,
  door_count_total: 1,
  window_count_total: 1,
  vent_count_total: 0,
  door_area_total: 2,
  window_area_total: 2,
  perimeter_total: 18,
  block_count: 1,
  quantity: 1,
}

const FACT_KEY_LABELS: Record<string, string> = {
  footprint_area: 'Diện tích footprint',
  floor_area_total: 'Diện tích sàn',
  main_floor_area_total: 'Diện tích sàn chính',
  gross_wall_area_total: 'Diện tích tường thô',
  net_wall_area_total: 'Diện tích tường sau trừ ô mở',
  wall_surface_area_total: 'Diện tích tường',
  wall_surface_area_gross: 'Diện tích tường thô',
  wall_surface_area_net: 'Diện tích tường thuần',
  wall_area_total: 'Diện tích tường',
  ceiling_area_total: 'Diện tích trần',
  room_count: 'Số phòng',
  opening_area_total: 'Diện tích ô mở',
  opening_count_total: 'Tổng số ô mở',
  door_count_total: 'Số cửa đi',
  window_count_total: 'Số cửa sổ',
  vent_count_total: 'Số ô thoáng',
  door_area_total: 'Tổng diện tích cửa đi',
  window_area_total: 'Tổng diện tích cửa sổ',
  perimeter_total: 'Chu vi',
  block_count: 'Số block',
  quantity: 'Số lượng',
  room_type: 'Loại phòng / phạm vi',
  length_m: 'Chiều dài',
  width_m: 'Chiều rộng',
  height_m: 'Chiều cao',
  openings_area: 'Diện tích ô mở',
}

const COMPONENT_FIELD_MATRIX: Array<{
  componentType: string
  component: string
  meaning: string
  allowed: string[]
  hidden: string[]
}> = [
  {
    componentType: 'room',
    component: 'Phòng',
    meaning: 'Khối không gian chính để bóc công năng, nội thất cơ bản và ô mở.',
    allowed: ['Loại phòng', 'Không gian chính', 'Mức không gian', 'Interior preset', 'Opening preset', 'Openings[]', 'Co tran / son / dien / nuoc / cua so / cua di'],
    hidden: ['Loại móng', 'Preset mái', 'Preset cầu thang'],
  },
  {
    componentType: 'wall',
    component: 'Tường',
    meaning: 'Khối bao che hoặc vách, ưu tiên phục vụ bóc tường và ô mở.',
    allowed: ['Diện tích tường', 'Chiều dài tường', 'Opening preset', 'Openings[]', 'Co cua so', 'Co cua di'],
    hidden: ['Loại phòng', 'Không gian chính', 'Mức không gian', 'Loại móng', 'Preset mái', 'Preset cầu thang', 'Interior preset'],
  },
  {
    componentType: 'foundation',
    component: 'Móng',
    meaning: 'Khối kết cấu móng, chỉ cần loại móng và hình học.',
    allowed: ['Loại móng'],
    hidden: ['Loại phòng', 'Không gian chính', 'Mức không gian', 'Openings[]', 'Preset mái', 'Preset cầu thang', 'Interior preset', 'Checkbox feature'],
  },
  {
    componentType: 'roof',
    component: 'Mái / Mái tum',
    meaning: 'Khối mái để dựng hình khối mái và bóc phần mái.',
    allowed: ['Preset mái'],
    hidden: ['Loại phòng', 'Không gian chính', 'Mức không gian', 'Loại móng', 'Openings[]', 'Preset cầu thang', 'Interior preset', 'Checkbox feature'],
  },
  {
    componentType: 'stair',
    component: 'Cầu thang',
    meaning: 'Khối giao thông đứng, ưu tiên preset hình khối.',
    allowed: ['Preset cầu thang', 'Co son', 'Co dien'],
    hidden: ['Loại phòng', 'Không gian chính', 'Mức không gian', 'Loại móng', 'Preset mái', 'Openings[]', 'Interior preset'],
  },
  {
    componentType: 'ceiling',
    component: 'Trần',
    meaning: 'Khối hoàn thiện trần, chỉ cần hình học và vài feature cơ bản.',
    allowed: ['Co son', 'Co dien'],
    hidden: ['Loại phòng', 'Không gian chính', 'Mức không gian', 'Loại móng', 'Preset mái', 'Preset cầu thang', 'Openings[]', 'Interior preset'],
  },
  {
    componentType: 'slab',
    component: 'Sàn / Cột / Tum',
    meaning: 'Khối hình học phụ trợ, hiện tại nên giữ đơn giản để tránh nhập chồng ngữ nghĩa.',
    allowed: ['Kích thước cơ bản', 'Diện tích', 'Số lượng'],
    hidden: ['Loại phòng', 'Không gian chính', 'Mức không gian', 'Loại móng', 'Preset mái', 'Preset cầu thang', 'Openings[]', 'Interior preset', 'Checkbox feature'],
  },
]

const TEMPLATE_TYPE_SIMPLIFIED_GUIDE: Array<{
  key: string
  label: string
  meaning: string
  suggestedApplyModes: string[]
  preferredBasisKeys: string[]
  preferredScopeKeys: string[]
  preferredScopeMode: 'room_first' | 'scope_first' | 'all'
}> = [
  {
    key: 'room',
    label: 'Phòng / không gian',
    meaning: 'Dùng khi bóc theo từng phòng như phòng ngủ, bếp, wc, phòng khách.',
    suggestedApplyModes: ['per_area', 'per_unit', 'formula'],
    preferredBasisKeys: ['floor_area_total', 'main_floor_area_total', 'ceiling_area_total', 'net_wall_area_total', 'wall_surface_area_net', 'opening_area_total', 'door_count_total', 'window_count_total', 'room_count', 'quantity'],
    preferredScopeKeys: ['bedroom', 'master_bedroom', 'wc', 'toilet', 'kitchen', 'living_room', 'room', 'phong'],
    preferredScopeMode: 'room_first',
  },
  {
    key: 'wall',
    label: 'Tường / vách',
    meaning: 'Dùng khi bóc gạch, tô, sơn, bả hoặc vật tư bám theo diện tích tường.',
    suggestedApplyModes: ['per_area', 'formula'],
    preferredBasisKeys: ['gross_wall_area_total', 'net_wall_area_total', 'wall_surface_area_gross', 'wall_surface_area_net', 'opening_area_total', 'door_count_total', 'window_count_total', 'perimeter_total', 'quantity'],
    preferredScopeKeys: ['wall', 'tuong', 'facade', 'mat_tien', 'vach'],
    preferredScopeMode: 'scope_first',
  },
  {
    key: 'facade',
    label: 'Mặt tiền / facade',
    meaning: 'Dùng cho kính, khung, lam và các hạng mục hoàn thiện riêng của mặt tiền.',
    suggestedApplyModes: ['per_area', 'formula', 'per_unit'],
    preferredBasisKeys: ['window_area_total', 'door_area_total', 'opening_area_total', 'window_count_total', 'door_count_total', 'quantity'],
    preferredScopeKeys: ['facade', 'mat_tien', 'window', 'cua_so', 'door', 'cua_di'],
    preferredScopeMode: 'scope_first',
  },
  {
    key: 'foundation',
    label: 'Móng',
    meaning: 'Dùng cho kết cấu móng, ưu tiên bám diện tích footprint hoặc số lượng cấu kiện.',
    suggestedApplyModes: ['per_area', 'fixed', 'formula'],
    preferredBasisKeys: ['footprint_area', 'floor_area_total', 'quantity', 'block_count'],
    preferredScopeKeys: ['foundation', 'mong'],
    preferredScopeMode: 'scope_first',
  },
  {
    key: 'roof',
    label: 'Mái',
    meaning: 'Dùng cho vật tư mái, chống thấm, khung mái hoặc hoàn thiện phần mái.',
    suggestedApplyModes: ['per_area', 'fixed', 'formula'],
    preferredBasisKeys: ['footprint_area', 'floor_area_total', 'quantity', 'block_count'],
    preferredScopeKeys: ['roof', 'mai', 'tum_roof'],
    preferredScopeMode: 'scope_first',
  },
  {
    key: 'stair',
    label: 'Cầu thang',
    meaning: 'Dùng khi bóc theo số cụm cầu thang hoặc công thức riêng.',
    suggestedApplyModes: ['per_unit', 'fixed', 'formula'],
    preferredBasisKeys: ['quantity', 'block_count'],
    preferredScopeKeys: ['stair', 'cau_thang', 'thang'],
    preferredScopeMode: 'scope_first',
  },
  {
    key: 'ceiling',
    label: 'Trần',
    meaning: 'Dùng cho trần, sơn trần, khung xương, điện trần.',
    suggestedApplyModes: ['per_area', 'formula'],
    preferredBasisKeys: ['ceiling_area_total', 'floor_area_total', 'quantity'],
    preferredScopeKeys: ['ceiling', 'tran'],
    preferredScopeMode: 'scope_first',
  },
  {
    key: 'slab',
    label: 'Sàn / khối phẳng',
    meaning: 'Dùng cho sàn, lớp hoàn thiện sàn hoặc lớp phủ bề mặt.',
    suggestedApplyModes: ['per_area', 'formula'],
    preferredBasisKeys: ['floor_area_total', 'main_floor_area_total', 'footprint_area', 'quantity'],
    preferredScopeKeys: ['floor', 'san', 'slab'],
    preferredScopeMode: 'scope_first',
  },
]

function optionsByKind(data: Taxonomy[], kind: string) {
  return data
    .filter((x) => x.kind === kind && x.is_active)
    .map((x) => ({ value: x.value, name: x.name || x.value }))
}

function toNum(v: string): number | null {
  if (!String(v || '').trim()) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function tokenizeFormula(expr: string) {
  const s = String(expr || '').trim()
  if (!s) return [] as string[]
  return s
    .replace(/([()+\-*/])/g, ' $1 ')
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function isLegacyApplyMode(v: unknown) {
  const raw = String(v || '').trim().toLowerCase()
  return raw === 'per_m2' || raw === 'per_room'
}

function looksLikeLegacyScope(v: unknown) {
  const s = String(v || '').trim().toLowerCase()
  if (!s) return false
  return s.includes('mong')
    || s.includes('cau_thang')
    || s.includes('thang')
    || s.includes('tum')
    || s.includes('cot')
    || s.includes('wall')
    || s.includes('tuong')
    || s.includes('san')
}

function getApplyModeMeta(value: string) {
  return APPLY_MODE_OPTIONS.find((x) => x.value === value) || {
    value,
    label: value || '(chưa chọn)',
    hint: 'Chưa có mô tả cho chế độ này.',
  }
}

function getFactKeyLabel(key: string, taxonomyLabel?: string) {
  return taxonomyLabel || FACT_KEY_LABELS[key] || key
}

function normalizeTemplateTypeKey(value: unknown) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  if (raw.includes('room') || raw.includes('phong')) return 'room'
  if (raw.includes('wall') || raw.includes('tuong') || raw.includes('vach')) return 'wall'
  if (raw.includes('facade') || raw.includes('mat_tien') || raw.includes('mattien')) return 'facade'
  if (raw.includes('foundation') || raw.includes('mong')) return 'foundation'
  if (raw.includes('roof') || raw.includes('mai')) return 'roof'
  if (raw.includes('stair') || raw.includes('thang')) return 'stair'
  if (raw.includes('ceiling') || raw.includes('tran')) return 'ceiling'
  if (raw.includes('slab') || raw.includes('san')) return 'slab'
  return raw
}

function matchPreferredScopeKey(optionValue: string, preferredKeys: string[]) {
  const raw = String(optionValue || '').trim().toLowerCase()
  return preferredKeys.some((key) => raw === key || raw.includes(key))
}

function inferFormulaPresetGroup(value: string, name: string) {
  const raw = `${String(value || '').trim().toLowerCase()} ${String(name || '').trim().toLowerCase()}`
  if (raw.includes('wall') || raw.includes('tuong') || raw.includes('vach') || raw.includes('son ') || raw.includes('to ')) return 'Tường'
  if (raw.includes('floor') || raw.includes('san') || raw.includes('lat ')) return 'Sàn'
  if (raw.includes('ceiling') || raw.includes('tran')) return 'Trần'
  if (raw.includes('door') || raw.includes('cua di') || raw.includes('window') || raw.includes('cua so') || raw.includes('glass') || raw.includes('kinh') || raw.includes('opening') || raw.includes('o mo')) return 'Cửa / kính'
  if (raw.includes('foundation') || raw.includes('mong')) return 'Móng'
  if (raw.includes('roof') || raw.includes('mai')) return 'Mái'
  if (raw.includes('wc') || raw.includes('toilet')) return 'WC'
  if (raw.includes('kitchen') || raw.includes('bep')) return 'Bếp'
  return 'Khác'
}

function getPreferredFormulaPresetGroups(templateTypeKey: string) {
  if (templateTypeKey === 'room') return ['Tường', 'Sàn', 'Trần', 'Cửa / kính', 'WC', 'Bếp']
  if (templateTypeKey === 'wall') return ['Tường', 'Cửa / kính']
  if (templateTypeKey === 'facade') return ['Cửa / kính', 'Tường']
  if (templateTypeKey === 'foundation') return ['Móng']
  if (templateTypeKey === 'roof') return ['Mái']
  if (templateTypeKey === 'stair') return ['Khác']
  if (templateTypeKey === 'ceiling') return ['Trần']
  if (templateTypeKey === 'slab') return ['Sàn']
  return []
}

function parseFormulaPresetMeta(raw: string, fallbackName: string) {
  const text = String(raw || '').trim()
  if (!text) return { expr: '', hint: '', shortName: fallbackName }
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          expr: String(parsed.expr || parsed.formula || '').trim(),
          hint: String(parsed.hint || parsed.summary || '').trim(),
          shortName: String(parsed.short_name || fallbackName).trim() || fallbackName,
        }
      }
    } catch {}
  }
  return { expr: text, hint: '', shortName: fallbackName }
}

function evaluatePreviewFormula(expr: string, facts: Record<string, number>) {
  const raw = String(expr || '').trim()
  if (!raw) return { value: null as number | null, error: 'Chưa có công thức' }
  if (!/^[a-zA-Z0-9_+\-*/().\s]+$/.test(raw)) {
    return { value: null as number | null, error: 'Công thức có ký tự không hỗ trợ trong chế độ xem thử' }
  }
  const vars = Array.from(new Set((raw.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || []).filter((token) => !['Math'].includes(token))))
  const args = vars.map((key) => Number(facts[key] ?? 0))
  try {
    // Preview only: accepts simple arithmetic expressions built from known fact keys.
    const fn = new Function(...vars, `return ${raw};`) as (...input: number[]) => number
    const value = fn(...args)
    if (!Number.isFinite(value)) return { value: null as number | null, error: 'Công thức trả về giá trị không hợp lệ' }
    return { value, error: '' }
  } catch {
    return { value: null as number | null, error: 'Không thể tính thử công thức này' }
  }
}

function extractFormulaIdentifiers(expr: string) {
  return Array.from(new Set((String(expr || '').match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || []).filter((token) => token !== 'Math')))
}

function buildPreviewFactsFromBlock(preset: {
  length: number
  width: number
  height: number
  openingsArea: number
  doorCount?: number
  windowCount?: number
  ventCount?: number
  quantity?: number
}): Record<string, number> {
  const length = Number(preset.length || 0)
  const width = Number(preset.width || 0)
  const height = Number(preset.height || 0)
  const openingsArea = Number(preset.openingsArea || 0)
  const doorCount = Math.max(0, Math.trunc(Number(preset.doorCount || 0)))
  const windowCount = Math.max(0, Math.trunc(Number(preset.windowCount || 0)))
  const ventCount = Math.max(0, Math.trunc(Number(preset.ventCount || 0)))
  const quantity = Number(preset.quantity || 1)
  const floorArea = length * width
  const perimeter = (length + width) * 2
  const grossWallArea = perimeter * height
  const netWallArea = Math.max(0, grossWallArea - openingsArea)
  const openingCount = doorCount + windowCount + ventCount
  const avgOpeningArea = openingCount > 0 ? openingsArea / openingCount : 0
  return {
    footprint_area: floorArea,
    floor_area_total: floorArea,
    main_floor_area_total: floorArea,
    gross_wall_area_total: grossWallArea,
    net_wall_area_total: netWallArea,
    wall_surface_area_total: netWallArea,
    wall_surface_area_gross: grossWallArea,
    wall_surface_area_net: netWallArea,
    wall_area_total: netWallArea,
    ceiling_area_total: floorArea,
    room_count: 1,
    opening_area_total: openingsArea,
    opening_count_total: openingCount,
    door_count_total: doorCount,
    window_count_total: windowCount,
    vent_count_total: ventCount,
    door_area_total: Number((avgOpeningArea * doorCount).toFixed(2)),
    window_area_total: Number((avgOpeningArea * windowCount).toFixed(2)),
    perimeter_total: perimeter,
    block_count: 1,
    quantity,
  }
}

export default function EstimateV2SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [templates, setTemplates] = useState<TemplateHeader[]>([])
  const [rules, setRules] = useState<RuleHeader[]>([])

  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedRuleId, setSelectedRuleId] = useState('')

  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [editingTemplateItemId, setEditingTemplateItemId] = useState<string | null>(null)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [editingConditionId, setEditingConditionId] = useState<string | null>(null)
  const [editingActionId, setEditingActionId] = useState<string | null>(null)

  const [catalogForm, setCatalogForm] = useState({
    item_code: '',
    item_name: '',
    item_type: '',
    item_group: '',
    item_unit: '',
  })

  const [templateForm, setTemplateForm] = useState({
    template_code: '',
    template_name: '',
    template_type: '',
    house_type: '',
    style: '',
    finish_level: '',
    room_type: '',
    priority: '0',
    version: '1',
    is_active: true,
  })

  const [templateItemForm, setTemplateItemForm] = useState({
    catalog_item_id: '',
    apply_mode: 'per_area',
    quantity_basis_key: '',
    scope_key: '',
    quantity_value: '',
    formula_expr: '',
    waste_factor: '',
    sort_order: '0',
    is_active: true,
  })
  const [selectedRequiredFacts, setSelectedRequiredFacts] = useState<string[]>([])
  const [requiredFactToAdd, setRequiredFactToAdd] = useState('')
  const [formulaTokens, setFormulaTokens] = useState<string[]>([])
  const [formulaToken, setFormulaToken] = useState('')
  const [selectedPreviewTemplateItemId, setSelectedPreviewTemplateItemId] = useState('')
  const [blockPreviewForm, setBlockPreviewForm] = useState({
    room_type: '',
    length: '5',
    width: '4',
    height: '3',
    openings_area: '4',
    door_count: '1',
    window_count: '1',
    vent_count: '0',
    quantity: '1',
  })
  const [previewManualFacts, setPreviewManualFacts] = useState<Record<string, string>>({})
  const [previewUseManualScope, setPreviewUseManualScope] = useState(false)
  const [showAllBasisOptions, setShowAllBasisOptions] = useState(false)
  const [showAllScopeOptions, setShowAllScopeOptions] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(true)
  const [templateOpen, setTemplateOpen] = useState(true)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [componentGuideOpen, setComponentGuideOpen] = useState(false)

  const [ruleForm, setRuleForm] = useState({
    rule_code: '',
    rule_name: '',
    scope: 'foundation',
    priority: '0',
    version: '1',
    is_active: true,
  })

  const [conditionForm, setConditionForm] = useState({
    fact_key: '',
    operator: 'eq',
    value_text: '',
    value_number: '',
    sort_order: '0',
  })

  const [actionForm, setActionForm] = useState({
    action_type: 'suggest_value',
    target_key: '',
    value_text: '',
    value_number: '',
    formula_expr: '',
    sort_order: '0',
  })

  const itemTypeOptions = useMemo(() => optionsByKind(taxonomies, 'item_type'), [taxonomies])
  const itemGroupOptions = useMemo(() => optionsByKind(taxonomies, 'item_group'), [taxonomies])
  const itemUnitOptions = useMemo(() => optionsByKind(taxonomies, 'item_unit'), [taxonomies])
  const templateTypeOptions = useMemo(() => optionsByKind(taxonomies, 'template_type'), [taxonomies])
  const houseTypeOptions = useMemo(() => optionsByKind(taxonomies, 'house_type'), [taxonomies])
  const styleOptions = useMemo(() => optionsByKind(taxonomies, 'style'), [taxonomies])
  const levelOptions = useMemo(
    () =>
      optionsByKind(taxonomies, 'level').filter((x) => {
        const v = String(x.value || '').trim().toLowerCase()
        const n = String(x.name || '').trim().toLowerCase()
        if (v === 'day_du' || v === 'tien_nghi') return false
        if (n === 'day du' || n === 'tien nghi') return false
        return true
      }),
    [taxonomies]
  )
  const roomTypeOptions = useMemo(() => optionsByKind(taxonomies, 'room_type'), [taxonomies])
  const scopeOptions = useMemo(() => optionsByKind(taxonomies, 'scope_type'), [taxonomies])
  const quantityBasisOptions = useMemo(() => optionsByKind(taxonomies, 'quantity_basis'), [taxonomies])
  const selectedTemplate = useMemo(
    () => templates.find((x) => x.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  )
  const activeTemplateTypeKey = useMemo(
    () => normalizeTemplateTypeKey(selectedTemplate?.template_type || templateForm.template_type),
    [selectedTemplate?.template_type, templateForm.template_type]
  )
  const activeTemplateTypeGuide = useMemo(
    () => TEMPLATE_TYPE_SIMPLIFIED_GUIDE.find((x) => x.key === activeTemplateTypeKey) || null,
    [activeTemplateTypeKey]
  )
  const factKeyTaxonomies = useMemo(
    () => taxonomies.filter((x) => x.kind === 'fact_key' && x.is_active),
    [taxonomies]
  )
  const formulaPresetTaxonomies = useMemo(
    () => taxonomies.filter((x) => x.kind === 'formula_preset' && x.is_active),
    [taxonomies]
  )
  const requiredFactTaxonomies = useMemo(
    () => taxonomies.filter((x) => x.kind === 'required_fact' && x.is_active),
    [taxonomies]
  )
  const scopeOptionsForTemplateItem = useMemo(() => {
    const map = new Map<string, string>()
    if (activeTemplateTypeGuide?.preferredScopeMode === 'room_first') {
      for (const x of roomTypeOptions) if (!map.has(x.value)) map.set(x.value, x.name)
      for (const x of scopeOptions) if (!map.has(x.value)) map.set(x.value, x.name)
    } else if (activeTemplateTypeGuide?.preferredScopeMode === 'scope_first') {
      for (const x of scopeOptions) if (!map.has(x.value)) map.set(x.value, x.name)
      for (const x of roomTypeOptions) if (!map.has(x.value)) map.set(x.value, x.name)
    } else {
      for (const x of roomTypeOptions) if (!map.has(x.value)) map.set(x.value, x.name)
      for (const x of scopeOptions) if (!map.has(x.value)) map.set(x.value, x.name)
    }
    const all = Array.from(map.entries()).map(([value, name]) => ({ value, name }))
    if (showAllScopeOptions || !activeTemplateTypeGuide?.preferredScopeKeys?.length) return all
    const filtered = all.filter((x) => matchPreferredScopeKey(x.value, activeTemplateTypeGuide.preferredScopeKeys))
    return filtered.length > 0 ? filtered : all
  }, [activeTemplateTypeGuide?.preferredScopeKeys, activeTemplateTypeGuide?.preferredScopeMode, roomTypeOptions, scopeOptions, showAllScopeOptions])
  const quantityBasisOptionsForTemplateItem = useMemo(() => {
    const source = quantityBasisOptions.length > 0
      ? quantityBasisOptions
      : factKeyTaxonomies.map((x) => ({ value: x.value, name: x.name || x.value }))
    if (showAllBasisOptions || !activeTemplateTypeGuide?.preferredBasisKeys?.length) return source
    const preferredSet = new Set(activeTemplateTypeGuide.preferredBasisKeys)
    const preferred = source.filter((x) => preferredSet.has(x.value))
    return preferred.length > 0 ? preferred : source
  }, [quantityBasisOptions, factKeyTaxonomies, showAllBasisOptions, activeTemplateTypeGuide])
  const formulaFactOptions = useMemo(
    () => factKeyTaxonomies.map((x) => ({ value: x.value, name: x.name || x.value })),
    [factKeyTaxonomies]
  )
  const requiredFactOptions = useMemo(() => {
    const src = requiredFactTaxonomies.length > 0 ? requiredFactTaxonomies : factKeyTaxonomies
    return src.map((x) => ({ value: x.value, name: x.name || x.value }))
  }, [requiredFactTaxonomies, factKeyTaxonomies])
  const formulaPresetOptions = useMemo(
    () =>
      formulaPresetTaxonomies
        .map((x) => {
          const meta = parseFormulaPresetMeta(String(x.description || ''), x.name || x.value)
          return {
            value: x.value,
            name: x.name || x.value,
            shortName: meta.shortName,
            expr: meta.expr,
            hint: meta.hint,
            group: inferFormulaPresetGroup(x.value, x.name || x.value),
          }
        })
        .filter((x) => x.expr),
    [formulaPresetTaxonomies]
  )
  const formulaPresetGroups = useMemo(() => {
    const map = new Map<string, Array<{ value: string; name: string; shortName: string; expr: string; hint: string; group: string }>>()
    for (const item of formulaPresetOptions) {
      if (!map.has(item.group)) map.set(item.group, [])
      map.get(item.group)!.push(item)
    }
    return Array.from(map.entries()).map(([group, items]) => ({ group, items }))
  }, [formulaPresetOptions])
  const filteredFormulaPresetGroups = useMemo(() => {
    const preferredGroups = getPreferredFormulaPresetGroups(activeTemplateTypeKey)
    if (!preferredGroups.length) return formulaPresetGroups
    const filtered = formulaPresetGroups.filter((group) => preferredGroups.includes(group.group))
    return filtered.length > 0 ? filtered : formulaPresetGroups
  }, [activeTemplateTypeKey, formulaPresetGroups])
  const ruleFactKeyOptions = useMemo(() => formulaFactOptions, [formulaFactOptions])
  const templateItemLegacyMode = useMemo(
    () => isLegacyApplyMode(templateItemForm.apply_mode),
    [templateItemForm.apply_mode]
  )
  const templateItemLegacyScope = useMemo(
    () => looksLikeLegacyScope(templateItemForm.scope_key),
    [templateItemForm.scope_key]
  )
  const applyModeMeta = useMemo(
    () => getApplyModeMeta(templateItemForm.apply_mode),
    [templateItemForm.apply_mode]
  )
  const selectedCatalogItem = useMemo(
    () => catalog.find((x) => x.id === templateItemForm.catalog_item_id) || null,
    [catalog, templateItemForm.catalog_item_id]
  )
  const basisLabel = useMemo(
    () => quantityBasisOptionsForTemplateItem.find((x) => x.value === templateItemForm.quantity_basis_key)?.name || templateItemForm.quantity_basis_key || 'Chưa chọn',
    [quantityBasisOptionsForTemplateItem, templateItemForm.quantity_basis_key]
  )
  const scopeLabel = useMemo(
    () => scopeOptionsForTemplateItem.find((x) => x.value === templateItemForm.scope_key)?.name || templateItemForm.scope_key || 'Tất cả phạm vi',
    [scopeOptionsForTemplateItem, templateItemForm.scope_key]
  )
  const selectedTemplateItemCount = useMemo(
    () => selectedTemplate?.items?.length || 0,
    [selectedTemplate]
  )
  const previewTemplateItem = useMemo(
    () => selectedTemplate?.items?.find((x) => x.id === selectedPreviewTemplateItemId) || null,
    [selectedTemplate, selectedPreviewTemplateItemId]
  )
  const previewApplyModeMeta = useMemo(
    () => getApplyModeMeta(previewTemplateItem?.apply_mode || ''),
    [previewTemplateItem?.apply_mode]
  )
  const factLabelMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const item of factKeyTaxonomies) map[item.value] = item.name || item.value
    for (const item of requiredFactTaxonomies) map[item.value] = item.name || item.value
    return map
  }, [factKeyTaxonomies, requiredFactTaxonomies])
  const previewBasisLabel = useMemo(
    () => getFactKeyLabel(
      String(previewTemplateItem?.quantity_basis_key || ''),
      quantityBasisOptionsForTemplateItem.find((x) => x.value === previewTemplateItem?.quantity_basis_key)?.name
    ) || 'Chưa chọn',
    [quantityBasisOptionsForTemplateItem, previewTemplateItem?.quantity_basis_key]
  )
  const previewScopeLabel = useMemo(
    () => scopeOptionsForTemplateItem.find((x) => x.value === previewTemplateItem?.scope_key)?.name || previewTemplateItem?.scope_key || 'Tất cả phạm vi',
    [scopeOptionsForTemplateItem, previewTemplateItem?.scope_key]
  )
  const effectivePreviewRoomScope = useMemo(
    () => (previewUseManualScope || !previewTemplateItem?.scope_key ? blockPreviewForm.room_type : String(previewTemplateItem.scope_key || '')),
    [previewUseManualScope, previewTemplateItem?.scope_key, blockPreviewForm.room_type]
  )
  const previewDerivedFacts = useMemo<Record<string, number>>(() => {
    const built = buildPreviewFactsFromBlock({
      length: Number(blockPreviewForm.length || 0),
      width: Number(blockPreviewForm.width || 0),
      height: Number(blockPreviewForm.height || 0),
      openingsArea: Number(blockPreviewForm.openings_area || 0),
      doorCount: Number(blockPreviewForm.door_count || 0),
      windowCount: Number(blockPreviewForm.window_count || 0),
      ventCount: Number(blockPreviewForm.vent_count || 0),
      quantity: Number(blockPreviewForm.quantity || 1),
    })
    return {
      ...built,
      length_m: Number(blockPreviewForm.length || 0),
      width_m: Number(blockPreviewForm.width || 0),
      height_m: Number(blockPreviewForm.height || 0),
      openings_area: Number(blockPreviewForm.openings_area || 0),
      door_count_total: Number(blockPreviewForm.door_count || 0),
      window_count_total: Number(blockPreviewForm.window_count || 0),
      vent_count_total: Number(blockPreviewForm.vent_count || 0),
      quantity: Number(blockPreviewForm.quantity || 1),
    }
  }, [blockPreviewForm])
  const knownFactKeys = useMemo(() => {
    const keys = new Set<string>([
      ...Object.keys(PREVIEW_FACT_DEFAULTS),
      ...Object.keys(FACT_KEY_LABELS),
      'room_type',
    ])
    for (const row of taxonomies) {
      if (!row?.value) continue
      if (row.kind === 'quantity_basis' || row.kind === 'fact_key' || row.kind === 'required_fact') {
        keys.add(String(row.value))
      }
    }
    return keys
  }, [taxonomies])
  const templateItemFormulaIdentifiers = useMemo(
    () => extractFormulaIdentifiers(templateItemForm.formula_expr || formulaTokens.join(' ')),
    [templateItemForm.formula_expr, formulaTokens]
  )
  const templateItemConfigWarnings = useMemo(() => {
    const warnings: string[] = []
    const applyMode = String(templateItemForm.apply_mode || '')
    const wasteFactor = Number(templateItemForm.waste_factor || 0)
    const unknownFormulaFacts = templateItemFormulaIdentifiers.filter((key) => !knownFactKeys.has(key))
    if (applyMode === 'formula' && templateItemFormulaIdentifiers.length === 0) {
      warnings.push('Công thức đang để trống nên dòng này chưa thể tính được.')
    }
    if (unknownFormulaFacts.length > 0) {
      warnings.push(`Công thức đang dùng fact chưa rõ: ${unknownFormulaFacts.join(', ')}.`)
    }
    if (applyMode === 'formula' && String(templateItemForm.quantity_basis_key || '').trim()) {
      warnings.push('Dòng tính theo công thức sẽ ưu tiên formula, chỉ số nền hiện tại chỉ còn mang tính tham khảo.')
    }
    if (applyMode !== 'formula' && formulaTokens.length > 0) {
      warnings.push('Bạn đã dựng công thức nhưng apply_mode chưa chuyển sang "Theo công thức".')
    }
    if (applyMode === 'fixed' && String(templateItemForm.quantity_basis_key || '').trim()) {
      warnings.push('Dòng số lượng cố định không cần chọn chỉ số nền.')
    }
    if (Number.isFinite(wasteFactor) && wasteFactor < 0) {
      warnings.push('Hao hụt đang âm. Chỉ nên dùng số dương nếu muốn cộng thêm vật tư dự phòng.')
    }
    if (Number.isFinite(wasteFactor) && wasteFactor > 1) {
      warnings.push('Hao hụt đang lớn hơn 100%. Hãy kiểm tra lại xem bạn đang nhập tỷ lệ hay phần trăm.')
    }
    return warnings
  }, [formulaTokens.length, knownFactKeys, templateItemForm.apply_mode, templateItemForm.quantity_basis_key, templateItemForm.waste_factor, templateItemFormulaIdentifiers])
  const previewInputKeys = useMemo(() => {
    const keys = new Set<string>()
    if (previewTemplateItem?.quantity_basis_key) keys.add(previewTemplateItem.quantity_basis_key)
    for (const fact of previewTemplateItem?.required_facts || []) keys.add(String(fact))
    for (const fact of extractFormulaIdentifiers(previewTemplateItem?.formula_expr || '')) keys.add(fact)
    if (effectivePreviewRoomScope) keys.add('room_type')
    return Array.from(keys)
  }, [previewTemplateItem, effectivePreviewRoomScope])
  const previewDerivedInputKeys = useMemo(
    () => previewInputKeys.filter((key) => key in previewDerivedFacts),
    [previewInputKeys, previewDerivedFacts]
  )
  const previewManualInputKeys = useMemo(
    () => previewInputKeys.filter((key) => key === 'room_type' || !(key in previewDerivedFacts)),
    [previewInputKeys, previewDerivedFacts]
  )
  const previewFactNumbers = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = { ...previewDerivedFacts }
    for (const key of previewInputKeys) {
      if (key === 'room_type') continue
      if (key in previewManualFacts && String(previewManualFacts[key]).trim() !== '') {
        const parsed = Number(previewManualFacts[key])
        out[key] = Number.isFinite(parsed) ? parsed : 0
      } else if (!(key in out)) {
        out[key] = Number(PREVIEW_FACT_DEFAULTS[key] ?? 0)
      }
    }
    return out
  }, [previewDerivedFacts, previewInputKeys, previewManualFacts])
  const previewBasisValue = useMemo(() => {
    const key = String(previewTemplateItem?.quantity_basis_key || '').trim()
    return key ? Number(previewFactNumbers[key] ?? 0) : 0
  }, [previewFactNumbers, previewTemplateItem?.quantity_basis_key])
  const previewFormulaResult = useMemo(
    () => evaluatePreviewFormula(previewTemplateItem?.formula_expr || '', previewFactNumbers),
    [previewTemplateItem?.formula_expr, previewFactNumbers]
  )
  const previewFormulaIdentifiers = useMemo(
    () => extractFormulaIdentifiers(previewTemplateItem?.formula_expr || ''),
    [previewTemplateItem?.formula_expr]
  )
  const previewUnknownFormulaFacts = useMemo(
    () => previewFormulaIdentifiers.filter((key) => !knownFactKeys.has(key)),
    [knownFactKeys, previewFormulaIdentifiers]
  )
  const previewQuantity = useMemo(() => {
    const qtyValue = Number(previewTemplateItem?.quantity_value || 0)
    const wasteFactor = Number(previewTemplateItem?.waste_factor || 0)
    const wasteMultiplier = Number.isFinite(wasteFactor) ? 1 + wasteFactor : 1
    const mode = String(previewTemplateItem?.apply_mode || '')
    let base = 0
    if (mode === 'fixed') base = qtyValue
    else if (mode === 'formula') base = Number(previewFormulaResult.value || 0)
    else base = previewBasisValue * qtyValue
    const finalQty = base * wasteMultiplier
    return {
      base,
      finalQty: Number.isFinite(finalQty) ? finalQty : 0,
      wasteMultiplier,
    }
  }, [previewBasisValue, previewFormulaResult.value, previewTemplateItem?.apply_mode, previewTemplateItem?.quantity_value, previewTemplateItem?.waste_factor])
  const previewExplainText = useMemo(() => {
    if (!previewTemplateItem) return 'Chọn một item trong template để xem cách tính.'
    const wastePercent = Number(previewTemplateItem.waste_factor || 0) * 100
    if (previewTemplateItem.apply_mode === 'fixed') {
      return `${previewTemplateItem.catalog_item?.item_name || 'Hạng mục'} có số lượng cố định ${Number(previewTemplateItem.quantity_value || 0).toFixed(2).replace(/\.00$/, '')}. Sau hao hụt ${wastePercent.toFixed(2).replace(/\.00$/, '')}% thì thành ${previewQuantity.finalQty.toFixed(2).replace(/\.00$/, '')}.`
    }
    if (previewTemplateItem.apply_mode === 'formula') {
      const formulaLabel = previewTemplateItem.formula_expr || 'chưa có công thức'
      return `${previewTemplateItem.catalog_item?.item_name || 'Hạng mục'} được tính theo công thức ${formulaLabel}. Kết quả gốc là ${previewQuantity.base.toFixed(2).replace(/\.00$/, '')}, sau hao hụt ${wastePercent.toFixed(2).replace(/\.00$/, '')}% thì thành ${previewQuantity.finalQty.toFixed(2).replace(/\.00$/, '')}.`
    }
    return `${previewBasisLabel} ${previewBasisValue.toFixed(2).replace(/\.00$/, '')} x hệ số ${Number(previewTemplateItem.quantity_value || 0).toFixed(2).replace(/\.00$/, '')} = ${previewQuantity.base.toFixed(2).replace(/\.00$/, '')}. Sau hao hụt ${wastePercent.toFixed(2).replace(/\.00$/, '')}% thì thành ${previewQuantity.finalQty.toFixed(2).replace(/\.00$/, '')}.`
  }, [previewBasisLabel, previewBasisValue, previewQuantity.base, previewQuantity.finalQty, previewTemplateItem])

  const selectedRule = useMemo(
    () => rules.find((x) => x.id === selectedRuleId) || null,
    [rules, selectedRuleId]
  )

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    if (!selectedTemplate) return
    setTemplateForm({
      template_code: selectedTemplate.template_code || '',
      template_name: selectedTemplate.template_name || '',
      template_type: selectedTemplate.template_type || '',
      house_type: selectedTemplate.house_type || '',
      style: selectedTemplate.style || '',
      finish_level: selectedTemplate.finish_level || '',
      room_type: selectedTemplate.room_type || '',
      priority: String(selectedTemplate.priority ?? 0),
      version: String(selectedTemplate.version ?? 1),
      is_active: Boolean(selectedTemplate.is_active),
    })
    setEditingTemplateId(selectedTemplate.id)
    resetTemplateItemForm()
    setSelectedPreviewTemplateItemId(selectedTemplate.items?.[0]?.id || '')
    setPreviewManualFacts({})
    setPreviewUseManualScope(false)
  }, [selectedTemplateId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedRule) return
    setRuleForm({
      rule_code: selectedRule.rule_code || '',
      rule_name: selectedRule.rule_name || '',
      scope: selectedRule.scope || 'foundation',
      priority: String(selectedRule.priority ?? 0),
      version: String(selectedRule.version ?? 1),
      is_active: Boolean(selectedRule.is_active),
    })
    setEditingRuleId(selectedRule.id)
    setEditingConditionId(null)
    setEditingActionId(null)
    setConditionForm({ fact_key: '', operator: 'eq', value_text: '', value_number: '', sort_order: '0' })
    setActionForm({ action_type: 'suggest_value', target_key: '', value_text: '', value_number: '', formula_expr: '', sort_order: '0' })
  }, [selectedRuleId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setCatalogForm((p) => ({
      ...p,
      item_type: p.item_type || itemTypeOptions[0]?.value || '',
      item_group: p.item_group || itemGroupOptions[0]?.value || '',
      item_unit: p.item_unit || itemUnitOptions[0]?.value || '',
    }))
    setTemplateForm((p) => ({
      ...p,
      template_type: p.template_type || templateTypeOptions[0]?.value || '',
      house_type: p.house_type || houseTypeOptions[0]?.value || '',
      style: p.style || styleOptions[0]?.value || '',
      finish_level: p.finish_level || levelOptions[0]?.value || '',
      room_type: p.room_type || roomTypeOptions[0]?.value || '',
    }))
    setTemplateItemForm((p) => ({
      ...p,
      quantity_basis_key: p.quantity_basis_key || quantityBasisOptionsForTemplateItem[0]?.value || '',
      scope_key: p.scope_key || roomTypeOptions[0]?.value || scopeOptions[0]?.value || '',
    }))
  }, [itemTypeOptions, itemGroupOptions, itemUnitOptions, templateTypeOptions, houseTypeOptions, styleOptions, levelOptions, roomTypeOptions, scopeOptions, quantityBasisOptionsForTemplateItem])
  useEffect(() => {
    if (!quantityBasisOptionsForTemplateItem.length) return
    if (templateItemForm.quantity_basis_key && quantityBasisOptionsForTemplateItem.some((x) => x.value === templateItemForm.quantity_basis_key)) return
    setTemplateItemForm((prev) => ({
      ...prev,
      quantity_basis_key: quantityBasisOptionsForTemplateItem[0]?.value || '',
    }))
  }, [quantityBasisOptionsForTemplateItem, templateItemForm.quantity_basis_key])
  useEffect(() => {
    if (!scopeOptionsForTemplateItem.length) return
    if (templateItemForm.scope_key && scopeOptionsForTemplateItem.some((x) => x.value === templateItemForm.scope_key)) return
    setTemplateItemForm((prev) => ({
      ...prev,
      scope_key: scopeOptionsForTemplateItem[0]?.value || '',
    }))
  }, [scopeOptionsForTemplateItem, templateItemForm.scope_key])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  function appendFormulaToken(token: string) {
    const t = String(token || '').trim()
    if (!t) return
    setFormulaTokens((prev) => {
      const next = [...prev, t]
      setTemplateItemForm((p) => ({ ...p, formula_expr: next.join(' ') }))
      return next
    })
  }

  async function loadAll() {
    setLoading(true)
    const [tx, c, t, r] = await Promise.all([
      fetch('/api/settings/estimate/taxonomies?active_only=true'),
      fetch('/api/settings/estimate/catalog-items?active_only=false'),
      fetch('/api/settings/estimate/templates?active_only=false'),
      fetch('/api/settings/estimate/rules?active_only=false'),
    ])
    const txJson = await tx.json()
    const cJson = await c.json()
    const tJson = await t.json()
    const rJson = await r.json()
    const cData = Array.isArray(cJson.data) ? cJson.data : []
    const tData = Array.isArray(tJson.data) ? tJson.data : []
    const rData = Array.isArray(rJson.data) ? rJson.data : []
    setTaxonomies(Array.isArray(txJson.data) ? txJson.data : [])
    setCatalog(cData)
    setTemplates(tData)
    setRules(rData)

    if (!selectedTemplateId && tData.length) setSelectedTemplateId(tData[0].id)
    if (selectedTemplateId && !tData.some((x: TemplateHeader) => x.id === selectedTemplateId)) {
      setSelectedTemplateId(tData[0]?.id || '')
    }
    if (!selectedRuleId && rData.length) setSelectedRuleId(rData[0].id)
    if (selectedRuleId && !rData.some((x: RuleHeader) => x.id === selectedRuleId)) {
      setSelectedRuleId(rData[0]?.id || '')
    }
    setLoading(false)
  }

  async function seedV2() {
    const res = await fetch('/api/settings/estimate/v2/seed', { method: 'POST' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(`Lỗi khởi tạo: ${j.error || 'Không thể seed dữ liệu'}`)
    await loadAll()
    showToast('Đã khởi tạo dữ liệu mẫu Estimate V2 thành công')
  }

  async function saveCatalog() {
    if (!catalogForm.item_code || !catalogForm.item_name) return showToast('Thiếu mã hoặc tên hạng mục')
    const payload = {
      ...catalogForm,
      item_type: catalogForm.item_type || itemTypeOptions[0]?.value || '',
      item_group: catalogForm.item_group || itemGroupOptions[0]?.value || '',
      item_unit: catalogForm.item_unit || itemUnitOptions[0]?.value || '',
    }
    const url = editingCatalogId
      ? `/api/settings/estimate/catalog-items/${editingCatalogId}`
      : '/api/settings/estimate/catalog-items'
    const method = editingCatalogId ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    if (!catalogForm.item_code || !catalogForm.item_name) return showToast('Thiếu mã hoặc tên hạng mục')
    await loadAll()
    if (!editingCatalogId) resetCatalogForm()
    showToast(editingCatalogId ? 'Đã cập nhật hạng mục thành công' : 'Đã tạo hạng mục mới')
  }

  function resetCatalogForm() {
    setEditingCatalogId(null)
    setCatalogForm({
      item_code: '',
      item_name: '',
      item_type: itemTypeOptions[0]?.value || '',
      item_group: itemGroupOptions[0]?.value || '',
      item_unit: itemUnitOptions[0]?.value || '',
    })
  }

  async function removeCatalog(id: string) {
    if (!confirm('Xác nhận xóa hạng mục này khỏi danh mục?')) return
    await fetch(`/api/settings/estimate/catalog-items/${id}`, { method: 'DELETE' })
    await loadAll()
    showToast('Đã xóa hạng mục')
  }

  async function saveTemplate() {
    if (!templateForm.template_code || !templateForm.template_name || !templateForm.template_type) {
      return showToast('Vui lòng điền đầy đủ thông tin Template')
    }
    const payload = {
      ...templateForm,
      priority: Number(templateForm.priority || 0),
      version: Number(templateForm.version || 1),
      house_type: templateForm.house_type || null,
      style: templateForm.style || null,
      finish_level: templateForm.finish_level || null,
      room_type: templateForm.room_type || null,
    }
    const url = editingTemplateId
      ? `/api/settings/estimate/templates/${editingTemplateId}`
      : '/api/settings/estimate/templates'
    const method = editingTemplateId ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(`Lỗi: ${j.error || 'Không lưu được template'}`)
    await loadAll()
    const savedId = j?.data?.id || editingTemplateId
    if (savedId) setSelectedTemplateId(savedId)
    if (!editingTemplateId) resetTemplateForm()
    showToast(editingTemplateId ? 'Đã cập nhật Template' : 'Đã tạo Template mới')
  }

  function resetTemplateForm() {
    setEditingTemplateId(null)
    setTemplateForm({
      template_code: '',
      template_name: '',
      template_type: templateTypeOptions[0]?.value || '',
      house_type: houseTypeOptions[0]?.value || '',
      style: styleOptions[0]?.value || '',
      finish_level: levelOptions[0]?.value || '',
      room_type: roomTypeOptions[0]?.value || '',
      priority: '0',
      version: '1',
      is_active: true,
    })
  }

  async function removeTemplate(id: string) {
    if (!confirm('Xóa template này?')) return
    await fetch(`/api/settings/estimate/templates/${id}`, { method: 'DELETE' })
    await loadAll()
    showToast('Đã xóa template')
  }

  async function saveTemplateItem() {
    if (!selectedTemplateId) return showToast('Vui lòng chọn template')
    if (!templateItemForm.catalog_item_id || !templateItemForm.apply_mode) {
      return showToast('Thiếu catalog item hoặc apply_mode')
    }
    if (templateItemForm.apply_mode === 'formula' && formulaTokens.length === 0) {
      return showToast('Apply mode = formula thi phai co cong thuc')
    }
    if ((templateItemForm.apply_mode === 'per_area' || templateItemForm.apply_mode === 'per_unit') && !templateItemForm.quantity_basis_key) {
      return showToast('Can chon quantity basis cho per_area/per_unit')
    }
    const unknownFormulaFacts = templateItemFormulaIdentifiers.filter((key) => !knownFactKeys.has(key))
    if (unknownFormulaFacts.length > 0) {
      return showToast(`Fact chưa rõ trong công thức: ${unknownFormulaFacts.join(', ')}`)
    }
    const payload = {
      ...templateItemForm,
      quantity_basis_key: templateItemForm.quantity_basis_key || null,
      scope_key: templateItemForm.scope_key || null,
      quantity_value: toNum(templateItemForm.quantity_value),
      waste_factor: toNum(templateItemForm.waste_factor),
      sort_order: Number(templateItemForm.sort_order || 0),
      formula_expr: formulaTokens.length > 0 ? formulaTokens.join(' ') : null,
      required_facts: selectedRequiredFacts,
    }
    const url = editingTemplateItemId
      ? `/api/settings/estimate/template-items/${editingTemplateItemId}`
      : `/api/settings/estimate/templates/${selectedTemplateId}/items`
    const method = editingTemplateItemId ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(`Lỗi: ${j.error || 'Không lưu được template item'}`)
    await loadAll()
    resetTemplateItemForm()
    showToast(editingTemplateItemId ? 'Đã cập nhật template item' : 'Đã thêm template item')
  }

  function resetTemplateItemForm() {
    setEditingTemplateItemId(null)
    setTemplateItemForm({
      catalog_item_id: '',
      apply_mode: 'per_area',
      quantity_basis_key: quantityBasisOptionsForTemplateItem[0]?.value || '',
      scope_key: roomTypeOptions[0]?.value || scopeOptions[0]?.value || '',
      quantity_value: '',
      formula_expr: '',
      waste_factor: '',
      sort_order: '0',
      is_active: true,
    })
    setSelectedRequiredFacts([])
    setFormulaTokens([])
    setRequiredFactToAdd('')
    setFormulaToken('')
  }

  function startEditTemplateItem(it: TemplateItem) {
    setEditingTemplateItemId(it.id)
    setSelectedPreviewTemplateItemId(it.id)
    setPreviewManualFacts({})
    setPreviewUseManualScope(false)
    setTemplateItemForm({
      catalog_item_id: it.catalog_item_id || '',
      apply_mode: it.apply_mode || 'per_area',
      quantity_basis_key: it.quantity_basis_key || '',
      scope_key: it.scope_key || '',
      quantity_value: it.quantity_value != null ? String(it.quantity_value) : '',
      formula_expr: it.formula_expr || '',
      waste_factor: it.waste_factor != null ? String(it.waste_factor) : '',
      sort_order: String(it.sort_order ?? 0),
      is_active: Boolean(it.is_active),
    })
    setSelectedRequiredFacts(Array.isArray(it.required_facts) ? it.required_facts : [])
    setFormulaTokens(tokenizeFormula(it.formula_expr || ''))
  }

  async function toggleTemplateItemActive(it: TemplateItem) {
    const res = await fetch(`/api/settings/estimate/template-items/${it.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !it.is_active }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(`Lỗi: ${j.error || 'Không cập nhật được trạng thái item'}`)
    await loadAll()
    showToast(it.is_active ? 'Đã tắt item' : 'Đã bật item')
  }

  async function removeTemplateItem(id: string) {
    if (!confirm('Xóa template item này?')) return
    await fetch(`/api/settings/estimate/template-items/${id}`, { method: 'DELETE' })
    await loadAll()
    showToast('Đã xóa template item')
  }

  async function saveRule() {
    if (!ruleForm.rule_code || !ruleForm.rule_name || !ruleForm.scope) {
      return showToast('Thiếu thông tin rule')
    }
    const payload = {
      ...ruleForm,
      priority: Number(ruleForm.priority || 0),
      version: Number(ruleForm.version || 1),
    }
    const url = editingRuleId
      ? `/api/settings/estimate/rules/${editingRuleId}`
      : '/api/settings/estimate/rules'
    const method = editingRuleId ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(`Lỗi: ${j.error || 'Không lưu được rule'}`)
    await loadAll()
    const savedId = j?.data?.id || editingRuleId
    if (savedId) setSelectedRuleId(savedId)
    if (!editingRuleId) resetRuleForm()
    showToast(editingRuleId ? 'Đã cập nhật rule' : 'Đã tạo rule')
  }

  function resetRuleForm() {
    setEditingRuleId(null)
    setRuleForm({
      rule_code: '',
      rule_name: '',
      scope: 'foundation',
      priority: '0',
      version: '1',
      is_active: true,
    })
  }

  async function removeRule(id: string) {
    if (!confirm('Bạn có chắc chắn muốn xóa quy tắc (rule) này không?')) return
    await fetch(`/api/settings/estimate/rules/${id}`, { method: 'DELETE' })
    await loadAll()
    showToast('Đã xóa quy tắc thành công')
  }

  async function saveCondition() {
    if (!selectedRuleId) return showToast('Vui lòng chọn quy tắc (rule) trước khi lưu')
    if (!conditionForm.fact_key || !conditionForm.operator) {
      return showToast('Vui lòng nhập đầy đủ Fact Key và toán tử')
    }

    const payload = {
      ...conditionForm,
      value_text: conditionForm.value_text || null,
      value_number: toNum(conditionForm.value_number),
      sort_order: Number(conditionForm.sort_order || 0),
    }

    const url = editingConditionId
      ? `/api/settings/estimate/rule-conditions/${editingConditionId}`
      : `/api/settings/estimate/rules/${selectedRuleId}/conditions`
    const method = editingConditionId ? 'PATCH' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json().catch(() => ({}))

      if (!res.ok) return showToast(`Lỗi: ${j.error || 'Không thể lưu điều kiện'}`)

      await loadAll()
      setEditingConditionId(null)
      setConditionForm({ fact_key: '', operator: 'eq', value_text: '', value_number: '', sort_order: '0' })
      showToast(editingConditionId ? 'Đã cập nhật điều kiện thành công' : 'Đã thêm điều kiện mới thành công')
    } catch (error) {
      showToast('Lỗi kết nối hệ thống khi lưu điều kiện')
    }
  }

  async function removeCondition(id: string) {
    if (!confirm('Bạn có chắc chắn muốn xóa điều kiện này không?')) return
    try {
      const res = await fetch(`/api/settings/estimate/rule-conditions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await loadAll()
      showToast('Đã xóa điều kiện thành công')
    } catch (error) {
      showToast('Không thể xóa điều kiện, vui lòng thử lại sau')
    }
  }

  async function saveAction() {
    if (!selectedRuleId) return showToast('Vui lòng chọn quy tắc (rule) trước khi lưu')
    if (!actionForm.action_type) return showToast('Vui lòng chọn loại hành động (action_type)')

    const payload = {
      ...actionForm,
      target_key: actionForm.target_key || null,
      value_text: actionForm.value_text || null,
      value_number: toNum(actionForm.value_number),
      formula_expr: actionForm.formula_expr || null,
      sort_order: Number(actionForm.sort_order || 0),
    }

    const url = editingActionId
      ? `/api/settings/estimate/rule-actions/${editingActionId}`
      : `/api/settings/estimate/rules/${selectedRuleId}/actions`
    const method = editingActionId ? 'PATCH' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json().catch(() => ({}))

      if (!res.ok) return showToast(`Lỗi: ${j.error || 'Không thể lưu hành động'}`)

      await loadAll()
      setEditingActionId(null)
      setActionForm({ action_type: 'suggest_value', target_key: '', value_text: '', value_number: '', formula_expr: '', sort_order: '0' })
      showToast(editingActionId ? 'Đã cập nhật hành động thành công' : 'Đã thêm hành động mới thành công')
    } catch (error) {
      showToast('Lỗi kết nối hệ thống khi lưu hành động')
    }
  }

  async function removeAction(id: string) {
    if (!confirm('Bạn có chắc chắn muốn xóa hành động này không?')) return
    try {
      const res = await fetch(`/api/settings/estimate/rule-actions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await loadAll()
      showToast('Đã xóa hành động thành công')
    } catch (error) {
      showToast('Không thể xóa hành động, vui lòng thử lại sau')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 70 }}>
        <span className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    )
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
          ESTIMATE V2 SETTINGS
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
          Quản lý đầu vào Dự toán
        </h1>
        <button className="btn-primary" onClick={seedV2} style={{ fontSize: 12 }}>
          Khởi tạo dữ liệu mẫu
        </button>
      </div>

      {toast && <div style={{ marginBottom: 12, color: 'var(--green)', fontSize: 13 }}>{toast}</div>}

      <section className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div>
            <h3 style={{ margin: 0 }}>Ma trận loại block và trường dữ liệu</h3>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text3)' }}>
              Khối này giúp team cấu hình đúng ngay từ đầu: mỗi loại block chỉ nên đi với một nhóm trường phù hợp.
            </div>
          </div>
          <button className="btn btn-ghost" onClick={() => setComponentGuideOpen((v) => !v)}>
            {componentGuideOpen ? 'Ẩn hướng dẫn' : 'Hiện hướng dẫn'}
          </button>
        </div>
        {componentGuideOpen && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
            {COMPONENT_FIELD_MATRIX.map((row) => (
              <div key={row.component} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'rgba(148,163,184,.05)' }}>
                {(() => {
                  const visual = getAssemblyComponentVisual(row.componentType)
                  return (
                    <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 999, background: visual.color, boxShadow: `0 0 0 3px ${visual.color}22`, flex: '0 0 auto' }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{row.component}</div>
                  <span style={{ fontSize: 10, color: 'var(--text3)', padding: '3px 8px', borderRadius: 999, border: `1px solid ${visual.color}55`, background: `${visual.color}14`, fontFamily: "'JetBrains Mono', monospace" }}>
                    {visual.badge}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>{row.meaning}</div>
                <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700, marginBottom: 4 }}>Nên dùng</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {row.allowed.map((item) => (
                    <span key={`${row.component}:${item}:ok`} style={{ fontSize: 11, color: 'var(--text2)', padding: '4px 8px', borderRadius: 999, border: '1px solid rgba(34,197,94,.28)', background: 'rgba(34,197,94,.08)' }}>
                      {item}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 700, marginBottom: 4 }}>Nên ẩn / không dùng</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {row.hidden.map((item) => (
                    <span key={`${row.component}:${item}:no`} style={{ fontSize: 11, color: 'var(--text2)', padding: '4px 8px', borderRadius: 999, border: '1px solid rgba(249,115,22,.28)', background: 'rgba(249,115,22,.08)' }}>
                      {item}
                    </span>
                  ))}
                </div>
                    </>
                  )
                })()}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Danh mục hạng mục (Catalog)</h3>
          <button className="btn btn-ghost" onClick={() => setCatalogOpen((v) => !v)}>
            {catalogOpen ? 'Ẩn khối' : 'Hiện khối'}
          </button>
        </div>
        {catalogOpen && (
          <>

        {/* Form row with labels */}
        {/* Header Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.3fr 1fr 1fr .8fr 180px', // Đặt kích thước cố định cho cột Hành động
          gap: 8,
          marginBottom: 8,
          alignItems: 'center'
        }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Mã hạng mục</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Tên hạng mục</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Loại (Type)</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Nhóm (Group)</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Đơn vị</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Hành động</div>
        </div>

        {/* Form Input Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.3fr 1fr 1fr .8fr 180px', // Khớp chính xác với Header
          gap: 8,
          marginBottom: 12,
          alignItems: 'center'
        }}>
          <input
            className="input"
            style={{ textAlign: 'center' }} // Căn giữa chữ trong input
            placeholder="VD: MAT_GACH"
            value={catalogForm.item_code}
            onChange={(e) => setCatalogForm((p) => ({ ...p, item_code: e.target.value }))}
          />
          <input
            className="input"
            style={{ textAlign: 'center' }}
            placeholder="VD: Gạch ốp lát"
            value={catalogForm.item_name}
            onChange={(e) => setCatalogForm((p) => ({ ...p, item_name: e.target.value }))}
          />
          <select className="select" value={catalogForm.item_type} onChange={(e) => setCatalogForm((p) => ({ ...p, item_type: e.target.value }))}>
            {itemTypeOptions.map((x) => <option key={x.value} value={x.value}>{x.name}</option>)}
          </select>
          <select className="select" value={catalogForm.item_group} onChange={(e) => setCatalogForm((p) => ({ ...p, item_group: e.target.value }))}>
            {itemGroupOptions.map((x) => <option key={x.value} value={x.value}>{x.name}</option>)}
          </select>
          <select className="select" value={catalogForm.item_unit} onChange={(e) => setCatalogForm((p) => ({ ...p, item_unit: e.target.value }))}>
            {itemUnitOptions.map((x) => <option key={x.value} value={x.value}>{x.name}</option>)}
          </select>

          {/* Cột hành động chứa 2 nút */}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
            <button className="btn-primary" style={{ flex: 1, whiteSpace: 'nowrap' }} onClick={saveCatalog}>
              {editingCatalogId ? 'Lưu' : '+ Tạo'}
            </button>
            <button className="btn btn-ghost" style={{ flex: 1, whiteSpace: 'nowrap' }} onClick={resetCatalogForm}>Làm mới</button>
          </div>
        </div>

        {/* Table with column headers */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {/* Header: Dùng chung cấu trúc cột với Form nhập liệu */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.3fr 1fr 1fr .8fr 180px', // Khớp chính xác con số 180px ở trên
            gap: 8,
            padding: '10px 12px',
            background: 'var(--bg2, rgba(0,0,0,0.04))',
            borderBottom: '1px solid var(--border)',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>MÃ HẠNG MỤC</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>TÊN HẠNG MỤC</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>LOẠI</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>NHÓM</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>ĐƠN VỊ</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>HÀNH ĐỘNG</div>
          </div>

          {/* Body: Danh sách cuộn */}
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {catalog.map((it) => (
              <div
                key={it.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.3fr 1fr 1fr .8fr 180px', // Đồng bộ cấu trúc
                  gap: 8,
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center',
                  transition: 'background 0.2s'
                }}
                className="table-row-hover" // Bạn có thể thêm css hover vào đây
              >
                <div style={{
                  color: 'var(--blue)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  textAlign: 'center',
                  fontWeight: 500
                }}>
                  {it.item_code}
                </div>

                <div style={{ textAlign: 'center', fontSize: 13 }}>{it.item_name}</div>

                <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>
                  {/* Tìm label từ options nếu it.item_type chỉ là value */}
                  {itemTypeOptions.find(o => o.value === it.item_type)?.name || it.item_type}
                </div>

                <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>
                  {itemGroupOptions.find(o => o.value === it.item_group)?.name || it.item_group}
                </div>

                <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>
                  {itemUnitOptions.find(o => o.value === it.item_unit)?.name || it.item_unit}
                </div>

                {/* Cột nút bấm: Căn giữa và khoảng cách đều */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <button
                    className="btn btn-ghost"
                    style={{ height: 28, padding: '0 12px', fontSize: 12 }}
                    onClick={() => {
                      setEditingCatalogId(it.id);
                      setCatalogForm({
                        item_code: it.item_code,
                        item_name: it.item_name,
                        item_type: it.item_type,
                        item_group: it.item_group,
                        item_unit: it.item_unit,
                      });
                    }}
                  >
                    Sửa
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ height: 28, padding: '0 12px', fontSize: 12 }}
                    onClick={() => removeCatalog(it.id)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}

            {catalog.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                Chưa có dữ liệu hạng mục.
              </div>
            )}
          </div>
        </div>
          </>
        )}
      </section>

      <section className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Bộ mẫu định mức và hạng mục</h3>
          <button className="btn btn-ghost" onClick={() => setTemplateOpen((v) => !v)}>
            {templateOpen ? 'Ẩn khối' : 'Hiện khối'}
          </button>
        </div>
        {templateOpen && (
          <>
        <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text3)' }}>
          Mỗi template là một bộ định mức. Bên trong template sẽ có nhiều dòng hạng mục để quy đổi block/phòng thành số lượng vật tư, nhân công hoặc thiết bị.
        </div>

        {/* Template form with labels */}
        {/* Header: Nhãn tiêu đề */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.3fr 1fr 1fr 1fr 1fr .8fr .8fr 160px', // Đồng bộ tỷ lệ cột
          gap: 8,
          marginBottom: 6,
          alignItems: 'center'
        }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Mã template</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Tên template</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Loại</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Loại nhà</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Phong cách</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Hoàn thiện</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Ưu tiên</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Ver</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Hành động</div>
        </div>

        {/* Form Input */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.3fr 1fr 1fr 1fr 1fr .8fr .8fr 160px', // Khớp chính xác với Header
          gap: 8,
          marginBottom: 12,
          alignItems: 'center'
        }}>
          <input className="input" placeholder="VD: TPL_NHA_PHO" value={templateForm.template_code} onChange={(e) => setTemplateForm((p) => ({ ...p, template_code: e.target.value }))} />
          <input className="input" placeholder="VD: Nhà phố" value={templateForm.template_name} onChange={(e) => setTemplateForm((p) => ({ ...p, template_name: e.target.value }))} />

          <select className="select" value={templateForm.template_type} onChange={(e) => setTemplateForm((p) => ({ ...p, template_type: e.target.value }))}>
            {templateTypeOptions.map((x) => <option key={x.value} value={x.value}>{x.name}</option>)}
          </select>

          <select className="select" value={templateForm.house_type} onChange={(e) => setTemplateForm((p) => ({ ...p, house_type: e.target.value }))}>
            <option value="">(Tất cả)</option>
            {houseTypeOptions.map((x) => <option key={x.value} value={x.value}>{x.name}</option>)}
          </select>

          <select className="select" value={templateForm.style} onChange={(e) => setTemplateForm((p) => ({ ...p, style: e.target.value }))}>
            <option value="">(Tất cả)</option>
            {styleOptions.map((x) => <option key={x.value} value={x.value}>{x.name}</option>)}
          </select>

          <select className="select" value={templateForm.finish_level} onChange={(e) => setTemplateForm((p) => ({ ...p, finish_level: e.target.value }))}>
            <option value="">(Tất cả)</option>
            {levelOptions.map((x) => <option key={x.value} value={x.value}>{x.name}</option>)}
          </select>

          {/* Ưu tiên & Version căn giữa chữ cho gọn */}
          <input className="input" style={{ textAlign: 'center' }} placeholder="0" value={templateForm.priority} onChange={(e) => setTemplateForm((p) => ({ ...p, priority: e.target.value }))} />
          <input className="input" style={{ textAlign: 'center' }} placeholder="1" value={templateForm.version} onChange={(e) => setTemplateForm((p) => ({ ...p, version: e.target.value }))} />

          {/* Cụm nút hành động */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn-primary" style={{ flex: 1, padding: '0 4px', whiteSpace: 'nowrap', fontSize: 12 }} onClick={saveTemplate}>
              {editingTemplateId ? 'Lưu' : 'Tạo'}
            </button>
            <button className="btn btn-ghost" style={{ flex: 1, padding: '0 4px', whiteSpace: 'nowrap', fontSize: 12 }} onClick={resetTemplateForm}>Xóa</button>
          </div>
        </div>

        {/* Template selector */}
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' }}>Template đang chọn:</span>
          <select className="select" style={{ minWidth: 420 }} value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
            <option value="">-- Chọn template để cấu hình hạng mục --</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.template_name} ({t.template_code}) v{t.version}
              </option>
            ))}
          </select>
        </div>

        {selectedTemplate && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr .8fr .8fr .8fr', gap: 10, marginBottom: 14 }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'rgba(255,255,255,.02)' }}>
              <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 4 }}>BỘ MẪU ĐANG CHỌN</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{selectedTemplate.template_name}</div>
              <div style={{ fontSize: 11, color: 'var(--blue)', fontFamily: "'JetBrains Mono', monospace" }}>{selectedTemplate.template_code} · v{selectedTemplate.version}</div>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 4 }}>Loại bộ mẫu</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{activeTemplateTypeGuide?.label || selectedTemplate.template_type || '-'}</div>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 4 }}>Loại nhà</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedTemplate.house_type || 'Tất cả'}</div>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 4 }}>Hoàn thiện</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedTemplate.finish_level || 'Tất cả'}</div>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 4 }}>Số dòng định mức</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--orange)' }}>{selectedTemplateItemCount}</div>
            </div>
          </div>
        )}
        {selectedTemplate && activeTemplateTypeGuide && (
          <div style={{ marginBottom: 14, border: '1px solid rgba(59,130,246,.22)', background: 'rgba(59,130,246,.06)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 6 }}>GỢI Ý ĐƠN GIẢN THEO LOẠI BỘ MẪU</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              {activeTemplateTypeGuide.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
              {activeTemplateTypeGuide.meaning}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 4 }}>Cách tính nên ưu tiên</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {activeTemplateTypeGuide.suggestedApplyModes.map((mode) => (
                    <span key={mode} style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '4px 8px', fontSize: 11, color: 'var(--text2)', background: 'rgba(255,255,255,.04)' }}>
                      {getApplyModeMeta(mode).label}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 4 }}>Chỉ số nền đang gợi ý sẵn</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {activeTemplateTypeGuide.preferredBasisKeys.map((key) => (
                    <span key={key} style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '4px 8px', fontSize: 11, color: 'var(--text2)', background: 'rgba(255,255,255,.04)' }}>
                      {getFactKeyLabel(key)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Templates table with column headers */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
          {/* Header: Khớp tỷ lệ với Form nhập liệu */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.3fr 1fr 1fr 1fr 1fr .8fr .8fr 180px', // Khớp 100% với form ở trên
            gap: 8,
            padding: '10px 12px',
            background: 'var(--bg2, rgba(0,0,0,0.04))',
            borderBottom: '1px solid var(--border)',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'left' }}>TÊN / MÃ TEMPLATE</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>LOẠI</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>LOẠI NHÀ</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>PHONG CÁCH</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>HOÀN THIỆN</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>ƯU TIÊN</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>VER.</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>TRẠNG THÁI</div> {/* Cột hiển thị trạng thái On/Off */}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>HÀNH ĐỘNG</div>
          </div>

          {/* Body: Danh sách Template */}
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {templates.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.3fr 1fr 1fr 1fr 1fr .8fr .8fr 180px', // Phải giống hệt Header ở trên
                  gap: 8,
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center',
                  opacity: t.is_active ? 1 : 0.6, // Làm mờ nhẹ nếu template đang tắt
                  background: t.is_active ? 'transparent' : 'var(--bg-dim, rgba(0,0,0,0.02))'
                }}
              >
                {/* Tên & Mã */}
                <div style={{ fontSize: 13 }}>
                  <div style={{ fontWeight: 500 }}>{t.template_name}</div>
                  <div style={{ color: 'var(--blue)', fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>{t.template_code}</div>
                </div>

                {/* Các thông tin loại (căn giữa) */}
                <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>{t.template_type}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>{t.house_type || <span style={{ color: 'var(--text4)' }}>-</span>}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>{t.style || <span style={{ color: 'var(--text4)' }}>-</span>}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>{t.finish_level || <span style={{ color: 'var(--text4)' }}>-</span>}</div>

                {/* Ưu tiên & Phiên bản */}
                <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>{t.priority || 0}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>v{t.version}</div>

                {/* Trạng thái Bật/Tắt */}
                <div style={{ textAlign: 'center' }}>
                  <span style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: t.is_active ? 'var(--green-soft, #e6f4ea)' : 'var(--red-soft, #fce8e6)',
                    color: t.is_active ? 'var(--green, #1e8e3e)' : 'var(--red, #d93025)'
                  }}>
                    {t.is_active ? 'ON' : 'OFF'}
                  </span>
                </div>

                {/* Nhóm nút hành động */}
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                  <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px', fontSize: 11 }} onClick={() => setSelectedTemplateId(t.id)}>Chọn</button>
                  <button
                    className="btn btn-ghost"
                    style={{ height: 26, padding: '0 8px', fontSize: 11, color: t.is_active ? 'orange' : 'var(--blue)' }}
                    onClick={async () => {
                      await fetch(`/api/settings/estimate/templates/${t.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ is_active: !t.is_active }),
                      })
                      await loadAll()
                    }}
                  >
                    {t.is_active ? 'Tắt' : 'Bật'}
                  </button>
                  <button className="btn btn-danger" style={{ height: 26, padding: '0 8px', fontSize: 11 }} onClick={() => removeTemplate(t.id)}>Xóa</button>
                </div>
              </div>
            ))}
          </div>
        </div>


        {/* Template Items sub-section */}
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>
          Cấu hình dòng định mức trong bộ mẫu
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
          Mỗi dòng định mức trả lời 4 câu hỏi: dùng hạng mục nào, áp cho phạm vi nào, lấy số liệu từ đâu và tính số lượng theo cách nào.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 12, marginBottom: 12 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 6 }}>DIỄN GIẢI DÒNG ĐỊNH MỨC ĐANG NHẬP</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              {selectedCatalogItem?.item_name || 'Chưa chọn hạng mục'}
            </div>
            <div style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
              <div><strong>Cách tính:</strong> {applyModeMeta.label}</div>
              <div><strong>Phạm vi áp dụng:</strong> {scopeLabel}</div>
              <div><strong>Lấy số liệu từ:</strong> {basisLabel}</div>
              <div><strong>Hệ số / số lượng:</strong> {templateItemForm.quantity_value || '0'}</div>
              <div><strong>Hao hụt:</strong> {templateItemForm.waste_factor || '0'} {templateItemForm.waste_factor ? '(tỷ lệ)' : ''}</div>
              <div><strong>Giải thích:</strong> {applyModeMeta.hint}</div>
            </div>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'rgba(255,255,255,.02)' }}>
            <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 6 }}>XEM THỬ THEO ITEM THẬT TRONG TEMPLATE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8, marginBottom: 10, alignItems: 'end' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Item cần xem thử</div>
                <select className="select" value={selectedPreviewTemplateItemId} onChange={(e) => {
                  setSelectedPreviewTemplateItemId(e.target.value)
                  setPreviewManualFacts({})
                }}>
                  <option value="">Chọn item trong template</option>
                  {(selectedTemplate?.items || []).map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.catalog_item?.item_name || it.catalog_item_id} - {getApplyModeMeta(it.apply_mode).label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 4 }}>Vật tư / hạng mục đang xem</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{previewTemplateItem?.catalog_item?.item_name || 'Chưa chọn item'}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {previewApplyModeMeta.label} · {previewUseManualScope ? (blockPreviewForm.room_type || 'Mẫu nhập tay') : previewScopeLabel}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
              Chọn item thật trong template. Hệ thống sẽ đọc `quantity_basis_key`, `required_facts`, `formula_expr` của item đó để hiện đúng dữ liệu đầu vào và cách tính.
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 8 }}>KHỐI / PHÒNG MẪU NHẬP TAY</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {previewTemplateItem?.scope_key && !previewUseManualScope
                    ? `Phạm vi đang lấy theo item: ${previewScopeLabel}`
                    : 'Bạn đang dùng mẫu nhập tay cho phạm vi / loại phòng.'}
                </div>
                <button className="btn btn-ghost" onClick={() => setPreviewUseManualScope((v) => !v)}>
                  {previewUseManualScope ? 'Dùng phạm vi của item' : 'Mẫu nhập tay'}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `${previewUseManualScope || !previewTemplateItem?.scope_key ? '1fr ' : ''}repeat(8, minmax(0,1fr))`, gap: 8 }}>
                {(previewUseManualScope || !previewTemplateItem?.scope_key) && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Loại phòng / phạm vi</div>
                    <select
                      className="select"
                      value={blockPreviewForm.room_type}
                      onChange={(e) => setBlockPreviewForm((prev) => ({ ...prev, room_type: e.target.value }))}
                    >
                      <option value="">Chưa chọn</option>
                      {scopeOptionsForTemplateItem.map((x) => <option key={x.value} value={x.value}>{x.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Dài (m)</div>
                  <input className="input" value={blockPreviewForm.length} onChange={(e) => setBlockPreviewForm((prev) => ({ ...prev, length: e.target.value }))} style={{ textAlign: 'center' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Rộng (m)</div>
                  <input className="input" value={blockPreviewForm.width} onChange={(e) => setBlockPreviewForm((prev) => ({ ...prev, width: e.target.value }))} style={{ textAlign: 'center' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Cao (m)</div>
                  <input className="input" value={blockPreviewForm.height} onChange={(e) => setBlockPreviewForm((prev) => ({ ...prev, height: e.target.value }))} style={{ textAlign: 'center' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ô mở (m2)</div>
                  <input className="input" value={blockPreviewForm.openings_area} onChange={(e) => setBlockPreviewForm((prev) => ({ ...prev, openings_area: e.target.value }))} style={{ textAlign: 'center' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Số cửa đi</div>
                  <input className="input" value={blockPreviewForm.door_count} onChange={(e) => setBlockPreviewForm((prev) => ({ ...prev, door_count: e.target.value }))} style={{ textAlign: 'center' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Số cửa sổ</div>
                  <input className="input" value={blockPreviewForm.window_count} onChange={(e) => setBlockPreviewForm((prev) => ({ ...prev, window_count: e.target.value }))} style={{ textAlign: 'center' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Số ô thoáng</div>
                  <input className="input" value={blockPreviewForm.vent_count} onChange={(e) => setBlockPreviewForm((prev) => ({ ...prev, vent_count: e.target.value }))} style={{ textAlign: 'center' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Số lượng block</div>
                  <input className="input" value={blockPreviewForm.quantity} onChange={(e) => setBlockPreviewForm((prev) => ({ ...prev, quantity: e.target.value }))} style={{ textAlign: 'center' }} />
                </div>
              </div>
            </div>
            {previewUnknownFormulaFacts.length > 0 && (
              <div style={{ marginBottom: 10, border: '1px solid rgba(245,158,11,.35)', background: 'rgba(245,158,11,.08)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 700, marginBottom: 4 }}>
                  Cảnh báo xem thử công thức
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  Công thức đang dùng fact chưa có nhãn hoặc chưa có trong preview: {previewUnknownFormulaFacts.join(', ')}.
                </div>
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 6 }}>GIÁ TRỊ ĐẦU VÀO ĐANG DÙNG CHO ITEM</div>
            {previewInputKeys.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Item này chưa yêu cầu dữ liệu đầu vào cụ thể.</div>
            )}
            {previewDerivedInputKeys.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 6 }}>Fact tự suy ra từ block nhập tay</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8, marginBottom: 10 }}>
                  {previewDerivedInputKeys.map((key) => (
                    <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 4 }}>{getFactKeyLabel(key, factLabelMap[key])}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                        {Number(previewFactNumbers[key] || 0).toFixed(2).replace(/\.00$/, '')}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 4 }}>
                        Tự suy ra từ block nhập tay
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {previewManualInputKeys.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 6 }}>Fact cần nhập / xác nhận thêm</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8, marginBottom: 10 }}>
                  {previewManualInputKeys.map((key) => (
                    <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 4 }}>{getFactKeyLabel(key, factLabelMap[key])}</div>
                      {key === 'room_type' ? (
                        previewUseManualScope || !previewTemplateItem?.scope_key ? (
                          <input
                            className="input"
                            value={blockPreviewForm.room_type}
                            onChange={(e) => setBlockPreviewForm((prev) => ({ ...prev, room_type: e.target.value }))}
                          />
                        ) : (
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{previewScopeLabel}</div>
                        )
                      ) : (
                        <input
                          className="input"
                          value={previewManualFacts[key] || ''}
                          onChange={(e) => setPreviewManualFacts((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder={`Nhập ${getFactKeyLabel(key, factLabelMap[key])}`}
                          style={{ textAlign: 'center' }}
                        />
                      )}
                      <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 4 }}>
                        {key === 'room_type' && !(previewUseManualScope || !previewTemplateItem?.scope_key)
                          ? 'Đang bám theo phạm vi của item'
                          : 'Nhập tay theo item đang xem'}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text4)' }}>Giá trị nền</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{previewBasisValue}</div>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text4)' }}>Số lượng gốc</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{previewQuantity.base.toFixed(2)}</div>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text4)' }}>Sau hao hụt</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--orange)' }}>{previewQuantity.finalQty.toFixed(2)}</div>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text4)' }}>Công thức xem thử</div>
                <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>
                  {!previewTemplateItem ? 'Chưa chọn item'
                    : previewTemplateItem.apply_mode === 'formula'
                    ? (previewFormulaResult.error || previewTemplateItem.formula_expr || 'Chưa có công thức')
                    : `${previewBasisLabel} x ${previewTemplateItem.quantity_value || '0'}`}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 4 }}>
                  {previewTemplateItem
                    ? `Kết quả: ${previewQuantity.base.toFixed(2)} x ${previewQuantity.wasteMultiplier.toFixed(2)} = ${previewQuantity.finalQty.toFixed(2)}`
                    : 'Chọn item để xem phép tính'}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 10, border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 12, background: 'rgba(255,255,255,.02)' }}>
              <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 6 }}>DIỄN GIẢI PHÉP TÍNH</div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                {previewExplainText}
              </div>
            </div>
          </div>
        </div>

        {/* Template items form with labels */}
        {/* Header: Nhãn tiêu đề */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.3fr .8fr .9fr .9fr .8fr .9fr 1.1fr .8fr .8fr 160px', // Cố định cột hành động 160px
          gap: 8,
          marginBottom: 4,
          alignItems: 'center'
        }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Hạng mục đầu ra</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Cách tính</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Lấy số liệu từ</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Phạm vi áp dụng</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Hệ số</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Công thức tính</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Thông tin bắt buộc</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Hao hụt</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Thứ tự</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Hành động</div>
        </div>

        {/* Form Input Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.3fr .8fr .9fr .9fr .8fr .9fr 1.1fr .8fr .8fr 160px',
          gap: 8,
          marginBottom: 10,
          alignItems: 'center'
        }}>
          <select className="select" value={templateItemForm.catalog_item_id} onChange={(e) => setTemplateItemForm((p) => ({ ...p, catalog_item_id: e.target.value }))}>
            <option value="">Chọn hạng mục đầu ra</option>
            {catalog.map((x) => <option key={x.id} value={x.id}>{x.item_name} ({x.item_code})</option>)}
          </select>

          <select className="select" value={templateItemForm.apply_mode} onChange={(e) => setTemplateItemForm((p) => ({ ...p, apply_mode: e.target.value }))}>
            {APPLY_MODE_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>

          <select className="select" value={templateItemForm.quantity_basis_key} onChange={(e) => setTemplateItemForm((p) => ({ ...p, quantity_basis_key: e.target.value }))}>
            <option value="">Chọn chỉ số nền</option>
            {quantityBasisOptionsForTemplateItem.map((x) => <option key={`${x.value}`} value={x.value}>{x.name}</option>)}
          </select>

          <select className="select" value={templateItemForm.scope_key} onChange={(e) => setTemplateItemForm((p) => ({ ...p, scope_key: e.target.value }))}>
            <option value="">Áp cho mọi phạm vi</option>
            {scopeOptionsForTemplateItem.map((x) => <option key={`${x.value}`} value={x.value}>{x.name}</option>)}
          </select>

          <input className="input" style={{ textAlign: 'center' }} placeholder="VD: 10 hoặc 1.5" value={templateItemForm.quantity_value} onChange={(e) => setTemplateItemForm((p) => ({ ...p, quantity_value: e.target.value }))} />

          {/* Formula Display */}
          <div className="input" style={{ minHeight: 36, display: 'flex', alignItems: 'center', overflowX: 'auto', whiteSpace: 'nowrap', fontSize: 12, padding: '0 8px' }}>
            {formulaTokens.length ? formulaTokens.join(' ') : <span style={{ color: 'var(--text4)', fontSize: 10 }}>Dùng trình dựng công thức phía dưới</span>}
          </div>

          {/* Required Facts Display */}
          <div className="input" style={{ minHeight: 36, display: 'flex', gap: 4, alignItems: 'center', overflowX: 'auto', whiteSpace: 'nowrap', padding: '0 8px' }}>
            {selectedRequiredFacts.length ? selectedRequiredFacts.map((f) => (
              <span key={f} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', fontSize: 10, color: 'var(--text2)' }}>
                {f}
              </span>
            )) : <span style={{ color: 'var(--text4)', fontSize: 10 }}>Chưa chọn thông tin bắt buộc</span>}
          </div>

          <input className="input" style={{ textAlign: 'center' }} placeholder="VD: 0.05 = 5%" value={templateItemForm.waste_factor} onChange={(e) => setTemplateItemForm((p) => ({ ...p, waste_factor: e.target.value }))} />
          <input className="input" style={{ textAlign: 'center' }} placeholder="0" value={templateItemForm.sort_order} onChange={(e) => setTemplateItemForm((p) => ({ ...p, sort_order: e.target.value }))} />

          {/* Cụm nút hành động */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn-primary" style={{ flex: 1.2, whiteSpace: 'nowrap', padding: '0 4px', fontSize: 12 }} onClick={saveTemplateItem}>
              {editingTemplateItemId ? 'Lưu' : '+ Item'}
            </button>
            <button className="btn btn-ghost" style={{ flex: 0.8, whiteSpace: 'nowrap', padding: '0 4px', fontSize: 12 }} onClick={resetTemplateItemForm}>
              Mới
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: -4, marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)', display: 'grid', gap: 3 }}>
            <div>
              {showAllBasisOptions
                ? 'Đang hiện đầy đủ mọi chỉ số nền, kể cả các chỉ số nâng cao.'
                : 'Đang lọc chỉ số nền theo loại bộ mẫu để bạn dễ chọn đúng hơn.'}
            </div>
            <div>
              {showAllScopeOptions
                ? 'Phạm vi áp dụng đang hiện đầy đủ, gồm cả các phạm vi ít dùng.'
                : 'Phạm vi áp dụng cũng đang được rút gọn theo loại bộ mẫu để tránh chọn nhầm.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '0 10px', height: 28 }} onClick={() => setShowAllBasisOptions((v) => !v)}>
              {showAllBasisOptions ? 'Chỉ hiện basis gợi ý' : 'Hiện tất cả chỉ số'}
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '0 10px', height: 28 }} onClick={() => setShowAllScopeOptions((v) => !v)}>
              {showAllScopeOptions ? 'Chỉ hiện scope gợi ý' : 'Hiện tất cả phạm vi'}
            </button>
          </div>
        </div>
        {templateItemConfigWarnings.length > 0 && (
          <div style={{ marginTop: -2, marginBottom: 10, border: '1px solid rgba(245,158,11,.35)', background: 'rgba(245,158,11,.08)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 700, marginBottom: 4 }}>
              Kiểm tra nhanh dòng định mức
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              {templateItemConfigWarnings.map((warning, idx) => (
                <div key={`${warning}-${idx}`} style={{ fontSize: 12, color: 'var(--text2)' }}>
                  - {warning}
                </div>
              ))}
            </div>
          </div>
        )}
        {(templateItemLegacyMode || templateItemLegacyScope) && (
          <div style={{ marginTop: -2, marginBottom: 10, border: '1px solid rgba(245,158,11,.35)', background: 'rgba(245,158,11,.08)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 700, marginBottom: 4 }}>
              Cảnh báo legacy mapping
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              Item này đang dùng cơ chế cũ ({templateItemLegacyMode ? 'apply_mode legacy' : 'scope legacy'}). Dữ liệu mới nên dùng `per_area/per_unit` + `quantity_basis_key` theo `component_type`.
            </div>
          </div>
        )}

        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700, marginBottom: 8 }}>Formula Builder (DB-driven)</div>
          {formulaFactOptions.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--orange)', marginBottom: 8 }}>
              Chua co taxonomy `fact_key`. Cau hinh trong `/settings/estimate-taxonomies`.
            </div>
          )}
          {formulaPresetOptions.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--orange)', marginBottom: 8 }}>
              Chua co `formula_preset` (expression nam trong `description`).
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto auto auto auto', gap: 8, marginBottom: 8 }}>
            <select className="select" value={formulaToken} onChange={(e) => setFormulaToken(e.target.value)}>
              <option value="">Chọn biến từ fact_key...</option>
              {formulaFactOptions.map((f) => <option key={f.value} value={f.value}>{f.value} - {f.name}</option>)}
            </select>
            <button className="btn btn-ghost" onClick={() => appendFormulaToken(formulaToken)}>+ Biến</button>
            <button className="btn btn-ghost" onClick={() => appendFormulaToken('+')}>+</button>
            <button className="btn btn-ghost" onClick={() => appendFormulaToken('-')}>-</button>
            <button className="btn btn-ghost" onClick={() => appendFormulaToken('*')}>*</button>
            <button className="btn btn-ghost" onClick={() => appendFormulaToken('/')}>/</button>
            <button className="btn btn-ghost" onClick={() => appendFormulaToken('(')}>(</button>
            <button className="btn btn-ghost" onClick={() => appendFormulaToken(')')}>)</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, marginBottom: 8 }}>
            <select className="select" value={requiredFactToAdd} onChange={(e) => setRequiredFactToAdd(e.target.value)}>
              <option value="">Thêm required fact...</option>
              {requiredFactOptions.filter((f) => !selectedRequiredFacts.includes(f.value)).map((f) => (
                <option key={f.value} value={f.value}>{f.value} - {f.name}</option>
              ))}
            </select>
            <button
              className="btn btn-ghost"
              onClick={() => {
                if (!requiredFactToAdd) return
                if (selectedRequiredFacts.includes(requiredFactToAdd)) return
                setSelectedRequiredFacts((prev) => [...prev, requiredFactToAdd])
                setRequiredFactToAdd('')
              }}
            >
              + Required
            </button>
            <button className="btn btn-ghost" onClick={() => setSelectedRequiredFacts([])}>Clear Required</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {selectedRequiredFacts.map((f) => (
              <button
                key={f}
                className="btn btn-ghost"
                onClick={() => setSelectedRequiredFacts((prev) => prev.filter((x) => x !== f))}
                style={{ fontSize: 11 }}
              >
                {f} ×
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
            <select
              className="select"
              value=""
              onChange={(e) => {
                const v = e.target.value
                if (!v) return
                const found = formulaPresetOptions.find((x) => x.value === v)
                if (!found) return
                const tokens = tokenizeFormula(found.expr)
                setFormulaTokens(tokens)
                setTemplateItemForm((p) => ({ ...p, formula_expr: tokens.join(' ') }))
                e.currentTarget.value = ''
              }}
            >
              <option value="">Ap formula preset tu DB...</option>
              {filteredFormulaPresetGroups.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.items.map((p) => (
                    <option key={p.value} value={p.value}>{p.shortName}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setFormulaTokens([])
                setTemplateItemForm((x) => ({ ...x, formula_expr: '' }))
              }}
            >
              Clear Formula
            </button>
          </div>
          {filteredFormulaPresetGroups.length > 0 && (
            <div style={{ display: 'grid', gap: 10, marginBottom: 8 }}>
              {filteredFormulaPresetGroups.map((group) => (
                <div key={group.group} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'rgba(255,255,255,.02)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 6 }}>{group.group}</div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {group.items.map((p) => (
                      <div key={p.value} style={{ display: 'grid', gap: 2 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{p.shortName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                          {p.hint || `Cong thuc: ${p.expr}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {formulaTokens.map((t, idx) => (
              <button
                key={`${t}-${idx}`}
                className="btn btn-ghost"
                style={{ fontSize: 11 }}
                onClick={() => {
                  setFormulaTokens((prev) => {
                    const next = prev.filter((_, i) => i !== idx)
                    setTemplateItemForm((p) => ({ ...p, formula_expr: next.join(' ') }))
                    return next
                  })
                }}
              >
                {t} ×
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            Preset lay tu taxonomy kind `formula_preset`, expression o `description`, dang duoc nhom va loc theo loai bo mau de de chon hon.
          </div>
        </div>

        {/* Template items table with headers */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {/* Header: Khớp 100% tỷ lệ với hàng nhập liệu phía trên */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.3fr .8fr .9fr .9fr .8fr .9fr 1.1fr .8fr .8fr 160px',
            gap: 8,
            padding: '10px 12px',
            background: 'var(--bg2, rgba(0,0,0,0.04))',
            borderBottom: '1px solid var(--border)',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>HẠNG MỤC</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>CÁCH TÍNH</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>CHỈ SỐ NỀN</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>PHẠM VI</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>HỆ SỐ</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>CÔNG THỨC</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>FACT BẮT BUỘC</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>HAO HỤT</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>THỨ TỰ</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>THAO TÁC</div>
          </div>

          {/* Body */}
          <div style={{ maxHeight: 350, overflowY: 'auto' }}>
            {(selectedTemplate?.items || []).map((it) => (
              <div
                key={it.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.3fr .8fr .9fr .9fr .8fr .9fr 1.1fr .8fr .8fr 160px',
                  gap: 8,
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center',
                  opacity: it.is_active ? 1 : 0.6
                }}
              >
                {/* Catalog Item */}
                <div style={{ fontSize: 12, fontWeight: 500 }}>
                  <div>{it.catalog_item?.item_name || <span style={{ color: 'var(--text4)' }}>{it.catalog_item_id}</span>}</div>
                  <div style={{ fontSize: 10, color: 'var(--text4)' }}>
                    {it.catalog_item?.item_code || 'chưa có mã'} · {it.catalog_item?.item_unit || 'đơn vị chưa rõ'}
                  </div>
                </div>

                {/* Apply Mode with Legacy Badge */}
                <div style={{ fontSize: 11, color: 'var(--blue)', textAlign: 'center' }}>
                  {getApplyModeMeta(it.apply_mode).label}
                  {isLegacyApplyMode(it.apply_mode) && (
                    <div style={{ fontSize: 9, color: 'var(--orange)', marginTop: 2 }}>[legacy]</div>
                  )}
                </div>

                {/* Basis & Scope */}
                <div style={{ fontSize: 11, color: 'var(--text2)', textAlign: 'center' }}>{it.quantity_basis_key || '-'}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', textAlign: 'center' }}>
                  {it.scope_key || '-'}
                  {looksLikeLegacyScope(it.scope_key) && <div style={{ fontSize: 9, color: 'var(--orange)' }}>[legacy]</div>}
                </div>

                {/* Qty & Formula */}
                <div style={{ fontSize: 12, textAlign: 'center' }}>{it.quantity_value ?? '-'}</div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text2)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {it.formula_expr || '-'}
                </div>

                {/* Required Facts (Cột mới thêm để khớp form) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
                  {it.required_facts?.map(f => (
                    <span key={f} style={{ fontSize: 9, background: 'var(--bg3)', padding: '1px 4px', borderRadius: 4 }}>{f}</span>
                  )) || '-'}
                </div>

                {/* Waste Factor & Sort */}
                <div style={{ fontSize: 12, textAlign: 'center' }}>{it.waste_factor ?? '0'}</div>
                <div style={{ fontSize: 12, textAlign: 'center', color: 'var(--text3)' }}>{it.sort_order}</div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                  <button className="btn btn-ghost" style={{ height: 26, padding: '0 6px', fontSize: 11 }} onClick={() => startEditTemplateItem(it)}>Sửa</button>
                  <button
                    className="btn btn-ghost"
                    style={{ height: 26, padding: '0 6px', fontSize: 11, color: it.is_active ? 'var(--orange)' : 'var(--blue)' }}
                    onClick={async () => toggleTemplateItemActive(it)}
                  >
                    {it.is_active ? 'Tắt' : 'Bật'}
                  </button>
                  <button className="btn btn-danger" style={{ height: 26, padding: '0 6px', fontSize: 11 }} onClick={() => removeTemplateItem(it.id)}>Xóa</button>
                </div>
              </div>
            ))}
          </div>
        </div>
          </>
        )}
      </section>

      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div>
            <h3 style={{ margin: 0 }}>Nâng cao: Quy tắc (Rules)</h3>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text3)' }}>
              Khối này dành cho cấu hình suy diễn nâng cao. Nếu chỉ làm bộ định mức thông thường, bạn có thể bỏ qua.
            </div>
          </div>
          <button className="btn btn-ghost" onClick={() => setRulesOpen((v) => !v)}>
            {rulesOpen ? 'Ẩn khối nâng cao' : 'Hiện khối nâng cao'}
          </button>
        </div>
        {rulesOpen && (
          <>
        <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text3)' }}>
          Chọn quy tắc để form phía trên tự nạp dữ liệu, sau đó chỉnh sửa và lưu.
        </div>

        {/* Rule form with labels */}
        {/* Header: Nhãn tiêu đề Rule */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.4fr 1fr .8fr .8fr 160px', // Cố định 160px cho cụm hành động
          gap: 8,
          marginBottom: 6,
          alignItems: 'center'
        }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Mã rule</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Tên quy tắc</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Phạm vi (Scope)</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Ưu tiên</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Phiên bản</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>Hành động</div>
        </div>

        {/* Form Input Rule */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.4fr 1fr .8fr .8fr 160px', // Đồng bộ tỷ lệ với Header
          gap: 8,
          marginBottom: 12,
          alignItems: 'center'
        }}>
          <input
            className="input"
            placeholder="VD: RULE_NHA_PHO"
            style={{ fontFamily: 'monospace' }} // Mã rule thường dùng font mono sẽ chuyên nghiệp hơn
            value={ruleForm.rule_code}
            onChange={(e) => setRuleForm((p) => ({ ...p, rule_code: e.target.value }))}
          />
          <input
            className="input"
            placeholder="VD: Quy tắc nhà phố cơ bản"
            value={ruleForm.rule_name}
            onChange={(e) => setRuleForm((p) => ({ ...p, rule_name: e.target.value }))}
          />
          <input
            className="input"
            placeholder="foundation"
            style={{ textAlign: 'center' }} // Scope thường ngắn, căn giữa cho đẹp
            value={ruleForm.scope}
            onChange={(e) => setRuleForm((p) => ({ ...p, scope: e.target.value }))}
          />
          <input
            className="input"
            placeholder="0"
            style={{ textAlign: 'center' }} // Số căn giữa
            value={ruleForm.priority}
            onChange={(e) => setRuleForm((p) => ({ ...p, priority: e.target.value }))}
          />
          <input
            className="input"
            placeholder="1"
            style={{ textAlign: 'center' }} // Số căn giữa
            value={ruleForm.version}
            onChange={(e) => setRuleForm((p) => ({ ...p, version: e.target.value }))}
          />

          {/* Cụm nút bấm */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn-primary" style={{ flex: 1.2, whiteSpace: 'nowrap', fontSize: 12, padding: '0 4px' }} onClick={saveRule}>
              {editingRuleId ? 'Lưu sửa' : '+ Rule'}
            </button>
            <button className="btn btn-ghost" style={{ flex: 0.8, whiteSpace: 'nowrap', fontSize: 12, padding: '0 4px' }} onClick={resetRuleForm}>
              Mới
            </button>
          </div>
        </div>

        {/* Rule selector */}
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' }}>Rule đang chọn:</span>
          <select className="select" style={{ minWidth: 420 }} value={selectedRuleId} onChange={(e) => setSelectedRuleId(e.target.value)}>
            <option value="">-- Chọn rule --</option>
            {rules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.rule_name} ({r.rule_code}) v{r.version}
              </option>
            ))}
          </select>
        </div>

        {/* Rules table with column headers */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
          {/* Header: Đồng bộ 100% với tỷ lệ của Form nhập Rule phía trên */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.4fr 1fr .8fr .8fr 160px', // Khớp chính xác con số 160px
            gap: 8,
            padding: '10px 12px',
            background: 'var(--bg2, rgba(0,0,0,0.04))',
            borderBottom: '1px solid var(--border)',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>MÃ RULE</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>TÊN QUY TẮC</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>PHẠM VI (SCOPE)</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>ƯU TIÊN</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>VER</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>THAO TÁC</div>
          </div>

          {/* Body */}
          <div style={{ maxHeight: 250, overflowY: 'auto' }}>
            {rules.map((r) => (
              <div
                key={r.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.4fr 1fr .8fr .8fr 160px',
                  gap: 8,
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center',
                  opacity: r.is_active ? 1 : 0.6,
                  background: r.is_active ? 'transparent' : 'var(--bg-dim, rgba(0,0,0,0.02))'
                }}
              >
                {/* Mã Rule */}
                {/* Mã Rule */}
                <div style={{
                  color: 'var(--blue)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  textAlign: 'center',
                  // Thêm 4 dòng dưới đây
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0
                }} title={r.rule_code} /* Hiển thị full text khi di chuột vào */>
                  {r.rule_code}
                </div>

                {/* Tên Rule */}
                <div style={{
                  fontSize: 13,
                  fontWeight: 500,
                  // Thêm 4 dòng dưới đây
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0
                }} title={r.rule_name}>
                  {r.rule_name}
                </div>

                {/* Scope */}
                <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>
                  <span style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4 }}>
                    {r.scope || '-'}
                  </span>
                </div>

                {/* Ưu tiên & Version */}
                <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>{r.priority}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>v{r.version}</div>

                {/* Cụm nút hành động */}
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                  <button
                    className="btn btn-ghost"
                    style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                    onClick={() => setSelectedRuleId(r.id)}
                  >
                    Chọn
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{
                      height: 26,
                      padding: '0 8px',
                      fontSize: 11,
                      color: r.is_active ? 'var(--orange)' : 'var(--blue)'
                    }}
                    onClick={async () => {
                      await fetch(`/api/settings/estimate/rules/${r.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ is_active: !r.is_active }),
                      })
                      await loadAll()
                    }}
                  >
                    {r.is_active ? 'Tắt' : 'Bật'}
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                    onClick={() => removeRule(r.id)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}

            {rules.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text4)', fontSize: 13 }}>
                Chưa có quy tắc nào được tạo.
              </div>
            )}
          </div>
        </div>

        {/* Conditions & Actions side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* 1. CONDITIONS PANEL */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontWeight: 700, fontSize: 12, padding: '8px 12px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', color: 'var(--blue)' }}>
              Conditions (Điều kiện)
            </div>
            <div style={{ padding: 12 }}>
              {/* Form Input Condition */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr .7fr 1fr 1fr 80px', gap: 6, marginBottom: 12 }}>
                <select className="select" value={conditionForm.fact_key} onChange={(e) => setConditionForm((p) => ({ ...p, fact_key: e.target.value }))}>
                  <option value="">-- Fact Key --</option>
                  {ruleFactKeyOptions.map((x) => <option key={x.value} value={x.value}>{x.value}</option>)}
                </select>
                <select className="select" value={conditionForm.operator} onChange={(e) => setConditionForm((p) => ({ ...p, operator: e.target.value }))}>
                  {['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'between'].map((op) => <option key={op} value={op}>{op}</option>)}
                </select>
                <input className="input" placeholder="Text..." value={conditionForm.value_text} onChange={(e) => setConditionForm((p) => ({ ...p, value_text: e.target.value }))} />
                <input className="input" placeholder="Số..." value={conditionForm.value_number} onChange={(e) => setConditionForm((p) => ({ ...p, value_number: e.target.value }))} />

                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={saveCondition}>{editingConditionId ? 'Lưu' : '+'}</button>
                  <button className="btn btn-ghost" style={{ padding: '0 4px' }} onClick={() => setEditingConditionId(null)}>×</button>
                </div>
              </div>

              {/* Table Conditions */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr .6fr 1fr .6fr 85px', gap: 4, padding: '6px 10px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)' }}>FACT KEY</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>OP</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)' }}>VAL (T)</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textAlign: 'center' }}>VAL (N)</div>
                  <div />
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {(selectedRule?.conditions || []).map((c) => (
                    <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr .6fr 1fr .6fr 85px', gap: 4, padding: '6px 10px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                      <div style={{ fontSize: 11, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={c.fact_key}>{c.fact_key}</div>
                      <div style={{ fontSize: 11, color: 'var(--blue)', textAlign: 'center', fontWeight: 600 }}>{c.operator}</div>
                      <div style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{c.value_text || '-'}</div>
                      <div style={{ fontSize: 11, textAlign: 'center' }}>{c.value_number ?? '-'}</div>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost" style={{ height: 22, padding: '0 4px', fontSize: 10 }} onClick={() => {/* edit logic */ }}>Sửa</button>
                        <button className="btn btn-danger" style={{ height: 22, padding: '0 4px', fontSize: 10 }} onClick={() => removeCondition(c.id)}>Xóa</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 2. ACTIONS PANEL */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontWeight: 700, fontSize: 12, padding: '8px 12px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', color: 'var(--orange)' }}>
              Actions (Hành động)
            </div>
            <div style={{ padding: 12 }}>
              {/* Form Action */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 80px', gap: 6, marginBottom: 6 }}>
                <select className="select" value={actionForm.action_type} onChange={(e) => setActionForm((p) => ({ ...p, action_type: e.target.value }))}>
                  {RULE_ACTION_TYPE_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
                <input className="input" placeholder="Target Key" value={actionForm.target_key} onChange={(e) => setActionForm((p) => ({ ...p, target_key: e.target.value }))} />
                <input className="input" placeholder="Công thức" value={actionForm.formula_expr} onChange={(e) => setActionForm((p) => ({ ...p, formula_expr: e.target.value }))} />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={saveAction}>{editingActionId ? 'Lưu' : '+'}</button>
                  <button className="btn btn-ghost" style={{ padding: '0 4px' }} onClick={() => setEditingActionId(null)}>×</button>
                </div>
              </div>

              {/* Table Actions */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 85px', gap: 4, padding: '6px 10px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)' }}>LOẠI</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)' }}>TARGET</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)' }}>GIÁ TRỊ/CT</div>
                  <div />
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {(selectedRule?.actions || []).map((a) => (
                    <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 85px', gap: 4, padding: '6px 10px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--blue)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{a.action_type}</div>
                      <div style={{ fontSize: 11, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{a.target_key || '-'}</div>
                      <div style={{ fontSize: 11, color: 'var(--orange)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                        {a.formula_expr || a.value_text || a.value_number || '-'}
                      </div>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost" style={{ height: 22, padding: '0 4px', fontSize: 10 }} onClick={() => {/* edit logic */ }}>Sửa</button>
                        <button className="btn btn-danger" style={{ height: 22, padding: '0 4px', fontSize: 10 }} onClick={() => removeAction(a.id)}>Xóa</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
          </>
        )}
      </section>
    </div>
  )
}




