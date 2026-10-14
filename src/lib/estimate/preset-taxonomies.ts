export type PresetTaxonomyRow = {
  kind: string
  value: string
  name?: string | null
  description?: string | null
  is_active?: boolean
  sort_order?: number | null
}

export type PresetOption = { value: string; label: string; description?: string }

export type OpeningPresetConfig = {
  summary?: string
  width_ratio?: number
  min_width?: number
  height_ratio?: number
  max_height?: number
  sill_ratio?: number
  min_sill?: number
  color?: string
  opening_count?: number
  opening_area?: number
  opening_type?: 'door' | 'window' | 'vent'
}

export type RoofPresetConfig = {
  summary?: string
  roof_height_ratio?: number
  roof_height_min?: number
  body_height_min?: number
  lean_to_tilt_rad?: number
  thai_radius_ratio?: number
  roof_color?: string
}

export type StairPresetConfig = {
  summary?: string
  step_count?: number
  step_depth_ratio?: number
  step_width_ratio?: number
  min_step_depth?: number
  min_step_width?: number
  turn_ratio?: number
}

export type InteriorPresetConfig = {
  summary?: string
  semantic_facts?: Record<string, number>
}

function toNum(v: unknown): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function parseDescriptionConfig(description?: string | null) {
  const raw = String(description || '').trim()
  if (!raw) return {}
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch {}
  }
  return { summary: raw }
}

export function buildPresetOptions(rows: PresetTaxonomyRow[], kind: string, fallback: PresetOption[]) {
  const options = rows
    .filter((row) => row.kind === kind && row.is_active !== false)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || a.value || '').localeCompare(String(b.name || b.value || '')))
    .map((row) => {
      const cfg = parseDescriptionConfig(row.description)
      return {
        value: String(row.value || ''),
        label: String(row.name || row.value || ''),
        description: typeof cfg.summary === 'string' ? cfg.summary : String(row.description || ''),
      }
    })
    .filter((row) => row.value)
  return options.length ? options : fallback
}

function findPresetRow(rows: PresetTaxonomyRow[], kind: string, value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return null
  return rows.find((row) => row.kind === kind && String(row.value || '').trim().toLowerCase() === normalized && row.is_active !== false) || null
}

export function getOpeningPresetConfig(rows: PresetTaxonomyRow[], value?: string | null): OpeningPresetConfig {
  const row = findPresetRow(rows, 'opening_preset', value)
  const cfg = parseDescriptionConfig(row?.description)
  return {
    summary: typeof cfg.summary === 'string' ? cfg.summary : undefined,
    width_ratio: toNum(cfg.width_ratio),
    min_width: toNum(cfg.min_width),
    height_ratio: toNum(cfg.height_ratio),
    max_height: toNum(cfg.max_height),
    sill_ratio: toNum(cfg.sill_ratio),
    min_sill: toNum(cfg.min_sill),
    color: typeof cfg.color === 'string' ? cfg.color : undefined,
    opening_count: toNum(cfg.opening_count),
    opening_area: toNum(cfg.opening_area),
    opening_type: cfg.opening_type === 'window' || cfg.opening_type === 'vent' ? cfg.opening_type : cfg.opening_type === 'door' ? 'door' : undefined,
  }
}

export function getRoofPresetConfig(rows: PresetTaxonomyRow[], value?: string | null): RoofPresetConfig {
  const row = findPresetRow(rows, 'roof_preset', value)
  const cfg = parseDescriptionConfig(row?.description)
  return {
    summary: typeof cfg.summary === 'string' ? cfg.summary : undefined,
    roof_height_ratio: toNum(cfg.roof_height_ratio),
    roof_height_min: toNum(cfg.roof_height_min),
    body_height_min: toNum(cfg.body_height_min),
    lean_to_tilt_rad: toNum(cfg.lean_to_tilt_rad),
    thai_radius_ratio: toNum(cfg.thai_radius_ratio),
    roof_color: typeof cfg.roof_color === 'string' ? cfg.roof_color : undefined,
  }
}

export function getStairPresetConfig(rows: PresetTaxonomyRow[], value?: string | null): StairPresetConfig {
  const row = findPresetRow(rows, 'stair_preset', value)
  const cfg = parseDescriptionConfig(row?.description)
  return {
    summary: typeof cfg.summary === 'string' ? cfg.summary : undefined,
    step_count: toNum(cfg.step_count),
    step_depth_ratio: toNum(cfg.step_depth_ratio),
    step_width_ratio: toNum(cfg.step_width_ratio),
    min_step_depth: toNum(cfg.min_step_depth),
    min_step_width: toNum(cfg.min_step_width),
    turn_ratio: toNum(cfg.turn_ratio),
  }
}

export function getInteriorPresetConfig(rows: PresetTaxonomyRow[], value?: string | null): InteriorPresetConfig {
  const row = findPresetRow(rows, 'interior_preset', value)
  const cfg = parseDescriptionConfig(row?.description)
  const semanticFacts = cfg.semantic_facts && typeof cfg.semantic_facts === 'object' && !Array.isArray(cfg.semantic_facts)
    ? Object.fromEntries(
        Object.entries(cfg.semantic_facts as Record<string, unknown>)
          .map(([key, val]) => [key, Number(val)])
          .filter(([, val]) => Number.isFinite(val))
      )
    : undefined
  return {
    summary: typeof cfg.summary === 'string' ? cfg.summary : undefined,
    semantic_facts: semanticFacts,
  }
}

