import { GoogleGenerativeAI } from '@google/generative-ai'
import { AI_PROVIDER } from '@/lib/ai'
import {
  AnalysisOutput,
  AnalysisProfileKey,
  buildRecommendedQuestions,
  computeMissingFieldsForProfile,
  getRequiredFieldsForProfile,
} from './profiles'

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:12b'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash'

export async function runAnalysisByProfile(
  profileKey: AnalysisProfileKey,
  inputText: string
): Promise<AnalysisOutput> {
  const prompt = buildPrompt(profileKey, inputText)
  const raw = await callLLM(prompt)
  const parsed = safeParseModelOutput(raw, profileKey)

  const initialMissing = Array.isArray(parsed.missing_fields)
    ? parsed.missing_fields.map((x: unknown) => String(x))
    : []

  const output: AnalysisOutput = {
    summary: typeof parsed.summary === 'string' ? parsed.summary : null,
    confidence: toNullableNumber(parsed.confidence),
    facts: normalizeFacts(parsed.facts, profileKey, inputText),
    missing_fields: [],
    recommended_questions: [],
  }
  output.summary = sanitizeSummary(profileKey, output.summary ?? null, output.facts)

  const allMissing = computeMissingFieldsForProfile(profileKey, output.facts, initialMissing)
  output.missing_fields = allMissing

  if (profileKey === 'estimate_v1' || profileKey === 'estimate_preliminary') {
    output.recommended_questions = buildRecommendedQuestions(allMissing)
  }

  return output
}

function buildPrompt(profileKey: AnalysisProfileKey, text: string): string {
  const shared = `Ban la AI phan tich CRM nganh xay dung.
Luon tra ve JSON THUAN, khong markdown, khong van ban ngoai JSON.
JSON bat buoc co cau truc:
{
  "summary": "tom tat ngan",
  "confidence": so_tu_0_den_1,
  "facts": [
    { "key": "fact_name", "value": "...|number|boolean|null", "confidence": so_0_den_1 }
  ],
  "missing_fields": ["field_a","field_b"]
}`

  if (profileKey === 'estimate_preliminary') {
    const required = getRequiredFieldsForProfile('estimate_preliminary')
    return `${shared}

Nhiem vu: boc tach du lieu dau vao cho DU TOAN SO BO (Estimate V2), khong suy dien khi thieu.
Cac facts uu tien:
- construction_address
- region_code
- house_type (nha_pho|biet_thu|nha_cap_4|chung_cu|khac)
- style (mac_dinh|hien_dai|tan_co_dien|co_dien|khac)
- foundation_type (mong_coc|mong_bang|mong_be|khac)
- finish_level (co_ban|tieu_chuan|cao_cap)
- build_length_m (met)
- build_width_m (met)
- floor_height_m (met)
- stair_void_area (m2)
- floors
- tum_count
- basement_count
- bedroom_count
- wc_count
- kitchen_count
- living_room_count
- base_cost_per_m2

Truong bat buoc cho du toan so bo:
${required.join(', ')}

Mac dinh he thong neu khach chua noi:
- foundation_type = mong_bang
- tum_count = 0
- basement_count = 0
- floor_height_m = 3
- stair_void_area = 0

Chi dua vao "missing_fields" cac truong THAT SU CAN HOI THEM (khong co fact, khong co mac dinh).
Khong tu bia so lieu neu doan hoi thoai khong co.

NOI DUNG:
${text}`
  }

  if (profileKey === 'estimate_v1') {
    const required = getRequiredFieldsForProfile('estimate_v1')
    return `${shared}

Nhiem vu: boc tach du lieu phuc vu KHAI TOAN nhanh, khong suy dien neu thieu.
Cac facts uu tien:
- construction_address
- province_or_city
- district
- house_type (nha_pho|biet_thu|nha_cap_4|chung_cu|khac)
- floors
- floor_area
- finish_level (co_ban|tieu_chuan|cao_cap)
- budget_target
- construction_timeframe
- alley_access

Truong bat buoc cho khai toan:
${required.join(', ')}

Neu thieu du lieu bat buoc, phai dien vao "missing_fields".
Khong tu bia so lieu neu hoi thoai khong co.

NOI DUNG:
${text}`
  }

  return `${shared}

Nhiem vu: phan tich CRM co ban.
Summary phai la tom tat thong tin KH/phu hop CRM, toi da 2 cau.
KHONG duoc viet kieu nhan xet chat, danh gia chat, dong vai giam khao, "ban da lam rat tot", "diem manh", "de xuat cai thien".
Cau truc nen uu tien:
- Cau 1: khach la ai + nhu cau chinh + boi canh xay dung (neu co)
- Cau 2: ngan sach/tien do/muc do tiem nang + next_action (neu co)

Cac facts goi y:
- full_name
- phone_number
- residential_address
- construction_address
- house_type
- floors
- floor_area
- budget_min
- budget_max
- potential_score (1-10)
- potential_level (cao|trung|thap)
- next_action

Quy tac dia chi:
- Neu khach noi dia chi o hien tai (vi du: "toi o...", "nha toi o...") => residential_address
- Neu khach noi dia chi noi xay dung / co dat can xay (vi du: "toi co manh dat...", "can xay o...") => construction_address
- Neu khong chac chan, co the tra ve key "address" de he thong tu phan loai.

NOI DUNG:
${text}`
}

