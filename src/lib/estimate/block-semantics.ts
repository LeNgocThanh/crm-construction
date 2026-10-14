type AnyRecord = Record<string, unknown>

const ALL_FEATURE_KEYS = [
  'has_ceiling',
  'has_paint',
  'has_electrical',
  'has_plumbing',
  'has_window',
  'has_door',
] as const

type FeatureKey = (typeof ALL_FEATURE_KEYS)[number]

export function getAssemblyComponentSemanticFlags(componentType?: string | null) {
  const type = String(componentType || '').trim().toLowerCase()
  const isRoom = type === 'room'
  const isWall = type === 'wall'
  const isFoundation = type === 'foundation'
  const isRoof = type === 'roof' || type === 'tum_roof'
  const isStair = type === 'stair'
  const isCeiling = type === 'ceiling'
  const allowsOpenings = isRoom || isWall
  const allowsSpace = isRoom
  const allowsInteriorPreset = isRoom
  const allowedFeatureKeys = isRoom
    ? new Set<FeatureKey>(ALL_FEATURE_KEYS)
    : isWall
      ? new Set<FeatureKey>(['has_window', 'has_door'])
      : isCeiling || isStair
        ? new Set<FeatureKey>(['has_paint', 'has_electrical'])
        : new Set<FeatureKey>()
  return {
    isRoom,
    isWall,
    isFoundation,
    isRoof,
    isStair,
    isCeiling,
    allowsOpenings,
    allowsSpace,
    allowsInteriorPreset,
    allowedFeatureKeys,
  }
}

export function sanitizeAssemblyBlockDimensions(componentType: string | null | undefined, dimensions: unknown) {
  const src = dimensions && typeof dimensions === 'object' ? { ...(dimensions as AnyRecord) } : {}
  const flags = getAssemblyComponentSemanticFlags(componentType)

  if (!flags.allowsSpace) {
    src.room_type = ''
    src.space_type = ''
    src.space_profile = ''
  }
  if (!flags.isFoundation) src.foundation_type = ''
  if (!flags.allowsInteriorPreset) src.interior_preset = ''
  if (!flags.allowsOpenings) {
    src.opening_preset = ''
    src.openings = []
  }
  if (!flags.isRoof) src.roof_preset = ''
  if (!flags.isStair) src.stair_preset = ''

  for (const key of ALL_FEATURE_KEYS) {
    if (!flags.allowedFeatureKeys.has(key)) src[key] = false
  }

  return src
}
