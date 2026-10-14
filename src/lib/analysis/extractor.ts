import { db } from '@/lib/db'
import { runAnalysisByProfile } from './engine'
import {
  AnalysisFactItem,
  AnalysisOutput,
  AnalysisProfileKey,
  buildRecommendedQuestions,
  computeMissingFieldsForProfile,
  detectEstimateIntent,
} from './profiles'
import { ensureAnalysisProfiles, saveAnalysisRun } from './store'

export type ExtractionMode = 'full' | 'incremental'

export type RunExtractionInput = {
  profiles?: AnalysisProfileKey[]
  auto_detect?: boolean
  text?: string
  source_type?: string
  customer_id?: string | null
  conversation_id?: string | null
  contact_log_id?: string | null
  mode?: ExtractionMode
  save_runs?: boolean
  requested_by?: string | null
}

export type ExtractionProfileResult = {
  profile_key: AnalysisProfileKey
  run_id: string | null
  status: 'completed' | 'needs_data'
  summary: string | null
  confidence: number | null
  facts: AnalysisFactItem[]
  extracted: Record<string, unknown>
  missing_fields: string[]
  recommended_questions: string[]
}

export type RunExtractionOutput = {
  mode: ExtractionMode
  source_type: string
  input_text: string
  customer_id: string | null
  conversation_id: string | null
  contact_log_id: string | null
  profiles: AnalysisProfileKey[]
  results: ExtractionProfileResult[]
  estimate_prefill: Record<string, unknown>
}

export async function runExtractionProfiles(input: RunExtractionInput): Promise<RunExtractionOutput> {
  await ensureAnalysisProfiles()

  const context = await resolveInputContext({
    text: input.text,
    source_type: input.source_type,
    customer_id: input.customer_id,
    conversation_id: input.conversation_id,
    contact_log_id: input.contact_log_id,
  })

  if (!context.inputText.trim()) {
    throw new Error('Chua co noi dung de boc tach')
  }

  const mode: ExtractionMode = input.mode === 'incremental' ? 'incremental' : 'full'
  const profiles = pickProfiles({
    selected: input.profiles,
    autoDetect: input.auto_detect !== false,
    inputText: context.inputText,
  })

  const saveRuns = input.save_runs !== false
  const results: ExtractionProfileResult[] = []
  const needsEstimateTaxonomy = profiles.includes('estimate_preliminary')
  const estimateTaxonomyMap = needsEstimateTaxonomy
    ? await loadEstimateTaxonomyMap()
    : { house_type: [], style: [] }
  const contextFacts = await loadContextFacts(context.customerId)

  for (const profileKey of profiles) {
    const current = await runAnalysisByProfile(profileKey, context.inputText)
    const rawOutput = mode === 'incremental'
      ? await mergeWithLatestFacts(profileKey, current, context)
      : current
    const withContextFacts = applyContextFacts(profileKey, rawOutput, contextFacts)
    const output = normalizeFactsByProfile(profileKey, withContextFacts, estimateTaxonomyMap)

    let runId: string | null = null
    if (saveRuns) {
      const run = await saveAnalysisRun({
        profileKey,
        sourceType: context.sourceType,
        inputText: context.inputText,
        output,
        requestedBy: input.requested_by || null,
        customerId: context.customerId,
        conversationId: context.conversationId,
        contactLogId: context.contactLogId,
      })
      runId = run.id
    }

    results.push({
      profile_key: profileKey,
      run_id: runId,
      status: output.missing_fields.length ? 'needs_data' : 'completed',
      summary: output.summary || null,
      confidence: output.confidence ?? null,
      facts: output.facts,
      extracted: factsToObject(output.facts, output.summary || null),
      missing_fields: output.missing_fields,
      recommended_questions: output.recommended_questions,
    })
  }

  return {
    mode,
    source_type: context.sourceType,
    input_text: context.inputText,
    customer_id: context.customerId,
    conversation_id: context.conversationId,
    contact_log_id: context.contactLogId,
    profiles,
    results,
    estimate_prefill: buildEstimatePrefill(results),
  }
}

type EstimateTaxonomyMap = {
  house_type: Array<{ value: string; aliases: Set<string> }>
  style: Array<{ value: string; aliases: Set<string> }>
}

