export type AnalysisProfileKey = 'crm_basic' | 'estimate_v1' | 'estimate_preliminary'

export type AnalysisFactItem = {
  key: string
  value: unknown
  confidence?: number | null
}

export type AnalysisOutput = {
  summary?: string | null
  confidence?: number | null
  facts: AnalysisFactItem[]
  missing_fields: string[]
  recommended_questions: string[]
}

export const ESTIMATE_REQUIRED_FIELDS: string[] = [
  'construction_address',
  'house_type',
  'floors',
  'floor_area',
  'finish_level',
]

export const ESTIMATE_PRELIMINARY_REQUIRED_FIELDS: string[] = [
  'region_code',
  'house_type',
  'floors',
  'build_length_m',
  'build_width_m',
  'finish_level',
]

const CRM_BASIC_ALLOWED_MISSING_FIELDS: string[] = [
  'full_name',
  'phone_number',
  'residential_address',
  'construction_address',
  'house_type',
  'floors',
  'floor_area',
  'budget_min',
  'budget_max',
  'potential_score',
  'potential_level',
  'next_action',
]

const ESTIMATE_V1_ALLOWED_MISSING_FIELDS: string[] = [
  'construction_address',
  'province_or_city',
  'district',
  'house_type',
  'floors',
  'floor_area',
  'finish_level',
  'budget_target',
  'construction_timeframe',
  'alley_access',
]

const ESTIMATE_PRELIMINARY_ALLOWED_MISSING_FIELDS: string[] = [
  'construction_address',
  'region_code',
  'house_type',
  'style',
  'foundation_type',
  'finish_level',
  'build_length_m',
  'build_width_m',
  'floor_height_m',
  'stair_void_area',
  'floors',
  'tum_count',
  'basement_count',
  'bedroom_count',
  'wc_count',
  'kitchen_count',
  'living_room_count',
  'base_cost_per_m2',
]

export const ANALYSIS_PROFILE_SEEDS: Array<{
  key: AnalysisProfileKey
  name: string
  description: string
  required_fields: string[]
}> = [
  {
    key: 'crm_basic',
    name: 'CRM Basic',
    description: 'Phan tich CRM mac dinh: thong tin khach, nhu cau, muc do tiem nang.',
    required_fields: [],
  },
  {
    key: 'estimate_v1',
    name: 'Estimate V1',
    description: 'Phan tich thong tin phuc vu khai toan va phat hien du lieu con thieu.',
    required_fields: ESTIMATE_REQUIRED_FIELDS,
  },
  {
    key: 'estimate_preliminary',
    name: 'Estimate Preliminary',
    description: 'Boc tach thong tin dau vao cho du toan so bo (V2), uu tien kich thuoc, ket cau, cong nang.',
    required_fields: ESTIMATE_PRELIMINARY_REQUIRED_FIELDS,
  },
]

const ESTIMATE_QUESTIONS: Record<string, string> = {
  construction_address: 'Anh/chi cho em xin dia chi/khu vuc xay dung cu the (quan/huyen, tinh/thanh)?',
  residential_address: 'Anh/chi cho em xin dia chi cu tru hien tai?',
  region_code: 'Anh/chi cho em xin khu vuc xay dung cu the (quan/huyen, tinh/thanh)?',
  house_type: 'Anh/chi du dinh xay loai nha nao (nha pho, biet thu, nha cap 4, chung cu, khac)?',
  style: 'Anh/chi muon phong cach kien truc nao (mac_dinh, hien_dai, tan_co_dien, co_dien, khac)?',
  floors: 'Cong trinh du kien xay bao nhieu tang?',
  floor_area: 'Tong dien tich san du kien khoang bao nhieu m2?',
  finish_level: 'Muc do hoan thien mong muon la co ban, tieu chuan hay cao cap?',
  budget_target: 'Ngan sach du kien cua anh/chi khoang bao nhieu?',
  construction_timeframe: 'Anh/chi du kien khoi cong vao thoi diem nao?',
  foundation_type: 'Anh/chi du kien dung loai mong nao (mong_coc, mong_bang, mong_be)?',
  build_length_m: 'Chieu dai xay dung du kien la bao nhieu met?',
  build_width_m: 'Chieu rong xay dung du kien la bao nhieu met?',
  tum_count: 'Cong trinh co tum khong? Neu co thi bao nhieu tum?',
  basement_count: 'Cong trinh co tang ham khong? Neu co thi bao nhieu tang ham?',
  bedroom_count: 'Du kien co bao nhieu phong ngu?',
  wc_count: 'Du kien co bao nhieu phong ve sinh?',
  kitchen_count: 'Du kien co bao nhieu bep?',
  living_room_count: 'Du kien co bao nhieu phong khach?',
  floor_height_m: 'Chieu cao tang trung binh du kien la bao nhieu met?',
  stair_void_area: 'Dien tich hoc thang du kien khoang bao nhieu m2?',
}

