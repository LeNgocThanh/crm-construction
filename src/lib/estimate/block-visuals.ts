export type AssemblyComponentVisual = {
  color: string
  badge: string
  label: string
}

export const ASSEMBLY_COMPONENT_VISUALS: Record<string, AssemblyComponentVisual> = {
  foundation: { color: '#f97316', badge: 'MG', label: 'Móng' },
  basement: { color: '#eab308', badge: 'HM', label: 'Hầm' },
  slab: { color: '#3b82f6', badge: 'SN', label: 'Sàn' },
  wall: { color: '#22c55e', badge: 'TG', label: 'Tường' },
  room: { color: '#a855f7', badge: 'PH', label: 'Phòng' },
  column: { color: '#14b8a6', badge: 'CT', label: 'Cột' },
  stair: { color: '#f43f5e', badge: 'TH', label: 'Thang' },
  ceiling: { color: '#06b6d4', badge: 'TR', label: 'Trần' },
  tum: { color: '#8b5cf6', badge: 'TM', label: 'Tum' },
  roof: { color: '#64748b', badge: 'MA', label: 'Mái' },
  tum_roof: { color: '#64748b', badge: 'MT', label: 'Mái tum' },
}

export function getAssemblyComponentVisual(componentType?: string | null): AssemblyComponentVisual {
  const key = String(componentType || '').trim().toLowerCase()
  return ASSEMBLY_COMPONENT_VISUALS[key] || { color: '#64748b', badge: 'BL', label: key || 'Block' }
}