async function loadEstimateTaxonomyMap(): Promise<EstimateTaxonomyMap> {
  const rows = await db.estimationTaxonomy.findMany({
    where: { kind: { in: ['house_type', 'style'] } },
    select: { kind: true, value: true, name: true },
    orderBy: [{ kind: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }],
  })

  const out: EstimateTaxonomyMap = { house_type: [], style: [] }
  for (const row of rows) {
    const kind = row.kind === 'house_type' || row.kind === 'style' ? row.kind : null
    if (!kind) continue
    const value = String(row.value || '').trim()
    if (!value) continue
    const name = String(row.name || '').trim()
    const aliases = new Set<string>([normalizeToken(value)])
    if (name) aliases.add(normalizeToken(name))
    out[kind].push({ value, aliases })
  }
  return out
}

function normalizeFactsByProfile(
  profileKey: AnalysisProfileKey,
  output: AnalysisOutput,
  taxonomy: EstimateTaxonomyMap
): AnalysisOutput {
  if (profileKey !== 'estimate_preliminary') return output

  const facts = output.facts.map((fact) => {
    if (fact.key !== 'house_type' && fact.key !== 'style') return fact
    const normalized = normalizeTaxonomyValue(fact.value, taxonomy[fact.key])
    return { ...fact, value: normalized }
  })

  const missing = computeMissingFieldsForProfile(profileKey, facts, output.missing_fields)
  return {
    ...output,
    facts,
    missing_fields: missing,
    recommended_questions: buildRecommendedQuestions(missing),
  }
}

function normalizeTaxonomyValue(
  raw: unknown,
  candidates: Array<{ value: string; aliases: Set<string> }>
): string | null {
  if (raw === null || raw === undefined) return null
  const text = String(raw).trim()
  if (!text) return null

  const token = normalizeToken(text)
  for (const row of candidates) {
    if (row.aliases.has(token)) return row.value
  }

  return 'khac'
}

function normalizeToken(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export async function resolveInputContext(params: {
  text?: string
  source_type?: string
  customer_id?: string | null
  conversation_id?: string | null
  contact_log_id?: string | null
}) {
  let inputText = (params.text || '').trim()
  let sourceType = params.source_type || 'text'
  let customerId = params.customer_id || null
  let conversationId = params.conversation_id || null
  let contactLogId = params.contact_log_id || null

  if (!inputText && conversationId) {
    const conv = await db.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { created_at: 'desc' }, take: 260 } },
    })
    if (conv) {
      inputText = [...conv.messages]
        .reverse()
        .filter((m) => m.content && m.content.trim())
        .map((m) => {
          const who = m.sender_type === 'customer' ? 'Khach' : m.sender_type === 'bot' ? 'Bot' : 'Sales'
          return `${who}: ${m.content}`
        })
        .join('\n')
      sourceType = 'chat'
      customerId = customerId || conv.customer_id || null
    }
  }

  if (!inputText && contactLogId) {
    const log = await db.contactLog.findUnique({ where: { id: contactLogId } })
    if (log) {
      inputText = [log.transcription_raw, log.notes].filter(Boolean).join('\n').trim()
      sourceType = log.source || 'text'
      customerId = customerId || log.customer_id || null
    }
  }

  return {
    inputText,
    sourceType,
    customerId,
    conversationId,
    contactLogId,
  }
}

function pickProfiles(params: {
  selected?: AnalysisProfileKey[]
  autoDetect: boolean
  inputText: string
}): AnalysisProfileKey[] {
  if (Array.isArray(params.selected) && params.selected.length) {
    const valid = params.selected.filter((x) => x === 'crm_basic' || x === 'estimate_v1' || x === 'estimate_preliminary')
    if (valid.length) return Array.from(new Set(valid))
  }

  if (params.autoDetect && detectEstimateIntent(params.inputText)) {
    return ['crm_basic', 'estimate_preliminary']
  }

  return ['crm_basic']
}