async function callLLM(prompt: string): Promise<string> {
  if (AI_PROVIDER === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY chua duoc cau hinh')

    const client = new GoogleGenerativeAI(apiKey)
    const model = client.getGenerativeModel({ model: GEMINI_MODEL })
    const result = await model.generateContent(prompt)
    return result.response.text() || ''
  }

  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.1, num_predict: 900 },
    }),
    signal: AbortSignal.timeout(45000),
  })

  if (!res.ok) throw new Error(`Ollama ${res.status}`)
  const data = await res.json()
  return String(data.response || '')
}

function safeParseModelOutput(rawInput: string, profileKey: AnalysisProfileKey): Record<string, unknown> {
  const cleaned = stripMarkdownFences(rawInput).trim()

  const candidates = buildParseCandidates(cleaned)
  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  }

  return {
    summary: summarizeFallbackText(cleaned),
    confidence: 0.2,
    facts: [],
    missing_fields: [...getRequiredFieldsForProfile(profileKey)],
  }
}

function stripMarkdownFences(input: string): string {
  return input
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
}

function buildParseCandidates(raw: string): string[] {
  const out: string[] = []
  if (raw) out.push(raw)

  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    out.push(raw.slice(firstBrace, lastBrace + 1))
  }

  const normalized = normalizeJsonLike(raw)
  if (normalized !== raw) out.push(normalized)

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const slicedNormalized = normalizeJsonLike(raw.slice(firstBrace, lastBrace + 1))
    out.push(slicedNormalized)
  }

  return uniqueStrings(out)
}

function normalizeJsonLike(input: string): string {
  return input
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\t/g, ' ')
    .replace(/,\s*([}\]])/g, '$1')
    .trim()
}

function tryParseJson(input: string): unknown | null {
  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}

function summarizeFallbackText(raw: string): string {
  const s = raw.replace(/\s+/g, ' ').trim()
  if (!s) return 'AI chua tra ve JSON hop le.'
  return s.length > 220 ? `${s.slice(0, 220)}...` : s
}

function sanitizeSummary(
  profileKey: AnalysisProfileKey,
  summary: string | null,
  facts: Array<{ key: string; value: unknown; confidence?: number | null }>
): string | null {
  const cleaned = String(summary || '').trim()
  if (profileKey !== 'crm_basic') return cleaned || null

  if (!cleaned) return buildCrmSummaryFromFacts(facts) || null

  const lower = cleaned.toLowerCase()
  const looksLikeMetaReview =
    lower.includes('ban da lam rat tot') ||
    lower.includes('điểm mạnh') ||
    lower.includes('diem manh') ||
    lower.includes('đề xuất cải thiện') ||
    lower.includes('de xuat cai thien') ||
    lower.includes('duy tri su nhat quan cua nhan vat') ||
    lower.includes('cuoc tro chuyen rat tot') ||
    lower.includes('nhan xet') ||
    lower.includes('gop y')

  if (!looksLikeMetaReview) return cleaned

  return buildCrmSummaryFromFacts(facts) || cleaned
}

