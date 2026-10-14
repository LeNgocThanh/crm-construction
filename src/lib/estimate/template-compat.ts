export function normalizeKey(v: unknown) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

export const DEFAULT_COMPATIBLE_TYPES: Record<string, string[]> = {
  foundation: ['foundation'],
  wall: ['wall', 'structure'],
  column: ['column', 'structure'],
  slab: ['slab', 'structure', 'house'],
  ceiling: ['ceiling', 'house'],
  roof: ['roof', 'house'],
  tum: ['tum', 'house'],
  stair: ['stair', 'structure'],
  room: ['room'],
  wc: ['wc', 'room'],
  kitchen: ['kitchen', 'room'],
  living_room: ['living_room', 'room'],
  bedroom: ['bedroom', 'room'],
  mep: ['mep'],
  house: ['house'],
  custom: ['custom', 'house', 'room', 'structure', 'mep', 'foundation', 'wall', 'roof', 'slab', 'stair', 'wc'],
}

export function isTemplateTypeCompatibleWithMap(
  componentType: unknown,
  templateType: unknown,
  compatibleMap?: Record<string, string[]>
) {
  const component = normalizeKey(componentType)
  const template = normalizeKey(templateType)
  if (!component || !template) return true
  const allowed = compatibleMap?.[component] || DEFAULT_COMPATIBLE_TYPES[component]
  if (!allowed?.length) {
    return component === template
  }
  return allowed.includes(template)
}

export function isTemplateTypeCompatible(componentType: unknown, templateType: unknown) {
  return isTemplateTypeCompatibleWithMap(componentType, templateType, DEFAULT_COMPATIBLE_TYPES)
}

export function buildCompatibleMapFromTaxonomies(rows: Array<{ kind?: unknown; value?: unknown; is_active?: unknown }>) {
  const out: Record<string, Set<string>> = {}
  for (const row of rows || []) {
    if (normalizeKey(row?.kind) !== 'assembly_component_template_map') continue
    if (row?.is_active === false) continue
    const raw = String(row?.value || '').trim()
    if (!raw) continue
    const parts = raw.split(/[\|:=>]/).map((x) => normalizeKey(x)).filter(Boolean)
    if (parts.length < 2) continue
    const component = parts[0]
    const template = parts[1]
    if (!out[component]) out[component] = new Set<string>()
    out[component].add(template)
  }
  const map: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(out)) map[k] = Array.from(v)
  return map
}