export function buildRecommendedQuestions(missingFields: string[]): string[] {
  return missingFields
    .map((field) => ESTIMATE_QUESTIONS[field])
    .filter((q): q is string => Boolean(q))
}

export function getRequiredFieldsForProfile(profileKey: AnalysisProfileKey): string[] {
  const seed = ANALYSIS_PROFILE_SEEDS.find((x) => x.key === profileKey)
  return seed?.required_fields ? [...seed.required_fields] : []
}

export function computeMissingFieldsForProfile(
  profileKey: AnalysisProfileKey,
  facts: AnalysisFactItem[],
  providedMissingFields: string[] = []
): string[] {
  const requiredFields = getRequiredFieldsForProfile(profileKey)
  const allowedFields = new Set(getAllowedMissingFieldsForProfile(profileKey))
  const factMap = new Map<string, unknown>()
  for (const fact of facts) factMap.set(fact.key, fact.value)

  const missingRequired = requiredFields.filter((field) => isEmptyValue(factMap.get(field)))
  const providedFiltered = providedMissingFields
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .filter((field) => allowedFields.has(field))
    .filter((field) => !hasUsableValueForField(profileKey, field, factMap))
    .filter((field) => !isDefaultableField(profileKey, field))

  const allMissing = [...providedFiltered, ...missingRequired]
  return Array.from(new Set(allMissing))
}

function getAllowedMissingFieldsForProfile(profileKey: AnalysisProfileKey): string[] {
  if (profileKey === 'crm_basic') return CRM_BASIC_ALLOWED_MISSING_FIELDS
  if (profileKey === 'estimate_v1') return ESTIMATE_V1_ALLOWED_MISSING_FIELDS
  return ESTIMATE_PRELIMINARY_ALLOWED_MISSING_FIELDS
}

export function detectEstimateIntent(text: string): boolean {
  const normalized = text.toLowerCase()
  return [
    'khai toan',
    'bao gia',
    'uoc tinh',
    'chi phi xay',
    'gia xay',
    'du toan',
    'bao nhieu tien',
  ].some((keyword) => normalized.includes(keyword))
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  return false
}

function hasUsableValueForField(
  profileKey: AnalysisProfileKey,
  field: string,
  factMap: Map<string, unknown>
): boolean {
  if (!isEmptyValue(factMap.get(field))) return true

  if (field === 'construction_address' && !isEmptyValue(factMap.get('address'))) {
    return true
  }

  if (field === 'residential_address' && !isEmptyValue(factMap.get('address'))) {
    return true
  }

  if (profileKey === 'estimate_preliminary' && field === 'region_code') {
    const fallbacks = ['construction_address', 'address', 'province_or_city', 'district']
    return fallbacks.some((key) => !isEmptyValue(factMap.get(key)))
  }

  if (profileKey === 'estimate_preliminary' && field === 'construction_address') {
    const regionSignals = ['region_code', 'province_or_city', 'district']
    return regionSignals.some((key) => !isEmptyValue(factMap.get(key)))
  }

  return false
}

function isDefaultableField(profileKey: AnalysisProfileKey, field: string): boolean {
  if (profileKey !== 'estimate_preliminary') return false

  return (
    field === 'foundation_type'
    || field === 'basement_count'
    || field === 'floor_height_m'
    || field === 'stair_void_area'
    || field === 'tum_count'
  )
}