async function mergeWithLatestFacts(
  profileKey: AnalysisProfileKey,
  current: AnalysisOutput,
  context: { customerId: string | null; conversationId: string | null; contactLogId: string | null }
): Promise<AnalysisOutput> {
  const latest = await getLatestRunForContext(profileKey, context)
  const previousFacts = normalizeExistingFacts((latest?.facts || []) as any[])

  if (!previousFacts.length) return current

  const mergedFacts = mergeFacts(previousFacts, current.facts)
  const mergedMissing = computeMissingFieldsForProfile(profileKey, mergedFacts, current.missing_fields)
  const mergedQuestions = (profileKey === 'estimate_v1' || profileKey === 'estimate_preliminary')
    ? buildRecommendedQuestions(mergedMissing)
    : current.recommended_questions

  return {
    ...current,
    facts: mergedFacts,
    missing_fields: mergedMissing,
    recommended_questions: mergedQuestions,
  }
}

async function getLatestRunForContext(
  profileKey: AnalysisProfileKey,
  context: { customerId: string | null; conversationId: string | null; contactLogId: string | null }
) {
  const where: any = { profile_key: profileKey }
  if (context.contactLogId) where.contact_log_id = context.contactLogId
  else if (context.conversationId) where.conversation_id = context.conversationId
  else if (context.customerId) where.customer_id = context.customerId

  if (!where.contact_log_id && !where.conversation_id && !where.customer_id) {
    return null
  }

  return db.analysisRun.findFirst({
    where,
    orderBy: { created_at: 'desc' },
    include: { facts: true },
  })
}

function normalizeExistingFacts(rows: Array<{ fact_key: string; fact_value: unknown; confidence: number | null }>): AnalysisFactItem[] {
  const out: AnalysisFactItem[] = []
  for (const row of rows) {
    const key = String(row.fact_key || '').trim()
    if (!key) continue
    out.push({
      key,
      value: row.fact_value ?? null,
      confidence: typeof row.confidence === 'number' ? row.confidence : null,
    })
  }
  return out
}

function mergeFacts(previousFacts: AnalysisFactItem[], currentFacts: AnalysisFactItem[]): AnalysisFactItem[] {
  const map = new Map<string, AnalysisFactItem>()

  for (const fact of previousFacts) {
    map.set(fact.key, { ...fact })
  }

  for (const fact of currentFacts) {
    const key = fact.key
    if (!key) continue

    if (!map.has(key)) {
      map.set(key, { ...fact })
      continue
    }

    if (hasValue(fact.value)) {
      map.set(key, { ...fact })
      continue
    }

    const prev = map.get(key)
    if (prev && !hasValue(prev.value)) {
      map.set(key, { ...fact })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key))
}

function hasValue(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim().length > 0
  return true
}

type ContextFacts = {
  facts: AnalysisFactItem[]
}

async function loadContextFacts(customerId: string | null): Promise<ContextFacts> {
  if (!customerId) return { facts: [] }

  const [customer, snapshot] = await Promise.all([
    db.customer.findUnique({
      where: { id: customerId },
      select: {
        full_name: true,
        phone_number: true,
        address: true,
        house_type: true,
        floors: true,
        floor_area: true,
        budget_min: true,
        budget_max: true,
        potential_score: true,
        potential_level: true,
        next_action: true,
      },
    }),
    (db as any).projectRequirementSnapshot.findFirst({
      where: { customer_id: customerId, is_current: true },
      orderBy: [{ version_no: 'desc' }],
      select: { normalized_json: true },
    }),
  ])

  const facts: AnalysisFactItem[] = []
  const push = (key: string, value: unknown) => {
    if (value === null || value === undefined) return
    if (typeof value === 'string' && !value.trim()) return
    facts.push({ key, value, confidence: 1 })
  }

  if (customer) {
    push('full_name', customer.full_name)
    push('phone_number', customer.phone_number)
    push('residential_address', customer.address)
    push('house_type', customer.house_type)
    push('floors', customer.floors)
    push('floor_area', customer.floor_area)
    push('budget_min', customer.budget_min ? Number(customer.budget_min) : null)
    push('budget_max', customer.budget_max ? Number(customer.budget_max) : null)
    push('potential_score', customer.potential_score)
    push('potential_level', customer.potential_level)
    push('next_action', customer.next_action)
  }

  const normalized = snapshot?.normalized_json && typeof snapshot.normalized_json === 'object'
    ? snapshot.normalized_json as Record<string, unknown>
    : {}

  push('construction_address', normalized.construction_address ?? normalized.address ?? null)
  push('region_code', normalized.region_code ?? null)
  push('province_or_city', normalized.province_or_city ?? null)
  push('district', normalized.district ?? null)
  push('house_type', normalized.house_type ?? null)
  push('style', normalized.style ?? null)
  push('floors', normalized.floors ?? null)
  push('floor_area', normalized.floor_area ?? null)
  push('finish_level', normalized.finish_level ?? null)
  push('build_length_m', normalized.build_length_m ?? null)
  push('build_width_m', normalized.build_width_m ?? null)
  push('floor_height_m', normalized.floor_height_m ?? null)
  push('stair_void_area', normalized.stair_void_area ?? null)
  push('tum_count', normalized.tum_count ?? null)
  push('basement_count', normalized.basement_count ?? null)
  push('bedroom_count', normalized.bedroom_count ?? null)
  push('wc_count', normalized.wc_count ?? null)
  push('kitchen_count', normalized.kitchen_count ?? null)
  push('living_room_count', normalized.living_room_count ?? null)
  push('base_cost_per_m2', normalized.base_cost_per_m2 ?? null)
  push('budget_target', normalized.budget_target ?? normalized.estimated_budget ?? normalized.budget_min ?? null)

  return { facts }
}