function buildCrmSummaryFromFacts(
  facts: Array<{ key: string; value: unknown; confidence?: number | null }>
): string {
  const get = (key: string): string => {
    const row = facts.find((x) => x.key === key)
    if (!row || row.value === null || row.value === undefined) return ''
    const s = String(row.value).trim()
    return s
  }

  const fullName = get('full_name')
  const phone = get('phone_number')
  const houseType = get('house_type')
  const floors = get('floors')
  const floorArea = get('floor_area')
  const residential = get('residential_address')
  const construction = get('construction_address')
  const budgetMin = get('budget_min')
  const budgetMax = get('budget_max')
  const potential = get('potential_level')
  const nextAction = get('next_action')

  const who = fullName || phone || 'Khach hang'
  const scopeParts = [houseType, floors ? `${floors} tang` : '', floorArea ? `${floorArea} m2` : ''].filter(Boolean)
  const place = construction || residential
  const scope = [scopeParts.join(', '), place].filter(Boolean).join(' - ')

  const budget = budgetMin || budgetMax
    ? `Ngan sach: ${budgetMin || '?'} - ${budgetMax || '?'}`
    : ''
  const pot = potential ? `Tiem nang: ${potential}` : ''
  const action = nextAction ? `Next action: ${nextAction}` : ''

  const line1 = scope ? `${who}: nhu cau xay dung ${scope}.` : `${who}: da phat sinh nhu cau xay dung.`
  const line2Parts = [budget, pot, action].filter(Boolean)
  const line2 = line2Parts.length ? line2Parts.join('. ') + '.' : ''
  return [line1, line2].filter(Boolean).join(' ')
}

function normalizeFacts(
  value: unknown,
  profileKey: AnalysisProfileKey,
  inputText: string
): Array<{ key: string; value: unknown; confidence?: number | null }> {
  if (!Array.isArray(value)) return []

  const out: Array<{ key: string; value: unknown; confidence?: number | null }> = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const rawKey = String((item as Record<string, unknown>).key || '').trim()
    const factValue = (item as Record<string, unknown>).value ?? null
    const key = canonicalizeFactKey(profileKey, rawKey, factValue, inputText)
    if (!key) continue
    out.push({
      key,
      value: factValue,
      confidence: toNullableNumber((item as Record<string, unknown>).confidence),
    })
  }
  return out
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function canonicalizeFactKey(
  profileKey: AnalysisProfileKey,
  key: string,
  value: unknown,
  inputText: string
): string {
  if (!key) return key

  if (key === 'residential_address' || key === 'construction_address') return key

  if (key === 'address' || key === 'dia_chi') {
    const inferred = inferAddressTypeFromContext(inputText, value)
    if (inferred) return inferred
    if (profileKey === 'crm_basic') return 'residential_address'
    return 'construction_address'
  }

  return key
}

function inferAddressTypeFromContext(inputText: string, value: unknown): 'residential_address' | 'construction_address' | null {
  const text = `${String(inputText || '')} ${String(value ?? '')}`.toLowerCase()

  const constructionSignals = [
    'manh dat',
    'miếng đất',
    'lô đất',
    'lo dat',
    'khu dat',
    'đất',
    'can xay',
    'cần xây',
    'xay nha',
    'xây nhà',
    'xay dung',
    'xây dựng',
    'thi cong',
    'thi công',
    'cong trinh',
    'công trình',
    'du an',
    'dự án',
    'xay o',
    'xây ở',
  ]

  const residentialSignals = [
    'toi o',
    'tôi ở',
    'nha toi o',
    'nhà tôi ở',
    'dia chi nha',
    'địa chỉ nhà',
    'ho khau',
    'hộ khẩu',
    'tam tru',
    'tạm trú',
    'thuong tru',
    'thường trú',
    'cho o hien tai',
    'chỗ ở hiện tại',
  ]

  if (constructionSignals.some((s) => text.includes(s))) return 'construction_address'
  if (residentialSignals.some((s) => text.includes(s))) return 'residential_address'
  return null
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((x) => x.trim()).filter(Boolean)))
}
