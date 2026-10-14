import { sanitizeAssemblyBlockDimensions } from '@/lib/estimate/block-semantics'
import { normalizeKey } from '@/lib/estimate/template-compat'
import {
  getInteriorPresetConfig,
  getOpeningPresetConfig,
  type PresetTaxonomyRow,
} from '@/lib/estimate/preset-taxonomies'

function num(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function text(v: unknown) {
  return String(v || '').trim()
}

function factKey(v: unknown) {
  return text(v).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function pickNum(obj: any, keys: string[]): number | null {
  for (const k of keys) {
    const n = num(obj?.[k])
    if (n != null) return n
  }
  return null
}

function calcAreaByDims(dims: any) {
  const area = pickNum(dims, ['area_m2', 'area', 'floor_area', 'footprint_area'])
  if (area != null && area > 0) return area
  const l = pickNum(dims, ['length_m', 'length', 'build_length_m'])
  const w = pickNum(dims, ['width_m', 'width', 'build_width_m'])
  if (l != null && w != null && l > 0 && w > 0) return l * w
  return 0
}

function getSanitizedDims(block: any) {
  return sanitizeAssemblyBlockDimensions(
    text(block?.component_type),
    block?.dimensions_json && typeof block.dimensions_json === 'object' ? block.dimensions_json : {}
  )
}

function calcWallMetricsByBlock(blocks: any[]) {
  let wallSurfaceAreaTotal = 0
  let wallLengthTotal = 0

  for (const b of blocks || []) {
    const comp = text(b?.component_type).toLowerCase()
    if (comp !== 'wall') continue
    const dims = getSanitizedDims(b)

    const explicitArea = pickNum(dims, ['wall_area_m2'])
    const explicitLength = pickNum(dims, ['wall_length_m'])
    const height = pickNum(dims, ['height_m', 'floor_height_m', 'height']) || 0
    const length = pickNum(dims, ['length_m', 'length', 'build_length_m']) || 0
    const width = pickNum(dims, ['width_m', 'width', 'build_width_m']) || 0

    let blockWallArea = 0
    let blockWallLength = 0

    if (explicitArea != null && explicitArea > 0) {
      blockWallArea = explicitArea
      if (explicitLength != null && explicitLength > 0) {
        blockWallLength = explicitLength
      } else if (height > 0) {
        blockWallLength = explicitArea / height
      }
    } else {
      if (explicitLength != null && explicitLength > 0) {
        blockWallLength = explicitLength
      } else if (length > 0 && width > 0) {
        blockWallLength = 2 * (length + width)
      }
      if (blockWallLength > 0 && height > 0) {
        blockWallArea = blockWallLength * height
      }
    }

    if (blockWallArea > 0) wallSurfaceAreaTotal += blockWallArea
    if (blockWallLength > 0) wallLengthTotal += blockWallLength
  }

  return {
    wall_surface_area_total: wallSurfaceAreaTotal > 0 ? Number(wallSurfaceAreaTotal.toFixed(2)) : null,
    wall_length_total: wallLengthTotal > 0 ? Number(wallLengthTotal.toFixed(2)) : null,
  }
}

type OpeningPreview = {
  type: 'door' | 'window' | 'vent'
  face: 'front' | 'back' | 'left' | 'right'
  offset: number
  width: number
  height: number
  sill: number
}

function normalizeOpeningPreview(value: any, length: number, height: number, width: number): OpeningPreview | null {
  const typeRaw = text(value?.type).toLowerCase()
  const faceRaw = text(value?.face).toLowerCase()
  const type: OpeningPreview['type'] = typeRaw === 'window' || typeRaw === 'vent' ? typeRaw : 'door'
  const face: OpeningPreview['face'] = faceRaw === 'back' || faceRaw === 'left' || faceRaw === 'right' ? faceRaw : 'front'
  const faceSpan = face === 'left' || face === 'right' ? width : length
  const maxWidth = Math.max(0.4, faceSpan - 0.3)
  const safeWidth = Math.max(0.3, Math.min(maxWidth, Number(value?.width) || (type === 'door' ? 1.2 : type === 'window' ? 1.6 : 0.8)))
  const safeHeight = Math.max(0.25, Math.min(height - 0.15, Number(value?.height) || (type === 'door' ? 2.1 : type === 'window' ? 1.2 : 0.45)))
  const safeSill = Math.max(0, Math.min(height - safeHeight - 0.05, Number(value?.sill) || (type === 'door' ? 0 : 0.9)))
  const maxOffset = Math.max(0, (faceSpan - safeWidth) / 2)
  const safeOffset = Math.max(-maxOffset, Math.min(maxOffset, Number(value?.offset) || 0))
  return {
    type,
    face,
    offset: Number(safeOffset.toFixed(2)),
    width: Number(safeWidth.toFixed(2)),
    height: Number(safeHeight.toFixed(2)),
    sill: Number(safeSill.toFixed(2)),
  }
}

function getOpeningEntries(dims: any) {
  const length = pickNum(dims, ['length_m', 'length', 'build_length_m']) || 0
  const width = pickNum(dims, ['width_m', 'width', 'build_width_m']) || 0
  const height = pickNum(dims, ['height_m', 'floor_height_m', 'height']) || 0
  if (!Array.isArray(dims?.openings)) return [] as OpeningPreview[]
  return dims.openings
    .map((opening: any) => normalizeOpeningPreview(opening, length, height, width))
    .filter(Boolean) as OpeningPreview[]
}

function parseRuleConfig(description?: string | null) {
  const raw = String(description || '').trim()
  if (!raw) return null
  if (!raw.startsWith('{')) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {}
  return null
}

type BundleRule = {
  value: string
  name: string
  template_codes: string[]
  criteria: Record<string, string>
}

function parseBundleRules(rows: PresetTaxonomyRow[]) {
  return rows
    .filter((row) => row.kind === 'assembly_template_bundle_map' && row.is_active !== false)
    .map((row) => {
      const cfg = parseRuleConfig(row.description)
      if (!cfg) return null
      const codes = Array.isArray(cfg.template_codes)
        ? cfg.template_codes.map((x) => text(x)).filter(Boolean)
        : text(cfg.template_code)
          ? [text(cfg.template_code)]
          : []
      if (!codes.length) return null
      const criteria: Record<string, string> = {}
      for (const key of ['component_type', 'space_type', 'space_profile', 'foundation_type', 'opening_preset', 'roof_preset', 'stair_preset', 'interior_preset', 'facade_role']) {
        const normalized = normalizeKey(cfg[key])
        if (normalized) criteria[key] = normalized
      }
      return {
        value: text(row.value),
        name: text(row.name || row.value),
        template_codes: codes,
        criteria,
      } satisfies BundleRule
    })
    .filter(Boolean) as BundleRule[]
}

function matchBundleRules(blockRow: Record<string, any>, rules: BundleRule[]) {
  const hits: Array<{ value: string; name: string; template_codes: string[]; score: number; criteria: Record<string, string> }> = []
  for (const rule of rules) {
    const entries = Object.entries(rule.criteria)
    if (!entries.length) continue
    let matched = true
    let score = 0
    for (const [key, expected] of entries) {
      if (normalizeKey(blockRow[key]) !== expected) {
        matched = false
        break
      }
      score += 1
    }
    if (!matched || score <= 0) continue
    hits.push({
      value: rule.value,
      name: rule.name,
      template_codes: rule.template_codes,
      score,
      criteria: rule.criteria,
    })
  }
  if (!hits.length) return []
  const bestScore = Math.max(...hits.map((x) => x.score))
  return hits.filter((x) => x.score === bestScore)
}

export function resolveTemplateIdsByCode(
  rows: Array<{ id: string; template_code: string; version?: number | null; is_active?: boolean | null }>
) {
  const byCode = new Map<string, string>()
  const sorted = [...rows].sort((a, b) => {
    const codeCompare = String(a.template_code || '').localeCompare(String(b.template_code || ''))
    if (codeCompare !== 0) return codeCompare
    return Number(b.version || 0) - Number(a.version || 0)
  })
  for (const row of sorted) {
    const code = text(row.template_code)
    if (!code || row.is_active === false || byCode.has(code)) continue
    byCode.set(code, String(row.id))
  }
  return byCode
}

export function buildAssemblyEstimateFacts(input: {
  assembly: any
  presetTaxonomies?: PresetTaxonomyRow[]
  bundleTaxonomies?: PresetTaxonomyRow[]
  templateIdsByCode?: Map<string, string>
}) {
  const assembly = input.assembly || {}
  const presetTaxonomies = Array.isArray(input.presetTaxonomies) ? input.presetTaxonomies : []
  const bundleRules = parseBundleRules(Array.isArray(input.bundleTaxonomies) ? input.bundleTaxonomies : [])
  const blocks = Array.isArray(assembly.blocks) ? assembly.blocks : []
  const forcedTemplateIdsFromBlocks = Array.from(
    new Set(
      blocks
        .map((b: any) => String(b?.template_id || '').trim())
        .filter(Boolean)
    )
  )

  let bestLength = 0
  let bestWidth = 0
  let bestArea = 0
  let floorAreaTotal = 0
  let tumAreaTotal = 0
  let floorHeight = 0
  let maxLevelIndex = 0
  const levelSet = new Set<number>()
  let bedroomCount = 0
  let wcCount = 0
  let kitchenCount = 0
  let livingRoomCount = 0
  let inferredFoundationType = ''

  const extraFacts: Record<string, any> = {}
  for (const b of blocks) {
    if (b?.facts_override_json && typeof b.facts_override_json === 'object') {
      Object.assign(extraFacts, b.facts_override_json)
    }
  }

  const blockSpaceTypeCounts: Record<string, number> = {}
  const blockSpaceProfileCounts: Record<string, number> = {}
  const blockSpaceTypeAreaTotals: Record<string, number> = {}
  const blockOpeningPresetCounts: Record<string, number> = {}
  const blockRoofPresetCounts: Record<string, number> = {}
  const blockStairPresetCounts: Record<string, number> = {}
  const blockInteriorPresetCounts: Record<string, number> = {}
  const blockFeatureCounts: Record<string, number> = {}
  const facadeRoleOpeningCounts: Record<string, number> = {}
  const facadeRoleWindowAreaTotals: Record<string, number> = {}
  const openingsByFace: Record<string, { count: number; area_total: number; door_count: number; window_count: number; vent_count: number }> = {}
  let interiorBedCount = 0
  let kitchenCounterLengthTotal = 0
  let wcFixtureSetCount = 0
  let openingCountTotal = 0
  let doorCountTotal = 0
  let windowCountTotal = 0
  let ventCountTotal = 0
  let openingAreaTotal = 0
  let windowAreaTotal = 0
  let doorAreaTotal = 0
  let roofSpecialCountTotal = 0
  let stairBlockCountTotal = 0

  const bundleMatches: Array<{
    block_id: string
    block_name: string
    component_type: string
    matches: Array<{ value: string; name: string; template_codes: string[]; score: number; criteria: Record<string, string> }>
  }> = []
  const bundleConflicts: Array<{
    block_id: string
    block_name: string
    component_type: string
    score: number
    rule_names: string[]
  }> = []
  const blockRows: Array<Record<string, any>> = []
  const forcedTemplateCodesFromBundles = new Set<string>()

  for (const b of blocks) {
    const dims = getSanitizedDims(b)
    const comp = text(b?.component_type).toLowerCase()
    const levelIndex = Number.isFinite(Number(b?.level_index)) ? Math.max(0, Math.trunc(Number(b.level_index))) : 0
    const l = pickNum(dims, ['length_m', 'length', 'build_length_m']) || 0
    const w = pickNum(dims, ['width_m', 'width', 'build_width_m']) || 0
    const area = calcAreaByDims(dims)
    const count = Math.max(1, Math.trunc(pickNum(dims, ['count', 'room_count', 'qty']) || 1))
    const localFloorHeight = pickNum(dims, ['floor_height_m', 'height_m', 'height']) || 0
    const openingEntries = getOpeningEntries(dims)
    const spaceType = text((dims as any)?.space_type || (dims as any)?.room_type || b?.template?.room_type).toLowerCase()
    const spaceProfile = text((dims as any)?.space_profile).toLowerCase()
    const openingPreset = text((dims as any)?.opening_preset).toLowerCase()
    const roofPreset = text((dims as any)?.roof_preset).toLowerCase()
    const stairPreset = text((dims as any)?.stair_preset).toLowerCase()
    const interiorPreset = text((dims as any)?.interior_preset).toLowerCase()
    const foundationType = text((dims as any)?.foundation_type || b?.template?.room_type).toLowerCase()
    const facadeRole = text((dims as any)?.facade_role).toLowerCase()
    const openingPresetConfig = getOpeningPresetConfig(presetTaxonomies, openingPreset)
    const interiorPresetConfig = getInteriorPresetConfig(presetTaxonomies, interiorPreset)

    if (localFloorHeight > floorHeight) floorHeight = localFloorHeight

    if (l > 0 && w > 0 && area >= bestArea) {
      bestArea = area
      bestLength = l
      bestWidth = w
    }

    if (comp === 'tum') {
      tumAreaTotal += area
    } else if (comp === 'foundation') {
      if (!inferredFoundationType) inferredFoundationType = foundationType || ''
    } else if (comp === 'slab') {
      floorAreaTotal += area
      levelSet.add(levelIndex)
      if (levelIndex > maxLevelIndex) maxLevelIndex = levelIndex
    } else if (comp === 'room' || comp === 'wall' || comp === 'column' || comp === 'ceiling' || comp === 'stair') {
      levelSet.add(levelIndex)
      if (levelIndex > maxLevelIndex) maxLevelIndex = levelIndex
    }

    if (comp === 'room') {
      const rt = text(spaceType).toLowerCase()
      if (rt.includes('master') || rt.includes('bed') || rt.includes('ngu')) bedroomCount += count
      else if (rt.includes('wc') || rt.includes('toilet')) wcCount += count
      else if (rt.includes('kitchen') || rt.includes('bep')) kitchenCount += count
      else if (rt.includes('living') || rt.includes('khach')) livingRoomCount += count
    }

    if (spaceType) blockSpaceTypeCounts[spaceType] = (blockSpaceTypeCounts[spaceType] || 0) + count
    if (spaceProfile) blockSpaceProfileCounts[spaceProfile] = (blockSpaceProfileCounts[spaceProfile] || 0) + count
    if (spaceType && area > 0) blockSpaceTypeAreaTotals[spaceType] = (blockSpaceTypeAreaTotals[spaceType] || 0) + area
    if (roofPreset) blockRoofPresetCounts[roofPreset] = (blockRoofPresetCounts[roofPreset] || 0) + count
    if (stairPreset) blockStairPresetCounts[stairPreset] = (blockStairPresetCounts[stairPreset] || 0) + count
    if (interiorPreset) blockInteriorPresetCounts[interiorPreset] = (blockInteriorPresetCounts[interiorPreset] || 0) + count

    if (interiorPresetConfig.semantic_facts) {
      const facts = interiorPresetConfig.semantic_facts
      interiorBedCount += Number((Number(facts.interior_bed_count || 0) * count).toFixed(2))
      kitchenCounterLengthTotal += Number((Number(facts.kitchen_counter_length_total_m || 0) * count).toFixed(2))
      wcFixtureSetCount += Number((Number(facts.wc_fixture_set_count || 0) * count).toFixed(2))
    } else {
      if (interiorPreset === 'bedroom_basic') interiorBedCount += count
      if (interiorPreset === 'kitchen_basic') kitchenCounterLengthTotal += 2.4 * count
      if (interiorPreset === 'wc_basic') wcFixtureSetCount += count
    }

    if ((dims as any)?.has_ceiling) blockFeatureCounts.has_ceiling = (blockFeatureCounts.has_ceiling || 0) + count
    if ((dims as any)?.has_paint) blockFeatureCounts.has_paint = (blockFeatureCounts.has_paint || 0) + count
    if ((dims as any)?.has_electrical) blockFeatureCounts.has_electrical = (blockFeatureCounts.has_electrical || 0) + count
    if ((dims as any)?.has_plumbing) blockFeatureCounts.has_plumbing = (blockFeatureCounts.has_plumbing || 0) + count
    if ((dims as any)?.has_window) blockFeatureCounts.has_window = (blockFeatureCounts.has_window || 0) + count
    if ((dims as any)?.has_door) blockFeatureCounts.has_door = (blockFeatureCounts.has_door || 0) + count

    let blockOpeningCount = 0
    let blockOpeningArea = 0
    let blockDoorCount = 0
    let blockWindowCount = 0
    let blockVentCount = 0

    if (openingEntries.length > 0) {
      openingCountTotal += openingEntries.length
      blockOpeningCount = openingEntries.length
      for (const opening of openingEntries) {
        const openingArea = Number((opening.width * opening.height).toFixed(2))
        const faceKey = factKey(opening.face || 'front') || 'front'
        if (!openingsByFace[faceKey]) {
          openingsByFace[faceKey] = { count: 0, area_total: 0, door_count: 0, window_count: 0, vent_count: 0 }
        }
        openingAreaTotal += openingArea
        blockOpeningArea += openingArea
        openingsByFace[faceKey].count += 1
        openingsByFace[faceKey].area_total = Number((openingsByFace[faceKey].area_total + openingArea).toFixed(2))
        if (opening.type === 'door') {
          doorCountTotal += 1
          blockDoorCount += 1
          doorAreaTotal += openingArea
          openingsByFace[faceKey].door_count += 1
        } else if (opening.type === 'window') {
          windowCountTotal += 1
          blockWindowCount += 1
          windowAreaTotal += openingArea
          openingsByFace[faceKey].window_count += 1
          if (facadeRole) facadeRoleWindowAreaTotals[facadeRole] = Number(((facadeRoleWindowAreaTotals[facadeRole] || 0) + openingArea).toFixed(2))
        } else if (opening.type === 'vent') {
          ventCountTotal += 1
          blockVentCount += 1
          openingsByFace[faceKey].vent_count += 1
        }
        const typeKey = factKey(opening.type)
        if (typeKey) blockOpeningPresetCounts[typeKey] = (blockOpeningPresetCounts[typeKey] || 0) + 1
      }
      if (facadeRole && blockOpeningCount > 0) facadeRoleOpeningCounts[facadeRole] = (facadeRoleOpeningCounts[facadeRole] || 0) + blockOpeningCount
    } else if (openingPreset) {
      blockOpeningPresetCounts[openingPreset] = (blockOpeningPresetCounts[openingPreset] || 0) + count
      const openingCount = Math.max(1, Math.round(openingPresetConfig.opening_count || 1)) * count
      blockOpeningCount = openingCount
      openingCountTotal += openingCount
      const openingArea = Number(((openingPresetConfig.opening_area || 0) * count).toFixed(2))
      blockOpeningArea = openingArea
      if (openingArea > 0) openingAreaTotal += openingArea
      const openingType = openingPresetConfig.opening_type || (openingPreset.startsWith('door_') ? 'door' : openingPreset.startsWith('window_') ? 'window' : openingPreset === 'vent' ? 'vent' : undefined)
      if (openingType === 'door') {
        doorCountTotal += openingCount
        blockDoorCount = openingCount
        if (openingArea > 0) doorAreaTotal += openingArea
      } else if (openingType === 'window') {
        windowCountTotal += openingCount
        blockWindowCount = openingCount
        if (openingArea > 0) windowAreaTotal += openingArea
        if (facadeRole && openingArea > 0) facadeRoleWindowAreaTotals[facadeRole] = Number(((facadeRoleWindowAreaTotals[facadeRole] || 0) + openingArea).toFixed(2))
      } else if (openingType === 'vent') {
        ventCountTotal += openingCount
        blockVentCount = openingCount
      }
      if (facadeRole && openingCount > 0) facadeRoleOpeningCounts[facadeRole] = (facadeRoleOpeningCounts[facadeRole] || 0) + openingCount
    }

    if (roofPreset && roofPreset !== 'flat') roofSpecialCountTotal += count
    if (stairPreset) stairBlockCountTotal += count

    const blockRow = {
      block_id: String(b?.id || ''),
      block_name: text(b?.block_name || b?.component_type || 'Block'),
      component_type: comp,
      level_index: levelIndex,
      template_id: text(b?.template_id),
      template_code: text(b?.template?.template_code),
      template_name: text(b?.template?.template_name),
      count,
      area_m2: Number(area.toFixed(2)),
      length_m: l > 0 ? Number(l.toFixed(2)) : 0,
      width_m: w > 0 ? Number(w.toFixed(2)) : 0,
      height_m: localFloorHeight > 0 ? Number(localFloorHeight.toFixed(2)) : 0,
      space_type: spaceType,
      space_profile: spaceProfile,
      foundation_type: foundationType,
      opening_preset: openingPreset,
      roof_preset: roofPreset,
      stair_preset: stairPreset,
      interior_preset: interiorPreset,
      facade_role: facadeRole,
      opening_count: blockOpeningCount,
      opening_area_total: Number(blockOpeningArea.toFixed(2)),
      door_count: blockDoorCount,
      window_count: blockWindowCount,
      vent_count: blockVentCount,
      has_ceiling: Boolean((dims as any)?.has_ceiling),
      has_paint: Boolean((dims as any)?.has_paint),
      has_electrical: Boolean((dims as any)?.has_electrical),
      has_plumbing: Boolean((dims as any)?.has_plumbing),
      has_window: Boolean((dims as any)?.has_window),
      has_door: Boolean((dims as any)?.has_door),
    }
    const matchedRules = matchBundleRules(blockRow, bundleRules)
    if (matchedRules.length) {
      bundleMatches.push({
        block_id: blockRow.block_id,
        block_name: blockRow.block_name,
        component_type: blockRow.component_type,
        matches: matchedRules,
      })
      if (matchedRules.length > 1) {
        bundleConflicts.push({
          block_id: blockRow.block_id,
          block_name: blockRow.block_name,
          component_type: blockRow.component_type,
          score: matchedRules[0]?.score || 0,
          rule_names: matchedRules.map((x) => x.name),
        })
      }
      for (const match of matchedRules) {
        for (const code of match.template_codes) forcedTemplateCodesFromBundles.add(code)
      }
    }
    blockRows.push({
      ...blockRow,
      bundle_template_codes: matchedRules.flatMap((x) => x.template_codes),
    })
  }

  const floors = levelSet.size > 0 ? levelSet.size : (maxLevelIndex + 1)
  const tumCount = tumAreaTotal > 0 ? 1 : 0
  const footprintArea = bestArea > 0 ? bestArea : (bestLength > 0 && bestWidth > 0 ? bestLength * bestWidth : 0)
  const totalArea = floorAreaTotal > 0 ? (floorAreaTotal + tumAreaTotal) : (footprintArea > 0 ? footprintArea * Math.max(1, floors) + tumAreaTotal : 0)

  const wallMetrics = calcWallMetricsByBlock(blocks)
  if (wallMetrics.wall_surface_area_total != null) extraFacts.wall_surface_area_total = wallMetrics.wall_surface_area_total
  if (wallMetrics.wall_length_total != null) extraFacts.wall_length_total = wallMetrics.wall_length_total
  extraFacts.assembly_id = assembly.id
  extraFacts.assembly_name = assembly.name
  extraFacts.block_count = blocks.length
  extraFacts.block_space_type_counts = blockSpaceTypeCounts
  extraFacts.block_space_profile_counts = blockSpaceProfileCounts
  extraFacts.block_space_type_area_totals = blockSpaceTypeAreaTotals
  extraFacts.block_opening_preset_counts = blockOpeningPresetCounts
  extraFacts.block_roof_preset_counts = blockRoofPresetCounts
  extraFacts.block_stair_preset_counts = blockStairPresetCounts
  extraFacts.block_interior_preset_counts = blockInteriorPresetCounts
  extraFacts.block_feature_counts = blockFeatureCounts
  extraFacts.facade_role_opening_counts = facadeRoleOpeningCounts
  extraFacts.facade_role_window_area_totals = facadeRoleWindowAreaTotals
  extraFacts.openings_by_face = openingsByFace
  extraFacts.interior_bed_count = interiorBedCount
  extraFacts.kitchen_counter_length_total_m = Number(kitchenCounterLengthTotal.toFixed(2))
  extraFacts.wc_fixture_set_count = wcFixtureSetCount
  extraFacts.opening_count_total = openingCountTotal
  extraFacts.door_count_total = doorCountTotal
  extraFacts.window_count_total = windowCountTotal
  extraFacts.vent_count_total = ventCountTotal
  extraFacts.opening_area_total = Number(openingAreaTotal.toFixed(2))
  extraFacts.window_area_total = Number(windowAreaTotal.toFixed(2))
  extraFacts.door_area_total = Number(doorAreaTotal.toFixed(2))
  extraFacts.roof_special_count_total = roofSpecialCountTotal
  extraFacts.stair_block_count_total = stairBlockCountTotal
  for (const [key, value] of Object.entries(blockSpaceTypeCounts)) extraFacts[`space_type_count_${factKey(key)}`] = value
  for (const [key, value] of Object.entries(blockSpaceProfileCounts)) extraFacts[`space_profile_count_${factKey(key)}`] = value
  for (const [key, value] of Object.entries(blockSpaceTypeAreaTotals)) extraFacts[`space_type_area_${factKey(key)}`] = Number(value.toFixed(2))
  for (const [key, value] of Object.entries(blockOpeningPresetCounts)) extraFacts[`opening_preset_count_${factKey(key)}`] = value
  for (const [key, value] of Object.entries(blockRoofPresetCounts)) extraFacts[`roof_preset_count_${factKey(key)}`] = value
  for (const [key, value] of Object.entries(blockStairPresetCounts)) extraFacts[`stair_preset_count_${factKey(key)}`] = value
  for (const [key, value] of Object.entries(blockInteriorPresetCounts)) extraFacts[`interior_preset_count_${factKey(key)}`] = value
  for (const [key, value] of Object.entries(blockFeatureCounts)) extraFacts[`${factKey(key)}_count`] = value
  for (const [key, value] of Object.entries(facadeRoleOpeningCounts)) extraFacts[`facade_role_opening_count_${factKey(key)}`] = value
  for (const [key, value] of Object.entries(facadeRoleWindowAreaTotals)) extraFacts[`facade_role_window_area_${factKey(key)}`] = Number(value.toFixed(2))
  for (const [key, value] of Object.entries(openingsByFace)) {
    extraFacts[`opening_face_count_${factKey(key)}`] = value.count
    extraFacts[`opening_face_area_${factKey(key)}`] = Number(value.area_total.toFixed(2))
    extraFacts[`opening_face_door_count_${factKey(key)}`] = value.door_count
    extraFacts[`opening_face_window_count_${factKey(key)}`] = value.window_count
    extraFacts[`opening_face_vent_count_${factKey(key)}`] = value.vent_count
  }

  const forcedTemplateIdsFromBundles = Array.from(
    new Set(
      Array.from(forcedTemplateCodesFromBundles)
        .map((code) => input.templateIdsByCode?.get(code) || '')
        .filter(Boolean)
    )
  )

  return {
    inferred_input: {
      build_length_m: bestLength > 0 ? bestLength : null,
      build_width_m: bestWidth > 0 ? bestWidth : null,
      floor_height_m: floorHeight > 0 ? floorHeight : 3.6,
      floor_area_total: totalArea > 0 ? totalArea : null,
      floors: floors > 0 ? floors : null,
      tum_count: tumCount,
      foundation_type: inferredFoundationType || null,
      bedroom_count: bedroomCount || null,
      wc_count: wcCount || null,
      kitchen_count: kitchenCount || null,
      living_room_count: livingRoomCount || null,
    },
    extra_facts: extraFacts,
    block_rows: blockRows,
    bundle_matches: bundleMatches,
    bundle_conflicts: bundleConflicts,
    forced_template_ids_from_blocks: forcedTemplateIdsFromBlocks,
    forced_template_codes_from_bundles: Array.from(forcedTemplateCodesFromBundles),
    forced_template_ids_from_bundles: forcedTemplateIdsFromBundles,
    assembly_summary: {
      assembly_id: assembly.id,
      block_count: blocks.length,
      inferred_floors: floors,
      inferred_floor_area_total: totalArea,
      inferred_tum_area_total: tumAreaTotal,
    },
  }
}