function applyContextFacts(
  profileKey: AnalysisProfileKey,
  output: AnalysisOutput,
  context: ContextFacts
): AnalysisOutput {
  if (!context.facts.length) return output

  const profileScopedFacts = context.facts.filter((fact) => {
    if (profileKey === 'crm_basic') {
      return fact.key !== 'region_code' && fact.key !== 'build_length_m' && fact.key !== 'build_width_m'
    }
    return fact.key !== 'residential_address'
  })

  if (!profileScopedFacts.length) return output

  const mergedFacts = mergeFacts(profileScopedFacts, output.facts)
  const mergedMissing = computeMissingFieldsForProfile(profileKey, mergedFacts, output.missing_fields)
  const mergedQuestions = (profileKey === 'estimate_v1' || profileKey === 'estimate_preliminary')
    ? buildRecommendedQuestions(mergedMissing)
    : output.recommended_questions

  return {
    ...output,
    facts: mergedFacts,
    missing_fields: mergedMissing,
    recommended_questions: mergedQuestions,
  }
}

export function factsToObject(
  facts: Array<{ key: string; value: unknown; confidence?: number | null }>,
  summary: string | null
): Record<string, unknown> {
  const extracted: Record<string, unknown> = summary ? { summary } : {}
  for (const fact of facts) extracted[fact.key] = fact.value
  return extracted
}

function buildEstimatePrefill(results: ExtractionProfileResult[]) {
  const source = results.find((x) => x.profile_key === 'estimate_preliminary')
    || results.find((x) => x.profile_key === 'estimate_v1')

  if (!source) return {}

  const obj = source.extracted || {}

  return {
    construction_address: toStringOrNull(obj.construction_address ?? obj.address),
    region_code: toStringOrNull(obj.region_code),
    house_type: toStringOrNull(obj.house_type),
    style: toStringOrNull(obj.style),
    foundation_type: toStringOrNull(obj.foundation_type) || 'mong_bang',
    finish_level: toStringOrNull(obj.finish_level),
    build_length_m: toNumberOrNull(obj.build_length_m),
    build_width_m: toNumberOrNull(obj.build_width_m),
    floor_height_m: toNumberOrNull(obj.floor_height_m) ?? 3,
    stair_void_area: toNumberOrNull(obj.stair_void_area) ?? 0,
    floors: toIntOrNull(obj.floors),
    tum_count: toIntOrNull(obj.tum_count) ?? 0,
    basement_count: toIntOrNull(obj.basement_count) ?? 0,
    bedroom_count: toIntOrNull(obj.bedroom_count),
    wc_count: toIntOrNull(obj.wc_count),
    kitchen_count: toIntOrNull(obj.kitchen_count),
    living_room_count: toIntOrNull(obj.living_room_count),
    base_cost_per_m2: toNumberOrNull(obj.base_cost_per_m2),
    floor_area_total: toNumberOrNull(obj.floor_area),
  }
}

function toStringOrNull(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return s ? s : null
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function toIntOrNull(v: unknown): number | null {
  const n = toNumberOrNull(v)
  if (n == null) return null
  return Math.trunc(n)
}
