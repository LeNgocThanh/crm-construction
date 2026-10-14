'use client'

import { Fragment, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Html, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js'
import { ASSEMBLY_COMPONENT_VISUALS, getAssemblyComponentVisual } from '@/lib/estimate/block-visuals'
import { buildPresetOptions, getOpeningPresetConfig, getRoofPresetConfig, getStairPresetConfig, type PresetTaxonomyRow } from '@/lib/estimate/preset-taxonomies'

type Block = {
  id: string
  component_type: string
  block_name?: string | null
  level_index: number
  sort_order?: number
  length_order?: number
  height_order?: number
  dimensions_json?: Record<string, unknown> | null
}

type Assembly = {
  id: string
  name: string
  blocks?: Block[]
  customer_id?: string | null
  house_type?: string | null
  style?: string | null
  level?: string | null
  region_code?: string | null
  status?: string | null
  updated_at?: string
  _count?: { blocks?: number }
}
type AssemblyDetail = Assembly & {
  customer?: { full_name?: string | null } | null
}
type Taxonomy = PresetTaxonomyRow & {
  id: string
}

type PlacedBlock = {
  block: Block
  x: number
  y: number
  z: number
  length: number
  width: number
  height: number
}
type LayoutPresetKey = 'zero' | 'compact' | 'standard' | 'spacious'
type LayoutModeKey = 'pack' | 'by_length'
type Draft3D = { x_m?: number; y_m?: number; z_m?: number; length_m?: number; width_m?: number; height_m?: number }
type DraftDeltaChange = { blockId: string; before?: Draft3DSemantic; after?: Draft3DSemantic }
type DraftDelta = { changes: DraftDeltaChange[] }
type OpeningDraft = {
  type: 'door' | 'window' | 'vent'
  face: 'front' | 'back' | 'left' | 'right'
  offset: number
  width: number
  height: number
  sill: number
}
type OpeningVisual = { x: number; y: number; z: number; w: number; h: number; color: string; rotateY?: number }
type DesignerViewMode = 'solid' | 'xray' | 'presentation'
type ColorPresetKey = 'default' | 'pastel' | 'contrast' | 'print_friendly'
type EditorMode = 'quick' | 'standard' | 'advanced'
type PaginationState = { page: number; limit: number; total: number; totalPages: number }
const ASSEMBLY_DETAIL_CACHE_LIMIT = 10

const DESIGNER_3D_VIEW_MODE_KEY = 'assembly_designer_3d_view_mode'
const DESIGNER_3D_COLOR_OVERRIDES_KEY = 'assembly_designer_3d_color_overrides'
const DESIGNER_3D_COLOR_PRESET_KEY = 'assembly_designer_3d_color_preset'

const COLOR_PRESET_OPTIONS: Array<{ value: ColorPresetKey; label: string }> = [
  { value: 'default', label: 'Mac dinh' },
  { value: 'pastel', label: 'Pastel' },
  { value: 'contrast', label: 'Tuong phan cao' },
  { value: 'print_friendly', label: 'In an / nhe mau' },
]

const COLOR_PRESETS: Record<ColorPresetKey, Record<string, string>> = {
  default: {},
  pastel: {
    foundation: '#fb923c',
    basement: '#fde68a',
    slab: '#93c5fd',
    wall: '#86efac',
    room: '#d8b4fe',
    column: '#99f6e4',
    stair: '#fda4af',
    ceiling: '#67e8f9',
    tum: '#c4b5fd',
    roof: '#cbd5e1',
    tum_roof: '#cbd5e1',
  },
  contrast: {
    foundation: '#ea580c',
    basement: '#ca8a04',
    slab: '#1d4ed8',
    wall: '#16a34a',
    room: '#7c3aed',
    column: '#0f766e',
    stair: '#e11d48',
    ceiling: '#0891b2',
    tum: '#6d28d9',
    roof: '#334155',
    tum_roof: '#1e293b',
  },
  print_friendly: {
    foundation: '#b45309',
    basement: '#a16207',
    slab: '#1e40af',
    wall: '#166534',
    room: '#6d28d9',
    column: '#155e75',
    stair: '#be123c',
    ceiling: '#0f766e',
    tum: '#5b21b6',
    roof: '#475569',
    tum_roof: '#475569',
  },
}

const SPACE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'living_room', label: 'Phong khach' },
  { value: 'bedroom', label: 'Phong ngu' },
  { value: 'master_bedroom', label: 'Phong ngu master' },
  { value: 'kitchen', label: 'Bep' },
  { value: 'wc', label: 'WC' },
  { value: 'hallway', label: 'Hanh lang' },
  { value: 'stair', label: 'Cau thang' },
  { value: 'balcony', label: 'Ban cong' },
  { value: 'garage', label: 'Gara' },
  { value: 'storage', label: 'Kho' },
  { value: 'tum', label: 'Tum' },
  { value: 'roof', label: 'Mai / san thuong' },
  { value: 'foundation', label: 'Mong' },
  { value: 'other', label: 'Khac' },
]

const SPACE_PROFILE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'basic', label: 'Co ban' },
  { value: 'economy', label: 'Tiet kiem' },
  { value: 'premium', label: 'Cao cap' },
  { value: 'utility', label: 'Phu tro' },
]

const DEFAULT_OPENING_PRESET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'door_single', label: 'Cua di 1 canh' },
  { value: 'door_double', label: 'Cua di 2 canh' },
  { value: 'door_sliding', label: 'Cua lua' },
  { value: 'window_small', label: 'Cua so nho' },
  { value: 'window_large', label: 'Cua so lon' },
  { value: 'vent', label: 'O thong gio' },
]

const DEFAULT_ROOF_PRESET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'flat', label: 'Mai bang' },
  { value: 'lean_to', label: 'Mai lech' },
  { value: 'thai_basic', label: 'Mai Thai so bo' },
  { value: 'terrace', label: 'San thuong' },
]

const DEFAULT_STAIR_PRESET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'straight', label: 'Thang thang' },
  { value: 'l_shape', label: 'Thang chu L' },
  { value: 'u_shape', label: 'Thang chu U' },
]
const DEFAULT_INTERIOR_PRESET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'bedroom_basic', label: 'Phong ngu co ban' },
  { value: 'kitchen_basic', label: 'Bep co ban' },
  { value: 'wc_basic', label: 'WC co ban' },
]
const FACADE_ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'main_front', label: 'Mat tien chinh' },
  { value: 'secondary_front', label: 'Mat tien phu' },
  { value: 'side_left', label: 'Hong trai' },
  { value: 'side_right', label: 'Hong phai' },
  { value: 'rear', label: 'Mat sau' },
  { value: 'interior', label: 'Khoi ben trong' },
]

const BLOCK_FEATURE_OPTIONS = [
  { key: 'has_ceiling', label: 'Co tran' },
  { key: 'has_paint', label: 'Co son' },
  { key: 'has_electrical', label: 'Co dien' },
  { key: 'has_plumbing', label: 'Co nuoc' },
  { key: 'has_window', label: 'Co cua so' },
  { key: 'has_door', label: 'Co cua di' },
] as const
type SemanticHint = { title: string; reasons: string[] }

type SemanticFeatureKey = (typeof BLOCK_FEATURE_OPTIONS)[number]['key']
type Draft3DSemantic = Draft3D & {
  space_type?: string
  space_profile?: string
  room_type?: string
  facade_role?: string
  foundation_type?: string
  interior_preset?: string
  opening_preset?: string
  roof_preset?: string
  stair_preset?: string
  has_ceiling?: boolean
  has_paint?: boolean
  has_electrical?: boolean
  has_plumbing?: boolean
  has_window?: boolean
  has_door?: boolean
  openings?: OpeningDraft[]
}

function getComponentFieldFlags(componentType?: string) {
  const type = String(componentType || '').trim().toLowerCase()
  const isRoom = type === 'room'
  const isWall = type === 'wall'
  const isFoundation = type === 'foundation'
  const isRoof = type === 'roof'
  const isStair = type === 'stair'
  const supportsFacade = isRoom || isWall || isRoof || type === 'tum' || type === 'tum_roof'
  const allowsOpenings = isRoom || isWall
  const allowedFeatureKeys = isRoom
    ? new Set<SemanticFeatureKey>(BLOCK_FEATURE_OPTIONS.map((x) => x.key))
    : isWall
      ? new Set<SemanticFeatureKey>(['has_window', 'has_door'])
      : new Set<SemanticFeatureKey>()
  return { isRoom, isWall, isFoundation, isRoof, isStair, supportsFacade, allowsOpenings, allowedFeatureKeys }
}

function sanitizeDraftByComponentType<T extends Record<string, any>>(componentType: string, draft: T): T {
  const flags = getComponentFieldFlags(componentType)
  const next = { ...draft }
  if (!flags.isRoom) {
    next.space_type = ''
    next.space_profile = ''
    next.room_type = ''
    next.interior_preset = ''
  }
  if (!flags.supportsFacade) next.facade_role = ''
  if (!flags.isFoundation) next.foundation_type = ''
  if (!flags.isRoof) next.roof_preset = ''
  if (!flags.isStair) next.stair_preset = ''
  if (!flags.allowsOpenings) {
    next.opening_preset = ''
    next.openings = []
  }
  for (const feature of BLOCK_FEATURE_OPTIONS) {
    if (!flags.allowedFeatureKeys.has(feature.key)) next[feature.key] = false
  }
  return next
}

function buildSemanticHints(input: {
  componentType?: string
  spaceType?: string
  spaceProfile?: string
  facadeRole?: string
  foundationType?: string
  openingPreset?: string
  roofPreset?: string
  stairPreset?: string
}) {
  const hints: SemanticHint[] = []
  const componentType = String(input.componentType || '').trim().toLowerCase()
  const spaceType = String(input.spaceType || '').trim().toLowerCase()
  const spaceProfile = String(input.spaceProfile || '').trim().toLowerCase()
  const facadeRole = String(input.facadeRole || '').trim().toLowerCase()
  const foundationType = String(input.foundationType || '').trim().toLowerCase()
  const openingPreset = String(input.openingPreset || '').trim().toLowerCase()
  const roofPreset = String(input.roofPreset || '').trim().toLowerCase()
  const stairPreset = String(input.stairPreset || '').trim().toLowerCase()

  if (spaceType === 'master_bedroom') hints.push({ title: 'tpl_room_master_bedroom_std', reasons: ['Block dang la phong ngu master'] })
  else if (spaceType === 'bedroom') hints.push({ title: 'tpl_room_bedroom_std', reasons: ['Block dang la phong ngu'] })
  else if (spaceType === 'kitchen') hints.push({ title: 'tpl_room_kitchen_std', reasons: ['Block dang la bep'] })
  else if (spaceType === 'wc') hints.push({ title: 'tpl_room_wc_std', reasons: ['Block dang la WC'] })

  if (componentType === 'foundation' || foundationType === 'mong_coc') {
    hints.push({ title: 'tpl_foundation_mong_coc_std', reasons: ['Khoi mong / foundation_type = mong_coc'] })
  }
  if (spaceType === 'roof' || roofPreset === 'thai_basic') {
    hints.push({ title: 'tpl_roof_thai_basic_std', reasons: ['Block mai hoac preset mai Thai'] })
  }
  if (spaceProfile === 'premium') {
    hints.push({ title: 'Rule semantic_space_profile_premium', reasons: ['Khong gian muc cao cap se tang he so'] })
  }
  if (facadeRole === 'main_front' || facadeRole === 'secondary_front') {
    hints.push({ title: 'tpl_facade_glass_std', reasons: ['Block dang duoc danh dau la mat tien de ap template facade'] })
  }
  if (openingPreset === 'window_large') {
    hints.push({ title: 'Rule semantic_window_large_glass', reasons: ['Co cua so lon -> bo sung kinh mat tien'] })
  }
  if (roofPreset === 'thai_basic') {
    hints.push({ title: 'Rule semantic_roof_thai_basic', reasons: ['Co mai Thai -> can vat tu / note mai'] })
  }
  if (stairPreset) {
    hints.push({ title: `Preset cau thang: ${stairPreset}`, reasons: ['Dang co tac dong hinh khoi 3D va extra facts preview'] })
  }

  return hints
}

function buildSemanticPreset(spaceType: string): Partial<Draft3DSemantic> {
  switch (String(spaceType || '').trim()) {
    case 'living_room':
      return { has_ceiling: true, has_paint: true, has_electrical: true, has_window: true, has_door: true }
    case 'bedroom':
    case 'master_bedroom':
      return { has_ceiling: true, has_paint: true, has_electrical: true, has_window: true, has_door: true, interior_preset: 'bedroom_basic' }
    case 'kitchen':
      return { has_ceiling: true, has_paint: true, has_electrical: true, has_plumbing: true, has_window: true, has_door: true, interior_preset: 'kitchen_basic' }
    case 'wc':
      return { has_ceiling: true, has_paint: true, has_electrical: true, has_plumbing: true, has_door: true, interior_preset: 'wc_basic' }
    case 'hallway':
      return { has_ceiling: true, has_paint: true, has_electrical: true }
    case 'stair':
      return { has_paint: true, has_electrical: true }
    case 'balcony':
      return { has_door: true }
    case 'garage':
      return { has_electrical: true, has_door: true }
    case 'storage':
      return { has_door: true }
    case 'tum':
      return { has_ceiling: true, has_paint: true, has_electrical: true, has_door: true }
    case 'roof':
      return {}
    case 'foundation':
      return {}
    default:
      return {}
  }
}

function n(v: unknown) {
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

function pickNum(obj: Record<string, unknown> | null | undefined, keys: string[]) {
  const src = obj && typeof obj === 'object' ? obj : {}
  for (const k of keys) {
    const x = n((src as any)[k])
    if (x != null && x > 0) return x
  }
  return null
}

function blockGeom(block: Block) {
  const d = block.dimensions_json || {}
  const minDim = minSizeByComponentType(block.component_type)
  const area = pickNum(d, ['area_m2', 'area', 'floor_area', 'footprint_area'])
  const length = Math.max(minDim, pickNum(d, ['length_m', 'length', 'build_length_m']) || Math.max(2, Math.sqrt(area || 25)))
  const width = Math.max(minDim, pickNum(d, ['width_m', 'width', 'build_width_m']) || 4)
  const defaultHeight = Math.max(2.8, area ? Math.sqrt(area) * 0.25 : 3.6)
  const height = Math.max(minDim, pickNum(d, ['height_m', 'floor_height_m', 'height']) || defaultHeight)
  const x = n((d as any).x_m) ?? 0
  const y = n((d as any).y_m) ?? 0
  const z = n((d as any).z_m) ?? 0
  return { length, width, height, x, y, z }
}

function intersectVolume(a: PlacedBlock, b: PlacedBlock) {
  const ax2 = a.x + a.length
  const ay2 = a.y + a.height
  const az2 = a.z + a.width
  const bx2 = b.x + b.length
  const by2 = b.y + b.height
  const bz2 = b.z + b.width
  const ix = Math.min(ax2, bx2) - Math.max(a.x, b.x)
  const iy = Math.min(ay2, by2) - Math.max(a.y, b.y)
  const iz = Math.min(az2, bz2) - Math.max(a.z, b.z)
  if (ix <= 0 || iy <= 0 || iz <= 0) return 0
  return ix * iy * iz
}

const STORAGE_KEY = 'assembly_estimate_preview_context_v1'
const MAX_COORD = 1000
const MIN_SIZE = 0.5
const MIN_SIZE_THIN = 0.1
const MAX_SIZE = 300
const SNAP_STEP_M = 0.1
const LAYOUT_PRESETS: Record<LayoutPresetKey, { gapX: number; gapY: number }> = {
  zero: { gapX: 0, gapY: 0 },
  compact: { gapX: 0.5, gapY: 0.5 },
  standard: { gapX: 1, gapY: 1 },
  spacious: { gapX: 2, gapY: 1.5 },
}
function minSizeByComponentType(componentType: string | null | undefined) {
  const t = String(componentType || '').trim().toLowerCase()
  if (t === 'slab' || t === 'ceiling') return MIN_SIZE_THIN
  return MIN_SIZE
}
function snap01(n: number) {
  return Math.round(n / SNAP_STEP_M) * SNAP_STEP_M
}
function isBlockLocked(block: Block) {
  return Boolean((block?.dimensions_json as any)?.locked)
}

function getRoofPreset(block: Block, draft?: Partial<Draft3DSemantic>) {
  const dims = block?.dimensions_json && typeof block.dimensions_json === 'object' ? block.dimensions_json : {}
  return String(draft?.roof_preset ?? (dims as any).roof_preset ?? '').trim()
}

function getOpeningPreset(block: Block, draft?: Partial<Draft3DSemantic>) {
  const dims = block?.dimensions_json && typeof block.dimensions_json === 'object' ? block.dimensions_json : {}
  return String(draft?.opening_preset ?? (dims as any).opening_preset ?? '').trim()
}

function getStairPreset(block: Block, draft?: Partial<Draft3DSemantic>) {
  const dims = block?.dimensions_json && typeof block.dimensions_json === 'object' ? block.dimensions_json : {}
  return String(draft?.stair_preset ?? (dims as any).stair_preset ?? '').trim()
}

function getBodyAndRoofHeight(totalHeight: number, roofPreset: string, roofConfig?: ReturnType<typeof getRoofPresetConfig>) {
  if (!roofPreset || roofPreset === 'flat') return { bodyHeight: totalHeight, roofHeight: 0 }
  const roofRatio = roofConfig?.roof_height_ratio && roofConfig.roof_height_ratio > 0 ? roofConfig.roof_height_ratio : 0.28
  const roofMin = roofConfig?.roof_height_min && roofConfig.roof_height_min > 0 ? roofConfig.roof_height_min : 0.18
  const bodyMin = roofConfig?.body_height_min && roofConfig.body_height_min > 0 ? roofConfig.body_height_min : 0.3
  const roofHeight = Math.max(roofMin, Number((totalHeight * roofRatio).toFixed(2)))
  const bodyHeight = Math.max(bodyMin, Number((totalHeight - roofHeight).toFixed(2)))
  return { bodyHeight, roofHeight }
}

function getOpeningVisual(openingPreset: string, length: number, bodyHeight: number, width: number, openingConfig?: ReturnType<typeof getOpeningPresetConfig>): OpeningVisual[] {
  const faceZ = width / 2 + 0.03
  const colorDoor = openingConfig?.color || '#1d4ed8'
  const colorWindow = openingConfig?.color || '#7dd3fc'
  const colorVent = openingConfig?.color || '#cbd5e1'
  const widthRatio = openingConfig?.width_ratio && openingConfig.width_ratio > 0 ? openingConfig.width_ratio : undefined
  const minWidth = openingConfig?.min_width && openingConfig.min_width > 0 ? openingConfig.min_width : undefined
  const heightRatio = openingConfig?.height_ratio && openingConfig.height_ratio > 0 ? openingConfig.height_ratio : undefined
  const maxHeight = openingConfig?.max_height && openingConfig.max_height > 0 ? openingConfig.max_height : undefined
  const sillRatio = openingConfig?.sill_ratio && openingConfig.sill_ratio >= 0 ? openingConfig.sill_ratio : undefined
  const minSill = openingConfig?.min_sill && openingConfig.min_sill >= 0 ? openingConfig.min_sill : undefined
  switch (openingPreset) {
    case 'door_single':
      return [{ x: 0, y: -bodyHeight / 2 + Math.min(bodyHeight * (sillRatio ?? 0.32), minSill ?? 1.05), z: faceZ, w: Math.max(minWidth ?? 0.7, length * (widthRatio ?? 0.18)), h: Math.min(bodyHeight * (heightRatio ?? 0.64), maxHeight ?? 2.1), color: colorDoor }]
    case 'door_double':
      return [{ x: 0, y: -bodyHeight / 2 + Math.min(bodyHeight * (sillRatio ?? 0.32), minSill ?? 1.05), z: faceZ, w: Math.max(minWidth ?? 1.4, length * (widthRatio ?? 0.32)), h: Math.min(bodyHeight * (heightRatio ?? 0.64), maxHeight ?? 2.2), color: colorDoor }]
    case 'door_sliding':
      return [{ x: 0, y: -bodyHeight / 2 + Math.min(bodyHeight * (sillRatio ?? 0.28), minSill ?? 0.95), z: faceZ, w: Math.max(minWidth ?? 1.6, length * (widthRatio ?? 0.38)), h: Math.min(bodyHeight * (heightRatio ?? 0.56), maxHeight ?? 1.95), color: colorDoor }]
    case 'window_small':
      return [{ x: 0, y: Math.max(minSill ?? -0.1, bodyHeight * (sillRatio ?? 0.08)), z: faceZ, w: Math.max(minWidth ?? 0.9, length * (widthRatio ?? 0.22)), h: Math.max(maxHeight ?? 0.6, bodyHeight * (heightRatio ?? 0.22)), color: colorWindow }]
    case 'window_large':
      return [{ x: 0, y: Math.max(minSill ?? 0, bodyHeight * (sillRatio ?? 0.06)), z: faceZ, w: Math.max(minWidth ?? 1.6, length * (widthRatio ?? 0.42)), h: Math.max(maxHeight ?? 0.8, bodyHeight * (heightRatio ?? 0.3)), color: colorWindow }]
    case 'vent':
      return [{ x: 0, y: bodyHeight * (sillRatio ?? 0.22), z: faceZ, w: Math.max(minWidth ?? 0.7, length * (widthRatio ?? 0.18)), h: Math.max(maxHeight ?? 0.32, bodyHeight * (heightRatio ?? 0.12)), color: colorVent }]
    default:
      return []
  }
}

function normalizeOpeningDraft(value: any, length: number, bodyHeight: number, width: number): OpeningDraft | null {
  const typeRaw = String(value?.type || '').trim().toLowerCase()
  const faceRaw = String(value?.face || '').trim().toLowerCase()
  const type: OpeningDraft['type'] = typeRaw === 'window' || typeRaw === 'vent' ? typeRaw : 'door'
  const face: OpeningDraft['face'] = faceRaw === 'back' || faceRaw === 'left' || faceRaw === 'right' ? faceRaw : 'front'
  const faceSpan = face === 'left' || face === 'right' ? width : length
  const defaultWidth = type === 'door' ? Math.max(0.9, faceSpan * 0.18) : type === 'window' ? Math.max(1.2, faceSpan * 0.24) : Math.max(0.7, faceSpan * 0.16)
  const defaultHeight = type === 'door' ? Math.min(bodyHeight * 0.64, 2.2) : type === 'window' ? Math.max(0.8, bodyHeight * 0.28) : Math.max(0.32, bodyHeight * 0.12)
  const maxWidth = Math.max(0.4, faceSpan - 0.3)
  const safeWidth = Math.max(0.3, Math.min(maxWidth, Number(value?.width) || defaultWidth))
  const safeHeight = Math.max(0.25, Math.min(bodyHeight - 0.15, Number(value?.height) || defaultHeight))
  const safeSill = Math.max(0, Math.min(bodyHeight - safeHeight - 0.05, Number(value?.sill) || (type === 'door' ? 0 : bodyHeight * 0.28)))
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

function getCustomOpenings(block: Block, draft: Partial<Draft3DSemantic> | undefined, length: number, bodyHeight: number, width: number) {
  const dims = block?.dimensions_json && typeof block.dimensions_json === 'object' ? block.dimensions_json : {}
  const src = Array.isArray(draft?.openings) ? draft?.openings : Array.isArray((dims as any).openings) ? (dims as any).openings : []
  return src
    .map((opening: any) => normalizeOpeningDraft(opening, length, bodyHeight, width))
    .filter(Boolean) as OpeningDraft[]
}

function openingsToVisuals(openings: OpeningDraft[], length: number, bodyHeight: number, width: number): OpeningVisual[] {
  return openings.map((opening) => {
    const sideDepth = width / 2 + 0.03
    const sideLength = length / 2 + 0.03
    const y = -bodyHeight / 2 + opening.sill + opening.height / 2
    if (opening.face === 'left' || opening.face === 'right') {
      return {
        x: opening.face === 'left' ? -sideLength : sideLength,
        y,
        z: opening.offset,
        w: opening.width,
        h: opening.height,
        color: opening.type === 'door' ? '#1d4ed8' : opening.type === 'window' ? '#7dd3fc' : '#cbd5e1',
        rotateY: Math.PI / 2,
      }
    }
    return {
      x: opening.offset,
      y,
      z: opening.face === 'back' ? -sideDepth : sideDepth,
      w: opening.width,
      h: opening.height,
      color: opening.type === 'door' ? '#1d4ed8' : opening.type === 'window' ? '#7dd3fc' : '#cbd5e1',
      rotateY: 0,
    }
  })
}

function getOpeningVisuals(block: Block, draft: Partial<Draft3DSemantic> | undefined, length: number, bodyHeight: number, width: number, openingConfig?: ReturnType<typeof getOpeningPresetConfig>) {
  const customOpenings = getCustomOpenings(block, draft, length, bodyHeight, width)
  if (customOpenings.length > 0) return openingsToVisuals(customOpenings, length, bodyHeight, width)
  return getOpeningVisual(getOpeningPreset(block, draft), length, bodyHeight, width, openingConfig)
}

function getStairVisuals(stairPreset: string, length: number, bodyHeight: number, width: number, stairConfig?: ReturnType<typeof getStairPresetConfig>) {
  if (!stairPreset) return []
  const stepCount = Math.max(3, Math.round(stairConfig?.step_count && stairConfig.step_count > 0 ? stairConfig.step_count : stairPreset === 'u_shape' ? 6 : stairPreset === 'l_shape' ? 5 : 4))
  const stepHeight = Math.max(0.12, bodyHeight / stepCount)
  const stepDepth = Math.max(stairConfig?.min_step_depth && stairConfig.min_step_depth > 0 ? stairConfig.min_step_depth : 0.35, length * (stairConfig?.step_depth_ratio && stairConfig.step_depth_ratio > 0 ? stairConfig.step_depth_ratio : 1 / (stepCount + 1)))
  const stepWidthRatio = stairConfig?.step_width_ratio && stairConfig.step_width_ratio > 0 ? stairConfig.step_width_ratio : (stairPreset === 'straight' ? 0.8 : 0.45)
  const stepWidth = Math.max(stairConfig?.min_step_width && stairConfig.min_step_width > 0 ? stairConfig.min_step_width : 0.6, width * stepWidthRatio)
  const turnRatio = stairConfig?.turn_ratio && stairConfig.turn_ratio > 0 ? stairConfig.turn_ratio : 0.18
  const steps: Array<{ x: number; y: number; z: number; l: number; h: number; w: number }> = []
  for (let i = 0; i < stepCount; i += 1) {
    if (stairPreset === 'straight') {
      steps.push({
        x: -length / 2 + stepDepth * (i + 0.6),
        y: -bodyHeight / 2 + stepHeight * (i + 0.5),
        z: 0,
        l: stepDepth,
        h: stepHeight,
        w: stepWidth,
      })
    } else if (stairPreset === 'l_shape') {
      const turnIndex = Math.ceil(stepCount / 2)
      if (i < turnIndex) {
        steps.push({
          x: -length / 2 + stepDepth * (i + 0.6),
          y: -bodyHeight / 2 + stepHeight * (i + 0.5),
          z: -width * turnRatio,
          l: stepDepth,
          h: stepHeight,
          w: stepWidth,
        })
      } else {
        steps.push({
          x: length * 0.08,
          y: -bodyHeight / 2 + stepHeight * (i + 0.5),
          z: -width / 2 + stepDepth * (i - turnIndex + 1.2),
          l: stepWidth,
          h: stepHeight,
          w: stepDepth,
        })
      }
    } else if (stairPreset === 'u_shape') {
      const turnIndex = Math.ceil(stepCount / 2)
      if (i < turnIndex) {
        steps.push({
          x: -length / 2 + stepDepth * (i + 0.6),
          y: -bodyHeight / 2 + stepHeight * (i + 0.5),
          z: -width * turnRatio,
          l: stepDepth,
          h: stepHeight,
          w: stepWidth,
        })
      } else {
        steps.push({
          x: length / 2 - stepDepth * (i - turnIndex + 1.2),
          y: -bodyHeight / 2 + stepHeight * (i + 0.5),
          z: width * turnRatio,
          l: stepDepth,
          h: stepHeight,
          w: stepWidth,
        })
      }
    }
  }
  return steps
}

function FoldSection({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.015))' }}>
      <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '12px 14px', fontSize: 11, letterSpacing: 1.2, color: 'var(--text4)', fontWeight: 700 }}>
        {title}
      </summary>
      <div style={{ padding: '0 14px 14px 14px', display: 'grid', gap: 8 }}>
        {children}
      </div>
    </details>
  )
}

function BlockMesh({ block, selected, onSelect }: { block: Block; selected: boolean; onSelect: () => void }) {
  const g = blockGeom(block)
  const color = getAssemblyComponentVisual(block.component_type).color
  const roofPreset = getRoofPreset(block)
  const { bodyHeight, roofHeight } = getBodyAndRoofHeight(g.height, roofPreset)
  const openingVisuals = getOpeningVisuals(block, undefined, g.length, bodyHeight, g.width)
  const stairPreset = getStairPreset(block)
  const stairVisuals = getStairVisuals(stairPreset, g.length, bodyHeight, g.width)
  const pos: [number, number, number] = [g.x + g.length / 2, g.height / 2 + g.z, g.y + g.width / 2]
  return (
    <group position={pos} onClick={(e) => { e.stopPropagation(); onSelect() }}>
      <mesh castShadow receiveShadow position={[0, (bodyHeight - g.height) / 2, 0]}>
        <boxGeometry args={[g.length, bodyHeight, g.width]} />
        <meshStandardMaterial color={color} transparent opacity={selected ? 0.75 : 0.5} emissive={selected ? new THREE.Color('#ffffff') : new THREE.Color('#000000')} emissiveIntensity={selected ? 0.08 : 0} />
      </mesh>
      {roofPreset === 'terrace' && (
        <mesh castShadow receiveShadow position={[0, g.height / 2 - 0.05, 0]}>
          <boxGeometry args={[g.length, 0.1, g.width]} />
          <meshStandardMaterial color="#cbd5e1" transparent opacity={selected ? 0.82 : 0.62} />
        </mesh>
      )}
      {roofPreset === 'lean_to' && roofHeight > 0 && (
        <mesh castShadow receiveShadow position={[0, bodyHeight / 2, 0]} rotation={[0, 0, -0.18]}>
          <boxGeometry args={[g.length, roofHeight, g.width]} />
          <meshStandardMaterial color="#f59e0b" transparent opacity={selected ? 0.88 : 0.7} />
        </mesh>
      )}
      {roofPreset === 'thai_basic' && roofHeight > 0 && (
        <mesh castShadow receiveShadow position={[0, bodyHeight / 2 + roofHeight / 2, 0]}>
          <coneGeometry args={[Math.max(g.length, g.width) * 0.55, roofHeight, 4]} />
          <meshStandardMaterial color="#dc2626" transparent opacity={selected ? 0.88 : 0.72} />
        </mesh>
      )}
      {openingVisuals.map((opening, idx) => (
        <mesh key={`opening-${idx}`} position={[opening.x, opening.y, opening.z]} rotation={[0, opening.rotateY || 0, 0]}>
          <planeGeometry args={[opening.w, opening.h]} />
          <meshStandardMaterial color={opening.color} transparent opacity={selected ? 0.92 : 0.82} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {stairVisuals.map((step, idx) => (
        <mesh key={`${stairPreset}-${idx}`} position={[step.x, step.y, step.z]}>
          <boxGeometry args={[step.l, step.h, step.w]} />
          <meshStandardMaterial color="#e5e7eb" transparent opacity={selected ? 0.9 : 0.78} />
        </mesh>
      ))}
      <Html position={[0, g.height / 2 + 0.15, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ fontSize: 11, color: '#e2e8f0', background: 'rgba(15,23,42,.75)', padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap' }}>
          {block.block_name || block.component_type}
        </div>
      </Html>
    </group>
  )
}

export default function AssemblyDesigner3DPage() {
  const sp = useSearchParams()
  const router = useRouter()
  const [assemblies, setAssemblies] = useState<Assembly[]>([])
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([])
  const [selectedAssemblyId, setSelectedAssemblyId] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<number | 'all'>('all')
  const [selectedBlockId, setSelectedBlockId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [exportingAiJson, setExportingAiJson] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [utilityMenuOpen, setUtilityMenuOpen] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, Draft3DSemantic>>({})
  const [undoStack, setUndoStack] = useState<DraftDelta[]>([])
  const [redoStack, setRedoStack] = useState<DraftDelta[]>([])
  const [savingBlockId, setSavingBlockId] = useState('')
  const [savingAll, setSavingAll] = useState(false)
  const [mode, setMode] = useState<'translate' | 'scale'>('translate')
  const [showBlockList, setShowBlockList] = useState(true)
  const [stackTargetBlockId, setStackTargetBlockId] = useState('')
  const [showAxisMetrics, setShowAxisMetrics] = useState(true)
  const [viewMode, setViewMode] = useState<DesignerViewMode>('solid')
  const [editorMode, setEditorMode] = useState<EditorMode>('standard')
  const [colorPreset, setColorPreset] = useState<ColorPresetKey>('default')
  const [componentColorOverrides, setComponentColorOverrides] = useState<Record<string, string>>({})
  const [numInputs, setNumInputs] = useState<Record<string, string>>({})
  const [layoutPreset, setLayoutPreset] = useState<LayoutPresetKey>('zero')
  const [layoutMode] = useState<LayoutModeKey>('by_length')
  const [detail, setDetail] = useState<AssemblyDetail | null>(null)
  const [assemblyPage, setAssemblyPage] = useState(1)
  const [assemblyPagination, setAssemblyPagination] = useState<PaginationState>({ page: 1, limit: 20, total: 0, totalPages: 1 })
  const historyMuteRef = useRef(false)
  const transformStartRef = useRef<Record<string, Draft3DSemantic | undefined>>({})
  const glRef = useRef<THREE.WebGLRenderer | null>(null)
  const assemblyDetailCacheRef = useRef<Record<string, AssemblyDetail>>({})
  const assemblyDetailOrderRef = useRef<string[]>([])

  useEffect(() => {
    try {
      const savedMode = window.localStorage.getItem(DESIGNER_3D_VIEW_MODE_KEY)
      if (savedMode === 'solid' || savedMode === 'xray' || savedMode === 'presentation') setViewMode(savedMode)
      const savedPreset = window.localStorage.getItem(DESIGNER_3D_COLOR_PRESET_KEY)
      if (savedPreset === 'default' || savedPreset === 'pastel' || savedPreset === 'contrast' || savedPreset === 'print_friendly') {
        setColorPreset(savedPreset)
      }
      const savedOverrides = window.localStorage.getItem(DESIGNER_3D_COLOR_OVERRIDES_KEY)
      if (savedOverrides) {
        const parsed = JSON.parse(savedOverrides)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          setComponentColorOverrides(parsed as Record<string, string>)
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(DESIGNER_3D_VIEW_MODE_KEY, viewMode)
    } catch {}
  }, [viewMode])

  useEffect(() => {
    try {
      window.localStorage.setItem(DESIGNER_3D_COLOR_PRESET_KEY, colorPreset)
    } catch {}
  }, [colorPreset])

  useEffect(() => {
    try {
      window.localStorage.setItem(DESIGNER_3D_COLOR_OVERRIDES_KEY, JSON.stringify(componentColorOverrides))
    } catch {}
  }, [componentColorOverrides])

  useEffect(() => {
    const preferId = String(sp.get('assembly_id') || '')
    const preferBlock = String(sp.get('block_id') || '')
    if (preferBlock) setSelectedBlockId(preferBlock)
    load(preferId, assemblyPage)
  }, [sp, assemblyPage])

  useEffect(() => {
    if (!selectedAssemblyId) return
    loadAssemblyDetail(selectedAssemblyId)
  }, [selectedAssemblyId])

  async function load(preferId = '', page = 1) {
    setLoading(true)
    setError('')
    try {
      const [res, tRes] = await Promise.all([
        fetch(`/api/assemblies?limit=20&page=${page}&summary_only=true`),
        fetch('/api/settings/estimate/taxonomies?active_only=false'),
      ])
      const json = await res.json().catch(() => ({}))
      const tJson = await tRes.json().catch(() => ({}))
      const rows = Array.isArray(json.data) ? json.data : []
      const pg = json?.pagination || {}
      setTaxonomies(Array.isArray(tJson.data) ? tJson.data : [])
      setAssemblies(rows)
      setAssemblyPagination({
        page: Number(pg.page || page || 1),
        limit: Number(pg.limit || 20),
        total: Number(pg.total || 0),
        totalPages: Number(pg.totalPages || 1),
      })
      const hit = rows.find((x: any) => String(x.id) === preferId)
      if (hit) setSelectedAssemblyId(hit.id)
      else if (rows.length) setSelectedAssemblyId(rows[0].id)
    } catch (e: any) {
      setError(e?.message || 'Khong tai duoc assemblies')
    } finally {
      setLoading(false)
    }
  }

  function rememberAssemblyDetail(row: AssemblyDetail) {
    const id = String(row?.id || '')
    if (!id) return
    assemblyDetailCacheRef.current[id] = row
    assemblyDetailOrderRef.current = [id, ...assemblyDetailOrderRef.current.filter((x) => x !== id)].slice(0, ASSEMBLY_DETAIL_CACHE_LIMIT)
    const keep = new Set(assemblyDetailOrderRef.current)
    for (const key of Object.keys(assemblyDetailCacheRef.current)) {
      if (!keep.has(key)) delete assemblyDetailCacheRef.current[key]
    }
  }

  async function loadAssemblyDetail(id: string, forceRefresh = false) {
    const cached = !forceRefresh ? assemblyDetailCacheRef.current[id] : null
    if (cached) {
      setDetail(cached)
      return
    }
    const res = await fetch(`/api/assemblies/${id}`)
    const json = await res.json().catch(() => ({}))
    const data = json?.data || null
    if (data) rememberAssemblyDetail(data)
    setDetail(data)
  }

  const selectedAssembly = useMemo(
    () => detail && detail.id === selectedAssemblyId ? detail : (assemblies.find((x) => x.id === selectedAssemblyId) || null),
    [assemblies, selectedAssemblyId, detail]
  )
  const openingPresetOptions = useMemo(() => {
    return buildPresetOptions(taxonomies, 'opening_preset', DEFAULT_OPENING_PRESET_OPTIONS)
  }, [taxonomies])
  const roofPresetOptions = useMemo(() => {
    return buildPresetOptions(taxonomies, 'roof_preset', DEFAULT_ROOF_PRESET_OPTIONS)
  }, [taxonomies])
  const stairPresetOptions = useMemo(() => {
    return buildPresetOptions(taxonomies, 'stair_preset', DEFAULT_STAIR_PRESET_OPTIONS)
  }, [taxonomies])
  const interiorPresetOptions = useMemo(() => {
    return buildPresetOptions(taxonomies, 'interior_preset', DEFAULT_INTERIOR_PRESET_OPTIONS)
  }, [taxonomies])
  const presetMetaMap = useMemo(() => {
    const map: Record<string, { name: string; description: string }> = {}
    for (const row of taxonomies) {
      if (!['opening_preset', 'roof_preset', 'stair_preset', 'interior_preset'].includes(row.kind)) continue
      map[`${row.kind}:${row.value}`] = {
        name: row.name || row.value,
        description: row.description ? String(row.description) : '',
      }
    }
    return map
  }, [taxonomies])
  const roofPresetConfigMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof getRoofPresetConfig>> = {}
    for (const row of taxonomies) {
      if (row.kind !== 'roof_preset') continue
      map[String(row.value || '').trim().toLowerCase()] = getRoofPresetConfig(taxonomies, row.value)
    }
    return map
  }, [taxonomies])
  const openingPresetConfigMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof getOpeningPresetConfig>> = {}
    for (const row of taxonomies) {
      if (row.kind !== 'opening_preset') continue
      map[String(row.value || '').trim().toLowerCase()] = getOpeningPresetConfig(taxonomies, row.value)
    }
    return map
  }, [taxonomies])
  const stairPresetConfigMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof getStairPresetConfig>> = {}
    for (const row of taxonomies) {
      if (row.kind !== 'stair_preset') continue
      map[String(row.value || '').trim().toLowerCase()] = getStairPresetConfig(taxonomies, row.value)
    }
    return map
  }, [taxonomies])

  useEffect(() => {
    const next: Record<string, Draft3DSemantic> = {}
    for (const b of selectedAssembly?.blocks || []) {
      const g = blockGeom(b)
      const dims = b.dimensions_json && typeof b.dimensions_json === 'object' ? b.dimensions_json : {}
      next[b.id] = {
        x_m: g.x,
        y_m: g.y,
        z_m: g.z,
        length_m: g.length,
        width_m: g.width,
        height_m: g.height,
        room_type: String((dims as any).room_type || ''),
        space_type: String((dims as any).space_type || ''),
        space_profile: String((dims as any).space_profile || ''),
        facade_role: String((dims as any).facade_role || ''),
        foundation_type: String((dims as any).foundation_type || ''),
        interior_preset: String((dims as any).interior_preset || ''),
        opening_preset: String((dims as any).opening_preset || ''),
        roof_preset: String((dims as any).roof_preset || ''),
        stair_preset: String((dims as any).stair_preset || ''),
        openings: Array.isArray((dims as any).openings)
          ? ((dims as any).openings.map((x: any) => normalizeOpeningDraft(x, g.length, g.height, g.width)).filter(Boolean) as OpeningDraft[])
          : undefined,
        has_ceiling: typeof (dims as any).has_ceiling === 'boolean' ? Boolean((dims as any).has_ceiling) : undefined,
        has_paint: typeof (dims as any).has_paint === 'boolean' ? Boolean((dims as any).has_paint) : undefined,
        has_electrical: typeof (dims as any).has_electrical === 'boolean' ? Boolean((dims as any).has_electrical) : undefined,
        has_plumbing: typeof (dims as any).has_plumbing === 'boolean' ? Boolean((dims as any).has_plumbing) : undefined,
        has_window: typeof (dims as any).has_window === 'boolean' ? Boolean((dims as any).has_window) : undefined,
        has_door: typeof (dims as any).has_door === 'boolean' ? Boolean((dims as any).has_door) : undefined,
      }
    }
    setDrafts(next)
    setUndoStack([])
    setRedoStack([])
  }, [selectedAssemblyId, selectedAssembly])

  const levels = useMemo(() => {
    const s = new Set<number>()
    for (const b of selectedAssembly?.blocks || []) {
      const lv = Number(b.level_index)
      if (Number.isFinite(lv)) s.add(Math.trunc(lv))
    }
    return Array.from(s).sort((a, b) => a - b)
  }, [selectedAssembly])

  const blocks = useMemo(() => {
    const src = (selectedAssembly?.blocks || []).filter((x) => x)
    if (selectedLevel === 'all') return src
    return src.filter((x) => Number(x.level_index) === selectedLevel)
  }, [selectedAssembly, selectedLevel])

  const placedBlocks = useMemo(() => {
    const out: PlacedBlock[] = []
    let cursorX = 0
    let cursorY = 0
    let rowMaxW = 0
    const rowLimit = 35

    for (const b of blocks) {
      const g = blockGeom(b)
      const d = drafts[b.id] || {}
      const length = d.length_m ?? g.length
      const width = d.width_m ?? g.width
      const height = d.height_m ?? g.height
      const hasManualXY = d.x_m != null || d.y_m != null || g.x !== 0 || g.y !== 0

      let x = d.x_m ?? g.x
      let y = d.y_m ?? g.y
      if (!hasManualXY) {
        if (cursorX + length > rowLimit) {
          cursorX = 0
          cursorY += rowMaxW + 1
          rowMaxW = 0
        }
        x = cursorX
        y = cursorY
        cursorX += length + 1
        rowMaxW = Math.max(rowMaxW, width)
      }

      out.push({
        block: b,
        x,
        y,
        z: d.z_m ?? g.z,
        length,
        width,
        height,
      })
    }
    return out
  }, [blocks, drafts])

  const selectedBlock = useMemo(() => blocks.find((x) => x.id === selectedBlockId) || null, [blocks, selectedBlockId])
  const selectedPlaced = useMemo(() => placedBlocks.find((x) => x.block.id === selectedBlockId) || null, [placedBlocks, selectedBlockId])
  const selectedBlockSemanticHints = useMemo(() => {
    if (!selectedBlock) return [] as SemanticHint[]
    const dims = selectedBlock.dimensions_json && typeof selectedBlock.dimensions_json === 'object' ? selectedBlock.dimensions_json : {}
    const draft = drafts[selectedBlock.id] || {}
    return buildSemanticHints({
      componentType: selectedBlock.component_type,
      spaceType: draft.space_type ?? (dims as any).space_type ?? draft.room_type ?? (dims as any).room_type,
      spaceProfile: draft.space_profile ?? (dims as any).space_profile,
      facadeRole: draft.facade_role ?? (dims as any).facade_role,
      foundationType: draft.foundation_type ?? (dims as any).foundation_type,
      openingPreset: draft.opening_preset ?? (dims as any).opening_preset,
      roofPreset: draft.roof_preset ?? (dims as any).roof_preset,
      stairPreset: draft.stair_preset ?? (dims as any).stair_preset,
    })
  }, [drafts, selectedBlock])
  const stackTargetPlaced = useMemo(
    () => placedBlocks.find((x) => x.block.id === stackTargetBlockId) || null,
    [placedBlocks, stackTargetBlockId]
  )
  const overlappedPlaced = useMemo(() => {
    if (!selectedPlaced) return [] as Array<{ item: PlacedBlock; volM3: number }>
    return placedBlocks
      .filter((pb) => pb.block.id !== selectedPlaced.block.id)
      .map((pb) => ({ item: pb, volM3: intersectVolume(selectedPlaced, pb) }))
      .filter((x) => x.volM3 > 0)
      .sort((a, b) => b.volM3 - a.volM3)
  }, [placedBlocks, selectedPlaced])
  const overlappedIds = useMemo(() => new Set(overlappedPlaced.map((x) => x.item.block.id)), [overlappedPlaced])
  const axisMax = useMemo(() => {
    let xMax = 0
    let yMax = 0
    let zMax = 0
    for (const pb of placedBlocks) {
      xMax = Math.max(xMax, pb.x + pb.length)
      yMax = Math.max(yMax, pb.y + pb.height)
      zMax = Math.max(zMax, pb.z + pb.width)
    }
    return {
      xMax: Number(xMax.toFixed(2)),
      yMax: Number(yMax.toFixed(2)),
      zMax: Number(zMax.toFixed(2)),
    }
  }, [placedBlocks])
  const viewModeLabel = viewMode === 'solid' ? 'Solid' : viewMode === 'xray' ? 'X-ray' : 'Presentation'
  function getComponentDisplayColor(componentType?: string | null) {
    const key = String(componentType || '').trim().toLowerCase()
    const presetColors = COLOR_PRESETS[colorPreset] || {}
    return componentColorOverrides[key] || presetColors[key] || getAssemblyComponentVisual(componentType).color
  }
  function updateComponentColor(componentType: string, color: string) {
    const key = String(componentType || '').trim().toLowerCase()
    setComponentColorOverrides((prev) => ({ ...prev, [key]: color }))
  }
  function resetComponentColor(componentType: string) {
    const key = String(componentType || '').trim().toLowerCase()
    setComponentColorOverrides((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, key)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }
  function applyColorPreset(nextPreset: ColorPresetKey) {
    setColorPreset(nextPreset)
    setComponentColorOverrides({})
  }
  function resetDisplaySettings() {
    setViewMode('solid')
    setColorPreset('default')
    setComponentColorOverrides({})
    try {
      window.localStorage.removeItem(DESIGNER_3D_VIEW_MODE_KEY)
      window.localStorage.removeItem(DESIGNER_3D_COLOR_PRESET_KEY)
      window.localStorage.removeItem(DESIGNER_3D_COLOR_OVERRIDES_KEY)
    } catch {}
  }

  function clampCoord(v: number) {
    return Math.max(-MAX_COORD, Math.min(MAX_COORD, v))
  }
  function clampSize(v: number, componentType?: string | null) {
    return Math.max(minSizeByComponentType(componentType), Math.min(MAX_SIZE, v))
  }
  function numKey(blockId: string, field: string) {
    return `${blockId}:${field}`
  }
  function readNumInput(blockId: string, field: string, fallback: number) {
    const k = numKey(blockId, field)
    if (Object.prototype.hasOwnProperty.call(numInputs, k)) return numInputs[k]
    return String(fallback)
  }
  function writeNumInput(blockId: string, field: string, raw: string, onValid: (n: number) => void) {
    const k = numKey(blockId, field)
    setNumInputs((p) => ({ ...p, [k]: raw }))
    if (!/^-?\d*(\.\d*)?$/.test(raw)) return
    if (raw === '' || raw === '-' || raw === '.' || raw === '-.') return
    const v = Number(raw)
    if (Number.isFinite(v)) onValid(v)
  }
  function commitNumInput(blockId: string, field: string) {
    const k = numKey(blockId, field)
    setNumInputs((p) => {
      const next = { ...p }
      delete next[k]
      return next
    })
  }
  function cloneDraft(src: Draft3DSemantic | undefined) {
    if (!src) return undefined
    return JSON.parse(JSON.stringify(src)) as Draft3DSemantic
  }
  function makeDelta(prev: Record<string, Draft3DSemantic>, next: Record<string, Draft3DSemantic>): DraftDelta | null {
    const ids = new Set<string>([...Object.keys(prev || {}), ...Object.keys(next || {})])
    const changes: DraftDeltaChange[] = []
    for (const id of ids) {
      const b = prev[id]
      const a = next[id]
      if (JSON.stringify(b ?? null) === JSON.stringify(a ?? null)) continue
      changes.push({ blockId: id, before: cloneDraft(b), after: cloneDraft(a) })
    }
    if (!changes.length) return null
    return { changes }
  }
  function pushUndoDelta(delta: DraftDelta) {
    setUndoStack((prev) => {
      const next = [...prev, delta]
      if (next.length > 50) next.shift()
      return next
    })
    setRedoStack([])
  }
  function applyDelta(delta: DraftDelta, mode: 'undo' | 'redo') {
    const pick = mode === 'undo' ? 'before' : 'after'
    historyMuteRef.current = true
    setDrafts((prev) => {
      const next: Record<string, Draft3DSemantic> = { ...prev }
      for (const c of delta.changes) {
        const v = c[pick]
        if (!v) delete next[c.blockId]
        else next[c.blockId] = cloneDraft(v) || {}
      }
      return next
    })
    historyMuteRef.current = false
  }
  function undoLastDraftChange() {
    setUndoStack((prev) => {
      if (!prev.length) return prev
      const next = [...prev]
      const last = next.pop()!
      applyDelta(last, 'undo')
      setRedoStack((r) => [...r, last])
      return next
    })
  }
  function redoLastDraftChange() {
    setRedoStack((prev) => {
      if (!prev.length) return prev
      const next = [...prev]
      const last = next.pop()!
      applyDelta(last, 'redo')
      setUndoStack((u) => {
        const nu = [...u, last]
        if (nu.length > 50) nu.shift()
        return nu
      })
      return next
    })
  }
  function updateDraft(blockId: string, patch: Partial<Draft3DSemantic>, options?: { history?: boolean }) {
    const withHistory = options?.history !== false
    const nextPatch: any = { ...patch }
    if (nextPatch.x_m != null) nextPatch.x_m = Number(snap01(clampCoord(nextPatch.x_m)).toFixed(2))
    if (nextPatch.y_m != null) nextPatch.y_m = Number(snap01(clampCoord(nextPatch.y_m)).toFixed(2))
    if (nextPatch.z_m != null) nextPatch.z_m = Number(snap01(clampCoord(nextPatch.z_m)).toFixed(2))
    const hit = (selectedAssembly?.blocks || []).find((b) => b.id === blockId)
    const t = hit?.component_type
    if (nextPatch.length_m != null) nextPatch.length_m = Number(snap01(clampSize(nextPatch.length_m, t)).toFixed(2))
    if (nextPatch.width_m != null) nextPatch.width_m = Number(snap01(clampSize(nextPatch.width_m, t)).toFixed(2))
    if (nextPatch.height_m != null) nextPatch.height_m = Number(snap01(clampSize(nextPatch.height_m, t)).toFixed(2))
    setDrafts((prev) => {
      const merged = { ...(prev[blockId] || {}), ...nextPatch }
      const next = { ...prev, [blockId]: sanitizeDraftByComponentType(String(t || ''), merged) }
      if (withHistory && !historyMuteRef.current) {
        const d = makeDelta(prev, next)
        if (d) pushUndoDelta(d)
      }
      return next
    })
  }
  function addOpening(blockId: string, type: OpeningDraft['type']) {
    const hit = selectedAssembly?.blocks?.find((b) => b.id === blockId)
    const g = hit ? blockGeom(hit) : { length: 6, width: 4, height: 3.6 }
    const current = getCustomOpenings(hit as Block, drafts[blockId], g.length, g.height, g.width)
    const nextOpening = normalizeOpeningDraft({ type, face: 'front', offset: 0, width: type === 'door' ? 1.2 : 1.6, height: type === 'door' ? 2.1 : 1.2, sill: type === 'door' ? 0 : 0.9 }, g.length, g.height, g.width)
    updateDraft(blockId, { openings: nextOpening ? [...current, nextOpening] : current })
  }
  function updateOpening(blockId: string, index: number, patch: Partial<OpeningDraft>) {
    const hit = selectedAssembly?.blocks?.find((b) => b.id === blockId)
    if (!hit) return
    const g = blockGeom(hit)
    const current = getCustomOpenings(hit, drafts[blockId], g.length, g.height, g.width)
    const next = current.map((opening, i) => i === index ? (normalizeOpeningDraft({ ...opening, ...patch }, g.length, g.height, g.width) || opening) : opening)
    updateDraft(blockId, { openings: next })
  }
  function removeOpening(blockId: string, index: number) {
    const hit = selectedAssembly?.blocks?.find((b) => b.id === blockId)
    if (!hit) return
    const g = blockGeom(hit)
    const current = getCustomOpenings(hit, drafts[blockId], g.length, g.height, g.width)
    updateDraft(blockId, { openings: current.filter((_, i) => i !== index) })
  }
  function setDraftsWithHistory(next: Record<string, Draft3DSemantic>) {
    setDrafts((prev) => {
      if (!historyMuteRef.current) {
        const d = makeDelta(prev, next)
        if (d) pushUndoDelta(d)
      }
      return next
    })
  }
  function stackSelectedBlockOnTop3D() {
    if (!selectedBlock || !stackTargetPlaced) return
    if (isBlockLocked(selectedBlock)) return
    updateDraft(selectedBlock.id, {
      x_m: Number(stackTargetPlaced.x.toFixed(2)),
      z_m: Number(stackTargetPlaced.z.toFixed(2)),
      y_m: Number((stackTargetPlaced.y + stackTargetPlaced.height).toFixed(2)),
    })
  }
  function runAutoLayout3D() {
    if (!selectedAssembly?.blocks?.length) return
    const { gapX, gapY } = LAYOUT_PRESETS[layoutPreset]
    const byLevel = new Map<number, Block[]>()
    for (const b of selectedAssembly.blocks || []) {
      const lv = Number.isFinite(Number(b.level_index)) ? Math.trunc(Number(b.level_index)) : 0
      if (!byLevel.has(lv)) byLevel.set(lv, [])
      byLevel.get(lv)!.push(b)
    }
    const levelsSorted = Array.from(byLevel.keys()).sort((a, b) => a - b)
    const next = { ...drafts }
    const rowLimitM = 40
    let baseY = 0
    for (const lv of levelsSorted) {
      const list = (byLevel.get(lv) || []).filter((b) => !isBlockLocked(b)).sort((a: any, b: any) => {
        const la = Number.isFinite(Number(a?.length_order)) ? Number(a.length_order) : 0
        const lb = Number.isFinite(Number(b?.length_order)) ? Number(b.length_order) : 0
        const ha = Number.isFinite(Number(a?.height_order)) ? Number(a.height_order) : 0
        const hb = Number.isFinite(Number(b?.height_order)) ? Number(b.height_order) : 0
        const sa = Number.isFinite(Number(a?.sort_order)) ? Number(a.sort_order) : 0
        const sb = Number.isFinite(Number(b?.sort_order)) ? Number(b.sort_order) : 0
        if (layoutMode === 'by_length') {
          if (ha !== hb) return ha - hb
          if (la !== lb) return la - lb
        } else {
          if (ha !== hb) return ha - hb
        }
        if (sa !== sb) return sa - sb
        return String(a.component_type || '').localeCompare(String(b.component_type || ''))
      })
      // Keep each level anchored near its existing position, avoid collapsing to (0,0).
      let levelAnchorX = 0
      let levelAnchorZ = 0
      if (list.length > 0) {
        let minX = Number.POSITIVE_INFINITY
        let minZ = Number.POSITIVE_INFINITY
        for (const b of list) {
          const g = blockGeom(b)
          const d = next[b.id] || {}
          const x0 = Number.isFinite(Number(d.x_m)) ? Number(d.x_m) : g.x
          const z0 = Number.isFinite(Number(d.z_m)) ? Number(d.z_m) : g.z
          minX = Math.min(minX, x0)
          minZ = Math.min(minZ, z0)
        }
        if (Number.isFinite(minX)) levelAnchorX = minX
        if (Number.isFinite(minZ)) levelAnchorZ = minZ
      }
      let levelMaxH = 0
      let localYOffset = 0
      if (layoutMode === 'by_length') {
        // Layer by height_order, then place length_order groups left->right.
        // All blocks in same (height_order, length_order) share same x/y/z (overlap).
        const byHeight = new Map<number, Block[]>()
        for (const b of list) {
          const hOrder = Number.isFinite(Number((b as any)?.height_order)) ? Number((b as any).height_order) : 0
          if (!byHeight.has(hOrder)) byHeight.set(hOrder, [])
          byHeight.get(hOrder)!.push(b)
        }
        const heightKeys = Array.from(byHeight.keys()).sort((a, b) => a - b)
        for (const hKey of heightKeys) {
          const layer = byHeight.get(hKey) || []
          const byLength = new Map<number, Block[]>()
          for (const b of layer) {
            const lOrder = Number.isFinite(Number((b as any)?.length_order)) ? Number((b as any).length_order) : 0
            if (!byLength.has(lOrder)) byLength.set(lOrder, [])
            byLength.get(lOrder)!.push(b)
          }
          const lengthKeys = Array.from(byLength.keys()).sort((a, b) => a - b)
          let cursorX = levelAnchorX
          let layerMaxH = 0
          for (const lKey of lengthKeys) {
            const group = byLength.get(lKey) || []
            let groupMaxL = 0
            let groupMaxH = 0
            for (const b of group) {
              const g = blockGeom(b)
              const d = next[b.id] || {}
              const length = d.length_m ?? g.length
              const width = d.width_m ?? g.width
              const height = d.height_m ?? g.height
              groupMaxL = Math.max(groupMaxL, length)
              groupMaxH = Math.max(groupMaxH, height)
              next[b.id] = {
                ...(next[b.id] || {}),
                x_m: Number(cursorX.toFixed(2)),
                y_m: Number((baseY + localYOffset).toFixed(2)),
                z_m: Number(levelAnchorZ.toFixed(2)),
                length_m: Number(length.toFixed(2)),
                width_m: Number(width.toFixed(2)),
                height_m: Number(height.toFixed(2)),
              }
              levelMaxH = Math.max(levelMaxH, height)
            }
            // Next length_order starts after the longest block of previous order.
            cursorX += groupMaxL + gapX
            layerMaxH = Math.max(layerMaxH, groupMaxH)
          }
          localYOffset += layerMaxH + gapY
        }
      } else {
        let cursorX = levelAnchorX
        let cursorZ = levelAnchorZ
        let rowMaxW = 0
        for (const b of list) {
          const g = blockGeom(b)
          const d = next[b.id] || {}
          const length = d.length_m ?? g.length
          const width = d.width_m ?? g.width
          const height = d.height_m ?? g.height
          if (cursorX + length > rowLimitM) {
            cursorX = levelAnchorX
            cursorZ += rowMaxW + gapY
            rowMaxW = 0
          }
          next[b.id] = {
            ...(next[b.id] || {}),
            x_m: Number(cursorX.toFixed(2)),
            y_m: Number((baseY + localYOffset).toFixed(2)),
            z_m: Number(cursorZ.toFixed(2)),
            length_m: Number(length.toFixed(2)),
            width_m: Number(width.toFixed(2)),
            height_m: Number(height.toFixed(2)),
          }
          cursorX += length + gapX
          rowMaxW = Math.max(rowMaxW, width)
          levelMaxH = Math.max(levelMaxH, height)
        }
      }
      baseY += levelMaxH + gapY
    }
    setDraftsWithHistory(next)
  }

  async function saveSelectedBlock3D() {
    if (!selectedBlock) return
    const d = drafts[selectedBlock.id] || {}
    setSavingBlockId(selectedBlock.id)
    try {
      const oldDims = selectedBlock.dimensions_json && typeof selectedBlock.dimensions_json === 'object' ? selectedBlock.dimensions_json : {}
      const minType = selectedBlock.component_type
      const nextDims = {
        ...oldDims,
        x_m: clampCoord(d.x_m ?? blockGeom(selectedBlock).x),
        y_m: clampCoord(d.y_m ?? blockGeom(selectedBlock).y),
        z_m: clampCoord(d.z_m ?? blockGeom(selectedBlock).z),
        length_m: clampSize(d.length_m ?? blockGeom(selectedBlock).length, minType),
        width_m: clampSize(d.width_m ?? blockGeom(selectedBlock).width, minType),
        height_m: clampSize(d.height_m ?? blockGeom(selectedBlock).height, minType),
        room_type: d.room_type != null ? d.room_type : (oldDims as any).room_type,
        space_type: d.space_type != null ? d.space_type : (oldDims as any).space_type,
        space_profile: d.space_profile != null ? d.space_profile : (oldDims as any).space_profile,
        facade_role: d.facade_role != null ? d.facade_role : (oldDims as any).facade_role,
        foundation_type: d.foundation_type != null ? d.foundation_type : (oldDims as any).foundation_type,
        interior_preset: d.interior_preset != null ? d.interior_preset : (oldDims as any).interior_preset,
        opening_preset: d.opening_preset != null ? d.opening_preset : (oldDims as any).opening_preset,
        roof_preset: d.roof_preset != null ? d.roof_preset : (oldDims as any).roof_preset,
        stair_preset: d.stair_preset != null ? d.stair_preset : (oldDims as any).stair_preset,
        openings: Array.isArray(d.openings)
          ? d.openings.map((x) => normalizeOpeningDraft(x, d.length_m ?? blockGeom(selectedBlock).length, d.height_m ?? blockGeom(selectedBlock).height, d.width_m ?? blockGeom(selectedBlock).width)).filter(Boolean)
          : Array.isArray((oldDims as any).openings)
            ? (oldDims as any).openings
            : [],
        has_ceiling: d.has_ceiling != null ? Boolean(d.has_ceiling) : Boolean((oldDims as any).has_ceiling),
        has_paint: d.has_paint != null ? Boolean(d.has_paint) : Boolean((oldDims as any).has_paint),
        has_electrical: d.has_electrical != null ? Boolean(d.has_electrical) : Boolean((oldDims as any).has_electrical),
        has_plumbing: d.has_plumbing != null ? Boolean(d.has_plumbing) : Boolean((oldDims as any).has_plumbing),
        has_window: d.has_window != null ? Boolean(d.has_window) : Boolean((oldDims as any).has_window),
        has_door: d.has_door != null ? Boolean(d.has_door) : Boolean((oldDims as any).has_door),
      }
      await fetch(`/api/assemblies/blocks/${selectedBlock.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dimensions_json: nextDims }),
      })
      await loadAssemblyDetail(selectedAssemblyId, true)
      await load(selectedAssemblyId, assemblyPage)
    } finally {
      setSavingBlockId('')
    }
  }

  async function saveAllBlocks3D() {
    if (!selectedAssembly) return
    setSavingAll(true)
    try {
      for (const b of selectedAssembly.blocks || []) {
        const d = drafts[b.id] || {}
        const g = blockGeom(b)
        const oldDims = b.dimensions_json && typeof b.dimensions_json === 'object' ? b.dimensions_json : {}
        const minType = b.component_type
        const nextDims = {
          ...oldDims,
          x_m: clampCoord(d.x_m ?? g.x),
          y_m: clampCoord(d.y_m ?? g.y),
          z_m: clampCoord(d.z_m ?? g.z),
          length_m: clampSize(d.length_m ?? g.length, minType),
          width_m: clampSize(d.width_m ?? g.width, minType),
          height_m: clampSize(d.height_m ?? g.height, minType),
          room_type: d.room_type != null ? d.room_type : (oldDims as any).room_type,
          space_type: d.space_type != null ? d.space_type : (oldDims as any).space_type,
          space_profile: d.space_profile != null ? d.space_profile : (oldDims as any).space_profile,
          facade_role: d.facade_role != null ? d.facade_role : (oldDims as any).facade_role,
          foundation_type: d.foundation_type != null ? d.foundation_type : (oldDims as any).foundation_type,
          interior_preset: d.interior_preset != null ? d.interior_preset : (oldDims as any).interior_preset,
          opening_preset: d.opening_preset != null ? d.opening_preset : (oldDims as any).opening_preset,
          roof_preset: d.roof_preset != null ? d.roof_preset : (oldDims as any).roof_preset,
          stair_preset: d.stair_preset != null ? d.stair_preset : (oldDims as any).stair_preset,
          openings: Array.isArray(d.openings)
            ? d.openings.map((x) => normalizeOpeningDraft(x, d.length_m ?? g.length, d.height_m ?? g.height, d.width_m ?? g.width)).filter(Boolean)
            : Array.isArray((oldDims as any).openings)
              ? (oldDims as any).openings
              : [],
          has_ceiling: d.has_ceiling != null ? Boolean(d.has_ceiling) : Boolean((oldDims as any).has_ceiling),
          has_paint: d.has_paint != null ? Boolean(d.has_paint) : Boolean((oldDims as any).has_paint),
          has_electrical: d.has_electrical != null ? Boolean(d.has_electrical) : Boolean((oldDims as any).has_electrical),
          has_plumbing: d.has_plumbing != null ? Boolean(d.has_plumbing) : Boolean((oldDims as any).has_plumbing),
          has_window: d.has_window != null ? Boolean(d.has_window) : Boolean((oldDims as any).has_window),
          has_door: d.has_door != null ? Boolean(d.has_door) : Boolean((oldDims as any).has_door),
        }
        await fetch(`/api/assemblies/blocks/${b.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dimensions_json: nextDims }),
        })
      }
      await loadAssemblyDetail(selectedAssemblyId, true)
      await load(selectedAssemblyId, assemblyPage)
    } finally {
      setSavingAll(false)
    }
  }

  async function previewEstimateFrom3D() {
    if (!selectedAssemblyId) return
    setPreviewing(true)
    try {
      const res = await fetch(`/api/assemblies/${selectedAssemblyId}/estimate-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.data) return
      let preview3dImage: string | null = null
      try {
        const renderer = glRef.current
        if (renderer?.domElement?.toDataURL) {
          preview3dImage = renderer.domElement.toDataURL('image/png')
        }
      } catch {}

      const ctx = {
        preview_result: json.data,
        input_payload: json.inferred_input || {},
        assembly: {
          id: selectedAssembly?.id || selectedAssemblyId,
          name: selectedAssembly?.name || '',
          customer_id: (selectedAssembly as any)?.customer_id || null,
          customer_name: null,
          house_type: (selectedAssembly as any)?.house_type || null,
          style: (selectedAssembly as any)?.style || null,
          level: (selectedAssembly as any)?.level || null,
          region_code: (selectedAssembly as any)?.region_code || 'ALL',
        },
        blocks: selectedAssembly?.blocks || [],
        assembly_summary: json.assembly_summary || null,
        preview_images: {
          model_3d: preview3dImage,
        },
        created_at: new Date().toISOString(),
      }
      if (typeof window !== 'undefined') {
        const rawPrev = window.sessionStorage.getItem(STORAGE_KEY)
        const prev = rawPrev ? JSON.parse(rawPrev) : null
        const merged = {
          ...(prev && typeof prev === 'object' ? prev : {}),
          ...ctx,
          preview_images: {
            ...((prev && typeof prev === 'object' && (prev as any).preview_images) ? (prev as any).preview_images : {}),
            ...(ctx.preview_images || {}),
          },
        }
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
      }
      router.push('/estimates/assemblies/result-v2')
    } finally {
      setPreviewing(false)
    }
  }

  async function exportAi3DData() {
    if (!selectedAssemblyId) return
    setExportingAiJson(true)
    try {
      const res = await fetch(`/api/assemblies/${selectedAssemblyId}/design-3d-export`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.data) return
      const fileName = `assembly-3d-ai-${selectedAssemblyId}.json`
      const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      window.URL.revokeObjectURL(url)
    } finally {
      setExportingAiJson(false)
    }
  }

  async function fetchAiExportPayload() {
    if (!selectedAssemblyId) return null
    const res = await fetch(`/api/assemblies/${selectedAssemblyId}/design-3d-export`)
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json?.data) return null
    return json.data
  }

  function downloadTextFile(filename: string, text: string, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([text], { type: mime })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

  async function copyAiBrief() {
    const payload = await fetchAiExportPayload()
    const brief = String(payload?.ai_drawing_brief || '')
    if (!brief) return
    await navigator.clipboard.writeText(brief)
  }

  function buildObjMassingText() {
    const group = new THREE.Group()
    for (const pb of placedBlocks) {
      const roofPreset = getRoofPreset(pb.block, drafts[pb.block.id])
      const { bodyHeight, roofHeight } = getBodyAndRoofHeight(pb.height, roofPreset)
      const openingVisuals = getOpeningVisuals(pb.block, drafts[pb.block.id], pb.length, bodyHeight, pb.width)
      const stairPreset = getStairPreset(pb.block, drafts[pb.block.id])
      const stairVisuals = getStairVisuals(stairPreset, pb.length, bodyHeight, pb.width)
      const material = new THREE.MeshBasicMaterial({ color: '#ffffff' })
      const body = new THREE.Mesh(new THREE.BoxGeometry(pb.length, bodyHeight, pb.width), material)
      body.position.set(pb.x + pb.length / 2, pb.y + bodyHeight / 2, pb.z + pb.width / 2)
      body.name = String(pb.block.block_name || pb.block.component_type || pb.block.id)
      group.add(body)
      if (roofPreset === 'terrace') {
        const roof = new THREE.Mesh(new THREE.BoxGeometry(pb.length, 0.1, pb.width), material)
        roof.position.set(pb.x + pb.length / 2, pb.y + pb.height - 0.05, pb.z + pb.width / 2)
        roof.name = `${body.name}_terrace`
        group.add(roof)
      } else if (roofPreset === 'lean_to' && roofHeight > 0) {
        const roof = new THREE.Mesh(new THREE.BoxGeometry(pb.length, roofHeight, pb.width), material)
        roof.position.set(pb.x + pb.length / 2, pb.y + bodyHeight + roofHeight / 2, pb.z + pb.width / 2)
        roof.rotation.z = -0.18
        roof.name = `${body.name}_lean_to`
        group.add(roof)
      } else if (roofPreset === 'thai_basic' && roofHeight > 0) {
        const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(pb.length, pb.width) * 0.55, roofHeight, 4), material)
        roof.position.set(pb.x + pb.length / 2, pb.y + bodyHeight + roofHeight / 2, pb.z + pb.width / 2)
        roof.rotation.y = Math.PI / 4
        roof.name = `${body.name}_thai`
        group.add(roof)
      }
      for (const [idx, opening] of openingVisuals.entries()) {
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(opening.w, opening.h), material)
        panel.position.set(pb.x + pb.length / 2 + opening.x, pb.y + bodyHeight / 2 + opening.y, pb.z + pb.width / 2 + opening.z)
        panel.rotation.y = opening.rotateY || 0
        panel.name = `${body.name}_opening_${idx + 1}`
        group.add(panel)
      }
      for (const [idx, step] of stairVisuals.entries()) {
        const stair = new THREE.Mesh(new THREE.BoxGeometry(step.l, step.h, step.w), material)
        stair.position.set(pb.x + pb.length / 2 + step.x, pb.y + bodyHeight / 2 + step.y, pb.z + pb.width / 2 + step.z)
        stair.name = `${body.name}_stair_${idx + 1}`
        group.add(stair)
      }
    }
    const exporter = new OBJExporter()
    return exporter.parse(group)
  }

  async function exportObjAndJson() {
    if (!selectedAssemblyId) return
    setExportingAiJson(true)
    try {
      const payload = await fetchAiExportPayload()
      if (!payload) return
      const objText = buildObjMassingText()
      downloadTextFile(`assembly-3d-massing-${selectedAssemblyId}.obj`, objText, 'text/plain;charset=utf-8')
      downloadTextFile(`assembly-3d-ai-${selectedAssemblyId}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8')
    } finally {
      setExportingAiJson(false)
      setExportMenuOpen(false)
    }
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
          ASSEMBLY DESIGNER 3D
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Boc tach 3D (viewer)</h1>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <FoldSection title="ĐIỀU KHIỂN 3D">
  <div className="toolbar3d">
    {/* Nhóm 1: Chọn assembly + phân trang */}
    <div className="toolbar3d__group">
      <select className="select" value={selectedAssemblyId} onChange={(e) => setSelectedAssemblyId(e.target.value)}>
        {assemblies.map((a) => (
          <option key={a.id} value={a.id}>{a.name} ({a.id.slice(0, 8)})</option>
        ))}
      </select>
      <div className="toolbar3d__pager">
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          disabled={assemblyPagination.page <= 1}
          onClick={() => setAssemblyPage((p) => Math.max(1, p - 1))}
        >
          ‹
        </button>
        <span className="toolbar3d__pager-label">
          {assemblyPagination.page}/{assemblyPagination.totalPages} · {assemblyPagination.total} assembly
        </span>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          disabled={assemblyPagination.page >= assemblyPagination.totalPages}
          onClick={() => setAssemblyPage((p) => Math.min(assemblyPagination.totalPages, p + 1))}
        >
          ›
        </button>
      </div>
    </div>

    <div className="toolbar3d__divider" />

    {/* Nhóm 2: Bộ lọc / preset */}
    <div className="toolbar3d__group">
      <select className="select" value={String(selectedLevel)} onChange={(e) => setSelectedLevel(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
        <option value="all">Tất cả tầng</option>
        {levels.map((lv) => <option key={lv} value={lv}>Tầng {lv}</option>)}
      </select>
      <select className="select" value={layoutPreset} onChange={(e) => setLayoutPreset(e.target.value as LayoutPresetKey)}>
        <option value="zero">Preset: Zero (0m)</option>
        <option value="compact">Preset: Compact</option>
        <option value="standard">Preset: Standard</option>
        <option value="spacious">Preset: Spacious</option>
      </select>
      <select className="select" value={editorMode} onChange={(e) => setEditorMode(e.target.value as EditorMode)}>
        <option value="quick">Mode: Nhanh</option>
        <option value="standard">Mode: Chuẩn</option>
        <option value="advanced">Mode: Nâng cao</option>
      </select>
    </div>

    <div className="toolbar3d__divider" />

    {/* Nhóm 3: Chỉnh sửa (chỉ hiện khi không phải quick mode) */}
    {editorMode !== 'quick' && (
      <div className="toolbar3d__group">
        <button className="btn-primary" onClick={runAutoLayout3D}>Auto-layout</button>
        <button
          className="btn btn-ghost"
          onClick={undoLastDraftChange}
          disabled={undoStack.length === 0}
        >
          ↶ Undo
        </button>
        <button
          className="btn btn-ghost"
          onClick={redoLastDraftChange}
          disabled={redoStack.length === 0}
        >
          ↷ Redo
        </button>
        <button className="btn-primary" onClick={() => setMode((m) => (m === 'translate' ? 'scale' : 'translate'))}>
          Mode: {mode === 'translate' ? 'Move' : 'Scale'}
        </button>
        {editorMode === 'advanced' && (
          <button
            className="btn-primary"
            onClick={saveSelectedBlock3D}
            disabled={!selectedBlock || savingBlockId === selectedBlock?.id}
          >
            {savingBlockId === selectedBlock?.id ? 'Đang lưu…' : 'Lưu block 3D'}
          </button>
        )}
      </div>
    )}

    {editorMode === 'quick' && (
      <div className="toolbar3d__group">
        <button className="btn-primary" onClick={runAutoLayout3D}>Auto-layout</button>
      </div>
    )}

    <div className="toolbar3d__divider" />

    {/* Nhóm 4: Lưu + hiển thị */}
    <div className="toolbar3d__group">
      <button className="btn-primary" onClick={saveAllBlocks3D} disabled={savingAll}>
        {savingAll ? 'Đang lưu tất cả…' : 'Lưu tất cả'}
      </button>
      {editorMode !== 'quick' && (
        <button
          className={`btn ${showAxisMetrics ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setShowAxisMetrics((p) => !p)}
        >
          Số liệu trục: {showAxisMetrics ? 'Bật' : 'Tắt'}
        </button>
      )}
      <button className="btn-primary" onClick={() => setViewMode((p) => (p === 'solid' ? 'xray' : p === 'xray' ? 'presentation' : 'solid'))}>
        View: {viewModeLabel}
      </button>
    </div>

    <div className="toolbar3d__spacer" />

    {/* Nhóm 5: Menu tiện ích + xuất dữ liệu */}
    <div className="toolbar3d__group">
      <div className="toolbar3d__menu">
        <button className="btn btn-ghost" onClick={() => setUtilityMenuOpen((p) => !p)}>
          Tiện ích ▾
        </button>
        {utilityMenuOpen && (
          <div className="toolbar3d__dropdown">
            <button
              className="toolbar3d__dropdown-item"
              onClick={() => {
                router.push(`/estimates/assemblies/designer-2d?assembly_id=${selectedAssemblyId}${selectedBlockId ? `&block_id=${selectedBlockId}` : ''}`)
                setUtilityMenuOpen(false)
              }}
            >
              Mở Designer 2D
            </button>
            <button
              className="toolbar3d__dropdown-item"
              onClick={() => { void previewEstimateFrom3D(); setUtilityMenuOpen(false) }}
              disabled={previewing}
            >
              {previewing ? 'Đang preview…' : 'Preview Estimate'}
            </button>
            <button
              className="toolbar3d__dropdown-item"
              onClick={() => { router.push('/estimates/assemblies'); setUtilityMenuOpen(false) }}
            >
              Về Assemblies
            </button>
          </div>
        )}
      </div>

      <div className="toolbar3d__menu">
        <button className="btn-primary" onClick={() => setExportMenuOpen((p) => !p)} disabled={exportingAiJson}>
          {exportingAiJson ? 'Đang xuất…' : 'Xuất dữ liệu ▾'}
        </button>
        {exportMenuOpen && (
          <div className="toolbar3d__dropdown toolbar3d__dropdown--right">
            <button className="toolbar3d__dropdown-item" onClick={() => { void exportAi3DData(); setExportMenuOpen(false) }}>
              Xuất JSON AI
            </button>
            <button className="toolbar3d__dropdown-item" onClick={() => { void copyAiBrief(); setExportMenuOpen(false) }}>
              Copy brief AI
            </button>
            <button className="toolbar3d__dropdown-item" onClick={() => void exportObjAndJson()}>
              Xuất OBJ + JSON
            </button>
          </div>
        )}
      </div>
    </div>
  </div>

  {/* Thông tin phụ */}
  <div className="toolbar3d__meta">
    <span>Số block hiển thị: {blocks.length}</span>
    <span className="toolbar3d__meta-sep">·</span>
    <span>Orbit: chuột trái xoay, chuột phải pan, scroll zoom</span>
    <span className="toolbar3d__meta-sep">·</span>
    <span>Trục: X=dài, Y=cao (map từ y_m của 2D), Z=rộng/sâu</span>
    <span className="toolbar3d__meta-sep">·</span>
    <span>Giới hạn tọa độ ±{MAX_COORD}m</span>
  </div>

  {showAxisMetrics && (
    <div className="toolbar3d__meta">
      <span>Max trục: X={axisMax.xMax}m · Y={axisMax.yMax}m · Z={axisMax.zMax}m</span>
    </div>
  )}

  <div className="toolbar3d__meta">
    <span>Chế độ xem: {viewModeLabel}</span>
    <span className="toolbar3d__meta-sep">·</span>
    <span>Solid = rõ khối, X-ray = nhìn xuyên để canh chồng lấp, Presentation = giảm nhiễu, dễ demo</span>
  </div>

  <div className="toolbar3d__meta">
    Xuất JSON AI sẽ gồm metadata assembly, thông tin khách hàng (nếu có), cấu trúc theo tầng, danh sách block, vị trí/kích thước theo mét và một brief ngắn để gợi AI về concept kiến trúc sơ bộ.
  </div>
</FoldSection>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden', minHeight: 560 }}>
          {loading ? (
            <div style={{ padding: 30, fontSize: 12, color: 'var(--text3)' }}>Dang tai...</div>
          ) : error ? (
            <div style={{ padding: 30, fontSize: 12, color: 'var(--red)' }}>{error}</div>
          ) : !selectedAssembly ? (
            <div style={{ padding: 30, fontSize: 12, color: 'var(--text3)' }}>Chua co assembly.</div>
          ) : (
            <Canvas
              shadows
              camera={{ position: [20, 16, 20], fov: 45 }}
              gl={{ preserveDrawingBuffer: true }}
              onCreated={({ gl }) => { glRef.current = gl }}
              onPointerMissed={() => setSelectedBlockId('')}
            >
              <Suspense fallback={null}>
                <color attach="background" args={[viewMode === 'presentation' ? '#0a0f1c' : viewMode === 'xray' ? '#0d1526' : '#0b1220']} />
                <ambientLight intensity={viewMode === 'presentation' ? 0.9 : viewMode === 'xray' ? 0.74 : 0.82} />
                <directionalLight position={[20, 25, 10]} intensity={viewMode === 'presentation' ? 1.18 : 1.05} castShadow />
                <directionalLight position={[-14, 10, -12]} intensity={viewMode === 'presentation' ? 0.42 : 0.35} />
                <Grid args={[120, 120]} cellSize={1} cellThickness={viewMode === 'presentation' ? 0.18 : 0.28} sectionSize={5} sectionThickness={viewMode === 'presentation' ? 0.42 : 0.6} cellColor={viewMode === 'presentation' ? '#182234' : '#22304a'} sectionColor={viewMode === 'presentation' ? '#253246' : '#334155'} fadeDistance={180} fadeStrength={1} position={[0, 0, 0]} />
                <axesHelper args={[12]} />
                <Html position={[12.4, 0, 0]} center style={{ pointerEvents: 'none' }}>
                  <div style={{ fontSize: 11, color: '#fca5a5', fontWeight: 700 }}>X</div>
                </Html>
                <Html position={[0, 12.4, 0]} center style={{ pointerEvents: 'none' }}>
                  <div style={{ fontSize: 11, color: '#86efac', fontWeight: 700 }}>Y</div>
                </Html>
                <Html position={[0, 0, 12.4]} center style={{ pointerEvents: 'none' }}>
                  <div style={{ fontSize: 11, color: '#93c5fd', fontWeight: 700 }}>Z</div>
                </Html>
                {showAxisMetrics && (
                  <>
                    <Html position={[axisMax.xMax + 0.4, 0, 0]} center style={{ pointerEvents: 'none' }}>
                      <div style={{ fontSize: 11, color: '#fca5a5', background: 'rgba(15,23,42,.75)', padding: '2px 6px', borderRadius: 6 }}>
                        Xmax {axisMax.xMax}m
                      </div>
                    </Html>
                    <Html position={[0, axisMax.yMax + 0.4, 0]} center style={{ pointerEvents: 'none' }}>
                      <div style={{ fontSize: 11, color: '#86efac', background: 'rgba(15,23,42,.75)', padding: '2px 6px', borderRadius: 6 }}>
                        Ymax {axisMax.yMax}m
                      </div>
                    </Html>
                    <Html position={[0, 0, axisMax.zMax + 0.4]} center style={{ pointerEvents: 'none' }}>
                      <div style={{ fontSize: 11, color: '#93c5fd', background: 'rgba(15,23,42,.75)', padding: '2px 6px', borderRadius: 6 }}>
                        Zmax {axisMax.zMax}m
                      </div>
                    </Html>
                  </>
                )}
                {placedBlocks.map((pb) => {
                  const { block: b, x, y, z, length, width, height } = pb
                  const roofPreset = getRoofPreset(b, drafts[b.id])
                  const roofPresetConfig = roofPresetConfigMap[String(roofPreset || '').trim().toLowerCase()]
                  const { bodyHeight, roofHeight } = getBodyAndRoofHeight(height, roofPreset, roofPresetConfig)
                  const openingPreset = getOpeningPreset(b, drafts[b.id])
                  const openingPresetConfig = openingPresetConfigMap[String(openingPreset || '').trim().toLowerCase()]
                  const openingVisuals = getOpeningVisuals(b, drafts[b.id], length, bodyHeight, width, openingPresetConfig)
                  const stairPreset = getStairPreset(b, drafts[b.id])
                  const stairPresetConfig = stairPresetConfigMap[String(stairPreset || '').trim().toLowerCase()]
                  const stairVisuals = getStairVisuals(stairPreset, length, bodyHeight, width, stairPresetConfig)
                  const color = getComponentDisplayColor(b.component_type)
                  const selected = b.id === selectedBlockId
                  const overlapHit = overlappedIds.has(b.id)
                  const locked = isBlockLocked(b)
                  const pos: [number, number, number] = [x + length / 2, y + height / 2, z + width / 2]
                  const bodyOpacity = selected ? (viewMode === 'xray' ? 0.48 : 0.92) : overlapHit ? (viewMode === 'xray' ? 0.4 : 0.82) : viewMode === 'xray' ? 0.24 : viewMode === 'presentation' ? 0.82 : 0.68
                  const roofOpacity = selected ? (viewMode === 'xray' ? 0.58 : 0.94) : viewMode === 'xray' ? 0.3 : viewMode === 'presentation' ? 0.8 : 0.68
                  const openingOpacity = selected ? 0.96 : viewMode === 'xray' ? 0.72 : 0.84
                  const showLabel = viewMode === 'presentation' ? selected : (selected || overlapHit)
                  return (
                    <group key={b.id}>
                      <mesh
                        position={[x + length / 2, y + bodyHeight / 2, z + width / 2]}
                        castShadow
                        receiveShadow
                        onClick={(e) => { e.stopPropagation(); setSelectedBlockId(b.id) }}
                      >
                        <boxGeometry args={[length, bodyHeight, width]} />
                        <meshStandardMaterial
                          color={overlapHit ? '#fbbf24' : color}
                          transparent
                          opacity={bodyOpacity}
                          emissive={selected ? new THREE.Color(color) : overlapHit ? new THREE.Color('#f59e0b') : new THREE.Color('#000000')}
                          emissiveIntensity={selected ? (viewMode === 'presentation' ? 0.26 : 0.2) : overlapHit ? 0.12 : 0}
                          roughness={viewMode === 'presentation' ? 0.58 : 0.72}
                          metalness={0.04}
                        />
                      </mesh>
                      <lineSegments position={[x + length / 2, y + bodyHeight / 2, z + width / 2]}>
                        <edgesGeometry args={[new THREE.BoxGeometry(length, bodyHeight, width)]} />
                        <lineBasicMaterial color={selected ? '#f8fafc' : overlapHit ? '#f59e0b' : viewMode === 'presentation' ? '#162033' : '#0f172a'} transparent opacity={selected ? 0.95 : viewMode === 'xray' ? 0.3 : 0.55} />
                      </lineSegments>
                      {roofPreset === 'terrace' && (
                        <mesh
                          position={[x + length / 2, y + height - 0.05, z + width / 2]}
                          castShadow
                          receiveShadow
                          onClick={(e) => { e.stopPropagation(); setSelectedBlockId(b.id) }}
                        >
                          <boxGeometry args={[length, 0.1, width]} />
                          <meshStandardMaterial color="#cbd5e1" transparent opacity={roofOpacity} />
                        </mesh>
                      )}
                      {roofPreset === 'lean_to' && roofHeight > 0 && (
                        <mesh
                          position={[x + length / 2, y + bodyHeight + roofHeight / 2, z + width / 2]}
                          rotation={[0, 0, -0.18]}
                          castShadow
                          receiveShadow
                          onClick={(e) => { e.stopPropagation(); setSelectedBlockId(b.id) }}
                        >
                          <boxGeometry args={[length, roofHeight, width]} />
                          <meshStandardMaterial color={roofPresetConfig?.roof_color || '#f59e0b'} transparent opacity={roofOpacity} />
                        </mesh>
                      )}
                      {roofPreset === 'thai_basic' && roofHeight > 0 && (
                        <mesh
                          position={[x + length / 2, y + bodyHeight + roofHeight / 2, z + width / 2]}
                          rotation={[0, Math.PI / 4, 0]}
                          castShadow
                          receiveShadow
                          onClick={(e) => { e.stopPropagation(); setSelectedBlockId(b.id) }}
                        >
                          <coneGeometry args={[Math.max(length, width) * 0.55, roofHeight, 4]} />
                          <meshStandardMaterial color={roofPresetConfig?.roof_color || '#dc2626'} transparent opacity={roofOpacity} />
                        </mesh>
                      )}
                      {openingVisuals.map((opening, idx) => (
                        <mesh
                          key={`${b.id}-opening-${idx}`}
                          position={[x + length / 2 + opening.x, y + bodyHeight / 2 + opening.y, z + width / 2 + opening.z]}
                          rotation={[0, opening.rotateY || 0, 0]}
                          onClick={(e) => { e.stopPropagation(); setSelectedBlockId(b.id) }}
                        >
                          <planeGeometry args={[opening.w, opening.h]} />
                          <meshStandardMaterial color={opening.color} transparent opacity={openingOpacity} side={THREE.DoubleSide} />
                        </mesh>
                      ))}
                      {stairVisuals.map((step, idx) => (
                        <mesh
                          key={`${b.id}-stair-${idx}`}
                          position={[x + length / 2 + step.x, y + bodyHeight / 2 + step.y, z + width / 2 + step.z]}
                          onClick={(e) => { e.stopPropagation(); setSelectedBlockId(b.id) }}
                        >
                          <boxGeometry args={[step.l, step.h, step.w]} />
                          <meshStandardMaterial color="#e5e7eb" transparent opacity={selected ? 0.94 : viewMode === 'xray' ? 0.55 : 0.8} />
                        </mesh>
                      ))}
                      {selected && !locked && (
                        <TransformControls
                          mode={mode}
                          position={pos}
                          onMouseDown={() => {
                            transformStartRef.current[b.id] = cloneDraft(drafts[b.id])
                          }}
                          onObjectChange={(ev: any) => {
                            const obj = ev?.target?.object as THREE.Object3D | undefined
                            if (!obj) return
                            if (mode === 'translate') {
                              const nx = obj.position.x - length / 2
                              const ny = obj.position.y - height / 2
                              const nz = obj.position.z - width / 2
                              updateDraft(b.id, { x_m: Number(nx.toFixed(2)), y_m: Number(ny.toFixed(2)), z_m: Number(nz.toFixed(2)) }, { history: false })
                            } else if (mode === 'scale') {
                              const sx = Math.max(0.2, obj.scale.x)
                              const sy = Math.max(0.2, obj.scale.y)
                              const sz = Math.max(0.2, obj.scale.z)
                              updateDraft(b.id, {
                                length_m: Number((length * sx).toFixed(2)),
                                height_m: Number((height * sy).toFixed(2)),
                                width_m: Number((width * sz).toFixed(2)),
                              }, { history: false })
                              obj.scale.set(1, 1, 1)
                            }
                          }}
                          onMouseUp={() => {
                            const before = transformStartRef.current[b.id]
                            delete transformStartRef.current[b.id]
                            const after = drafts[b.id]
                            if (JSON.stringify(before ?? null) === JSON.stringify(after ?? null)) return
                            pushUndoDelta({
                              changes: [{ blockId: b.id, before: cloneDraft(before), after: cloneDraft(after) }],
                            })
                          }}
                        />
                      )}
                      {showLabel && (
                        <Html position={[pos[0], pos[1] + height / 2 + 0.15, pos[2]]} center style={{ pointerEvents: 'none' }}>
                          <div style={{ fontSize: 11, color: '#e2e8f0', background: selected ? 'rgba(15,23,42,.92)' : 'rgba(120,53,15,.9)', border: selected ? '1px solid rgba(248,250,252,.45)' : '1px solid rgba(245,158,11,.45)', padding: '3px 7px', borderRadius: 7, whiteSpace: 'nowrap', boxShadow: selected ? '0 8px 24px rgba(15,23,42,.32)' : '0 8px 24px rgba(120,53,15,.24)' }}>
                            {(b.block_name || b.component_type)}{locked ? ' [LOCK]' : ''}
                          </div>
                        </Html>
                      )}
                    </group>
                  )
                })}
                <OrbitControls makeDefault />
              </Suspense>
            </Canvas>
          )}
        </div>

        <div className="card" style={{ padding: 12 }}>
          <FoldSection title="HIEN THI MO HINH">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <button className="btn btn-ghost" onClick={() => setViewMode('solid')} style={{ borderRadius: 10, padding: '8px 10px', border: viewMode === 'solid' ? '1px solid rgba(59,130,246,.55)' : '1px solid var(--border2)', background: viewMode === 'solid' ? 'rgba(59,130,246,.12)' : 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer' }}>
                Solid
              </button>
              <button className="btn btn-ghost" onClick={() => setViewMode('xray')} style={{ borderRadius: 10, padding: '8px 10px', border: viewMode === 'xray' ? '1px solid rgba(59,130,246,.55)' : '1px solid var(--border2)', background: viewMode === 'xray' ? 'rgba(59,130,246,.12)' : 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer' }}>
                X-ray
              </button>
              <button className="btn btn-ghost" onClick={() => setViewMode('presentation')} style={{ borderRadius: 10, padding: '8px 10px', border: viewMode === 'presentation' ? '1px solid rgba(59,130,246,.55)' : '1px solid var(--border2)', background: viewMode === 'presentation' ? 'rgba(59,130,246,.12)' : 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer' }}>
                Presentation
              </button>
            </div>
            <button className="btn btn-ghost" onClick={resetDisplaySettings} style={{ borderRadius: 10, padding: '8px 10px', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer' }}>
              Khoi phuc hien thi mac dinh
            </button>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Preset mau</label>
              <select className="select" value={colorPreset} onChange={(e) => applyColorPreset(e.target.value as ColorPresetKey)}>
                {COLOR_PRESET_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              Doi mau o day chi anh huong cach xem trong trang 3D, khong sua du lieu block.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              {Object.entries(ASSEMBLY_COMPONENT_VISUALS).map(([k, v]) => (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', background: 'rgba(255,255,255,.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)' }}>
                    <span style={{ width: 12, height: 12, background: getComponentDisplayColor(k), borderRadius: 3, display: 'inline-block', border: '1px solid rgba(255,255,255,.15)' }} />
                    <span>{k}</span>
                  </div>
                  <input type="color" value={getComponentDisplayColor(k)} onChange={(e) => updateComponentColor(k, e.target.value)} style={{ width: 42, height: 30, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer' }} />
                  <button className="btn btn-ghost" onClick={() => resetComponentColor(k)} style={{ borderRadius: 8, padding: '6px 8px', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text3)', cursor: 'pointer' }}>
                    Reset
                  </button>
                </div>
              ))}
            </div>
          </FoldSection>
          <FoldSection title="BLOCK DETAILS">
          <button
            className="btn btn-ghost"
            onClick={() => setShowBlockList((p) => !p)}
            style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', marginBottom: 8 }}
          >
            {showBlockList ? 'An list block' : 'Hien list block'}
          </button>
          {showBlockList && (
            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 10 }}>
              {blocks.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBlockId(b.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    background: b.id === selectedBlockId ? 'rgba(59,130,246,.15)' : 'transparent',
                    color: 'var(--text)',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  {(b.block_name || b.component_type)}{isBlockLocked(b) ? ' [LOCK]' : ''} | lvl {b.level_index}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
            {Object.entries(ASSEMBLY_COMPONENT_VISUALS).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)' }}>
                <span style={{ width: 10, height: 10, background: v.color, borderRadius: 2, display: 'inline-block' }} />
                {k}
              </div>
            ))}
          </div>
          {!selectedBlock ? (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Click vao block trong khung 3D de xem thong tin.</div>
          ) : (
            <div style={{ display: 'grid', gap: 6, fontSize: 12 }}>
              {(() => {
                const currentDims = selectedBlock.dimensions_json && typeof selectedBlock.dimensions_json === 'object' ? selectedBlock.dimensions_json : {}
                const fieldFlags = getComponentFieldFlags(selectedBlock.component_type)
                const currentSpaceType = String(drafts[selectedBlock.id]?.space_type ?? (currentDims as any).space_type ?? '')
                const currentSpaceProfile = String(drafts[selectedBlock.id]?.space_profile ?? (currentDims as any).space_profile ?? '')
                const currentRoomType = String(drafts[selectedBlock.id]?.room_type ?? (currentDims as any).room_type ?? '')
                const currentFoundationType = String(drafts[selectedBlock.id]?.foundation_type ?? (currentDims as any).foundation_type ?? '')
                const currentInteriorPreset = String(drafts[selectedBlock.id]?.interior_preset ?? (currentDims as any).interior_preset ?? '')
                const currentOpeningPreset = String(drafts[selectedBlock.id]?.opening_preset ?? (currentDims as any).opening_preset ?? '')
                const currentRoofPreset = String(drafts[selectedBlock.id]?.roof_preset ?? (currentDims as any).roof_preset ?? '')
                const currentStairPreset = String(drafts[selectedBlock.id]?.stair_preset ?? (currentDims as any).stair_preset ?? '')
                return (
                  <>
              <div><strong>{selectedBlock.block_name || selectedBlock.component_type}</strong></div>
              <div style={{ color: 'var(--text3)' }}>Type: {selectedBlock.component_type}</div>
              <div style={{ color: 'var(--text3)' }}>Tang: {selectedBlock.level_index}</div>
              <div style={{ color: 'var(--text3)' }}>
                Kich thuoc block: D={Number((drafts[selectedBlock.id]?.length_m ?? blockGeom(selectedBlock).length).toFixed(2))}m |
                C={Number((drafts[selectedBlock.id]?.height_m ?? blockGeom(selectedBlock).height).toFixed(2))}m |
                R={Number((drafts[selectedBlock.id]?.width_m ?? blockGeom(selectedBlock).width).toFixed(2))}m
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Block dang giao/che voi block nay</div>
              {overlappedPlaced.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text4)' }}>Khong co block nao dang giao nhau.</div>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {overlappedPlaced.map((row) => (
                    <button
                      key={row.item.block.id}
                      onClick={() => setSelectedBlockId(row.item.block.id)}
                      style={{
                        textAlign: 'left',
                        background: 'rgba(251,191,36,.12)',
                        border: '1px solid rgba(251,191,36,.35)',
                        color: 'var(--text2)',
                        borderRadius: 8,
                        padding: '6px 8px',
                        cursor: 'pointer',
                        fontSize: 11,
                      }}
                    >
                      {row.item.block.block_name || row.item.block.component_type} | giao {Number(row.volM3.toFixed(2))} m3
                    </button>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Helper dat de len block khac</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
                <select
                  className="select"
                  value={stackTargetBlockId}
                  onChange={(e) => setStackTargetBlockId(e.target.value)}
                >
                  <option value="">(chon block dich)</option>
                  {placedBlocks
                    .filter((pb) => pb.block.id !== selectedBlock.id)
                    .map((pb) => (
                      <option key={pb.block.id} value={pb.block.id}>
                        {pb.block.block_name || pb.block.component_type}
                      </option>
                    ))}
                </select>
                <button className="btn-primary" onClick={stackSelectedBlockOnTop3D} disabled={!stackTargetPlaced || isBlockLocked(selectedBlock)}>
                  Dat de len
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                <input
                  className="input"
                  placeholder="x_m"
                  value={readNumInput(selectedBlock.id, 'x_m', drafts[selectedBlock.id]?.x_m ?? blockGeom(selectedBlock).x)}
                  onChange={(e) => {
                    writeNumInput(selectedBlock.id, 'x_m', e.target.value, (v) => updateDraft(selectedBlock.id, { x_m: v }))
                  }}
                  onBlur={() => commitNumInput(selectedBlock.id, 'x_m')}
                />
                <input
                  className="input"
                  placeholder="y_m"
                  value={readNumInput(selectedBlock.id, 'y_m', drafts[selectedBlock.id]?.y_m ?? blockGeom(selectedBlock).y)}
                  onChange={(e) => {
                    writeNumInput(selectedBlock.id, 'y_m', e.target.value, (v) => updateDraft(selectedBlock.id, { y_m: v }))
                  }}
                  onBlur={() => commitNumInput(selectedBlock.id, 'y_m')}
                />
                <input
                  className="input"
                  placeholder="z_m"
                  value={readNumInput(selectedBlock.id, 'z_m', drafts[selectedBlock.id]?.z_m ?? blockGeom(selectedBlock).z)}
                  onChange={(e) => {
                    writeNumInput(selectedBlock.id, 'z_m', e.target.value, (v) => updateDraft(selectedBlock.id, { z_m: v }))
                  }}
                  onBlur={() => commitNumInput(selectedBlock.id, 'z_m')}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                <input
                  className="input"
                  placeholder="length_m"
                  value={readNumInput(selectedBlock.id, 'length_m', drafts[selectedBlock.id]?.length_m ?? blockGeom(selectedBlock).length)}
                  onChange={(e) => {
                    writeNumInput(selectedBlock.id, 'length_m', e.target.value, (v) => updateDraft(selectedBlock.id, { length_m: v }))
                  }}
                  onBlur={() => commitNumInput(selectedBlock.id, 'length_m')}
                />
                <input
                  className="input"
                  placeholder="width_m"
                  value={readNumInput(selectedBlock.id, 'width_m', drafts[selectedBlock.id]?.width_m ?? blockGeom(selectedBlock).width)}
                  onChange={(e) => {
                    writeNumInput(selectedBlock.id, 'width_m', e.target.value, (v) => updateDraft(selectedBlock.id, { width_m: v }))
                  }}
                  onBlur={() => commitNumInput(selectedBlock.id, 'width_m')}
                />
                <input
                  className="input"
                  placeholder="height_m"
                  value={readNumInput(selectedBlock.id, 'height_m', drafts[selectedBlock.id]?.height_m ?? blockGeom(selectedBlock).height)}
                  onChange={(e) => {
                    writeNumInput(selectedBlock.id, 'height_m', e.target.value, (v) => updateDraft(selectedBlock.id, { height_m: v }))
                  }}
                  onBlur={() => commitNumInput(selectedBlock.id, 'height_m')}
                />
              </div>
              {fieldFlags.isRoom ? <>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>Khong gian chinh<span title="Cho biet block nay dang phuc vu khong gian nao nhu phong khach, phong ngu, bep, WC. Day la semantic chinh de goi y template va boc tach." style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 999, border: '1px solid var(--border)', color: 'var(--text4)', cursor: 'help', fontSize: 11, lineHeight: 1 }}>?</span></label>
              <select
                className="select"
                value={currentSpaceType}
                onChange={(e) => updateDraft(selectedBlock.id, { space_type: e.target.value })}
              >
                <option value="">(Khong gian chinh)</option>
                {SPACE_TYPE_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
              </select>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>Muc khong gian<span title="Cho biet muc do hoan thien hay tinh chat su dung cua khong gian, vi du co ban, tiet kiem, cao cap, phu tro." style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 999, border: '1px solid var(--border)', color: 'var(--text4)', cursor: 'help', fontSize: 11, lineHeight: 1 }}>?</span></label>
              <select
                className="select"
                value={currentSpaceProfile}
                onChange={(e) => updateDraft(selectedBlock.id, { space_profile: e.target.value })}
              >
                <option value="">(Muc khong gian)</option>
                {SPACE_PROFILE_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
              </select>
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Loai phong / pham vi cu</label>
              <input
                className="input"
                value={currentRoomType}
                onChange={(e) => updateDraft(selectedBlock.id, { room_type: e.target.value })}
                placeholder="room_type"
              />
              </> : null}
              {fieldFlags.supportsFacade ? <>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>Vai tro mat tien<span title="Danh dau block nao la mat ngoai can boc facade. Mat tien chinh se duoc uu tien dung cho template facade." style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 999, border: '1px solid var(--border)', color: 'var(--text4)', cursor: 'help', fontSize: 11, lineHeight: 1 }}>?</span></label>
              <select
                className="select"
                value={String(drafts[selectedBlock.id]?.facade_role ?? String((currentDims as any).facade_role || ''))}
                onChange={(e) => updateDraft(selectedBlock.id, { facade_role: e.target.value })}
              >
                <option value="">(Vai tro mat tien)</option>
                {FACADE_ROLE_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
              </select>
              </> : null}
              {fieldFlags.isFoundation ? <>
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Loai mong</label>
              <input
                className="input"
                value={currentFoundationType}
                onChange={(e) => updateDraft(selectedBlock.id, { foundation_type: e.target.value })}
                placeholder="foundation_type"
              />
              </> : null}
              {(fieldFlags.isRoom || fieldFlags.allowsOpenings || fieldFlags.isRoof || fieldFlags.isStair) ? (
                <div style={{ gridColumn: '1 / -1', border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: 'rgba(59,130,246,.06)', display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>Preset block</div>
                  <div style={{ fontSize: 11, color: 'var(--text4)' }}>
                    Chon preset nhanh cho block dang chon. Trang 3D uu tien chinh sua va xem khoi, con tao block moi chi tiet van nen lam ben Designer 2D.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
                    {fieldFlags.isRoom ? <>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text3)' }}>Interior preset</label>
                      <select
                        className="select"
                        value={currentInteriorPreset}
                        onChange={(e) => updateDraft(selectedBlock.id, { interior_preset: e.target.value })}
                      >
                        <option value="">(Khong chon)</option>
                        {interiorPresetOptions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                      </select>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text4)', display: 'flex', alignItems: 'end' }}>
                      {currentInteriorPreset ? (presetMetaMap[`interior_preset:${currentInteriorPreset}`]?.description || 'Preset noi that dang duoc ap dung cho block nay.') : 'Chua chon preset noi that.'}
                    </div>
                    </> : null}
                    {fieldFlags.allowsOpenings ? <>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>Preset o mo<span title="Mau o mo mac dinh cho block. Neu chua khai bao danh sach cua, cua so chi tiet thi he thong se dung preset nay de preview va boc tach so bo." style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 999, border: '1px solid var(--border)', color: 'var(--text4)', cursor: 'help', fontSize: 11, lineHeight: 1 }}>?</span></label>
                      <select
                        className="select"
                        value={currentOpeningPreset}
                        onChange={(e) => updateDraft(selectedBlock.id, { opening_preset: e.target.value })}
                      >
                        <option value="">(Khong chon)</option>
                        {openingPresetOptions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                      </select>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text4)', display: 'flex', alignItems: 'end' }}>
                      {currentOpeningPreset ? (presetMetaMap[`opening_preset:${currentOpeningPreset}`]?.description || 'Preset o mo se duoc dung khi block khong co openings[] chi tiet.') : 'Chua chon preset o mo.'}
                    </div>
                    </> : null}
                    {fieldFlags.isRoof ? <>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text3)' }}>Preset mai</label>
                      <select
                        className="select"
                        value={currentRoofPreset}
                        onChange={(e) => updateDraft(selectedBlock.id, { roof_preset: e.target.value })}
                      >
                        <option value="">(Khong chon)</option>
                        {roofPresetOptions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                      </select>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text4)', display: 'flex', alignItems: 'end' }}>
                      {currentRoofPreset ? (presetMetaMap[`roof_preset:${currentRoofPreset}`]?.description || 'Preset mai dang duoc ap dung cho khoi nay.') : 'Chua chon preset mai.'}
                    </div>
                    </> : null}
                    {fieldFlags.isStair ? <>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text3)' }}>Preset cau thang</label>
                      <select
                        className="select"
                        value={currentStairPreset}
                        onChange={(e) => updateDraft(selectedBlock.id, { stair_preset: e.target.value })}
                      >
                        <option value="">(Khong chon)</option>
                        {stairPresetOptions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                      </select>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text4)', display: 'flex', alignItems: 'end' }}>
                      {currentStairPreset ? (presetMetaMap[`stair_preset:${currentStairPreset}`]?.description || 'Preset cau thang dang duoc ap dung cho khoi nay.') : 'Chua chon preset cau thang.'}
                    </div>
                    </> : null}
                  </div>
                </div>
              ) : null}
              {fieldFlags.isRoom ? <div style={{ fontSize: 11, color: 'var(--text3)' }}>Preset nhanh theo khong gian</div> : null}
              {fieldFlags.isRoom ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    const preset = buildSemanticPreset(currentSpaceType)
                    updateDraft(selectedBlock.id, preset)
                  }}
                  disabled={!currentSpaceType}
                  style={{ borderRadius: 8, padding: '6px 10px', cursor: !currentSpaceType ? 'not-allowed' : 'pointer' }}
                >
                  Ap preset hien tai
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    updateDraft(selectedBlock.id, { space_type: 'bedroom', ...buildSemanticPreset('bedroom') })
                  }}
                  style={{ borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
                >
                  Phòng ngủ
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    updateDraft(selectedBlock.id, { space_type: 'kitchen', ...buildSemanticPreset('kitchen') })
                  }}
                  style={{ borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
                >
                  Bếp
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    updateDraft(selectedBlock.id, { space_type: 'wc', ...buildSemanticPreset('wc') })
                  }}
                  style={{ borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
                >
                  WC
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    updateDraft(selectedBlock.id, {
                      has_ceiling: false,
                      has_paint: false,
                      has_electrical: false,
                      has_plumbing: false,
                      has_window: false,
                      has_door: false,
                      interior_preset: '',
                      opening_preset: '',
                      roof_preset: '',
                      stair_preset: '',
                    })
                  }}
                  style={{ borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
                >
                  Xoa preset
                </button>
              </div> : null}
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: 'rgba(148,163,184,.06)' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Goi y template semantic</div>
                {selectedBlockSemanticHints.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chua du semantic de goi y template.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {selectedBlockSemanticHints.map((hint) => (
                      <div key={hint.title} style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{hint.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{hint.reasons.join(' | ')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {fieldFlags.allowsOpenings ? <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: 'rgba(59,130,246,.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>O mo chi tiet (nhieu cua / cua so)</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost" onClick={() => addOpening(selectedBlock.id, 'door')} style={{ borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                      + Cua
                    </button>
                    <button className="btn btn-ghost" onClick={() => addOpening(selectedBlock.id, 'window')} style={{ borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                      + Cua so
                    </button>
                    <button className="btn btn-ghost" onClick={() => addOpening(selectedBlock.id, 'vent')} style={{ borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                      + O thong gio
                    </button>
                  </div>
                </div>
                {(() => {
                  const openingRows = getCustomOpenings(selectedBlock, drafts[selectedBlock.id], blockGeom(selectedBlock).length, blockGeom(selectedBlock).height, blockGeom(selectedBlock).width)
                  if (!openingRows.length) {
                    return <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chua co o mo chi tiet. Neu de trong, he thong se fallback ve preset o mo cu.</div>
                  }
                  return (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {openingRows.map((opening, idx) => (
                        <div key={`${opening.type}-${idx}`} style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                          <select className="select" value={opening.type} onChange={(e) => updateOpening(selectedBlock.id, idx, { type: e.target.value as OpeningDraft['type'] })}>
                            <option value="door">Cua di</option>
                            <option value="window">Cua so</option>
                            <option value="vent">O thong gio</option>
                          </select>
                          <select className="select" value={opening.face} onChange={(e) => updateOpening(selectedBlock.id, idx, { face: e.target.value as OpeningDraft['face'] })}>
                            <option value="front">Mat truoc</option>
                            <option value="back">Mat sau</option>
                            <option value="left">Mat trai</option>
                            <option value="right">Mat phai</option>
                          </select>
                          <button className="btn btn-ghost" onClick={() => removeOpening(selectedBlock.id, idx)} style={{ borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--red)' }}>
                            Xoa
                          </button>
                          <input className="input" placeholder="offset (m)" value={String(opening.offset)} onChange={(e) => updateOpening(selectedBlock.id, idx, { offset: Number(e.target.value || 0) })} />
                          <input className="input" placeholder="width (m)" value={String(opening.width)} onChange={(e) => updateOpening(selectedBlock.id, idx, { width: Number(e.target.value || 0) })} />
                          <input className="input" placeholder="height (m)" value={String(opening.height)} onChange={(e) => updateOpening(selectedBlock.id, idx, { height: Number(e.target.value || 0) })} />
                          <input className="input" placeholder="sill (m)" value={String(opening.sill)} onChange={(e) => updateOpening(selectedBlock.id, idx, { sill: Number(e.target.value || 0) })} />
                          <div style={{ gridColumn: 'span 2', fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>
                            Offset am / duong de dich trai-phai tren mat dang chon.
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div> : null}
              {fieldFlags.allowedFeatureKeys.size > 0 ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
                {BLOCK_FEATURE_OPTIONS.filter((feature) => fieldFlags.allowedFeatureKeys.has(feature.key)).map((feature) => {
                  const checked = Boolean(drafts[selectedBlock.id]?.[feature.key] ?? (currentDims as any)[feature.key])
                  return (
                    <label key={feature.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => updateDraft(selectedBlock.id, { [feature.key]: e.target.checked } as Partial<Draft3DSemantic>)}
                      />
                      <span>{feature.label}</span>
                    </label>
                  )
                })}
              </div> : null}
              <pre style={{ marginTop: 6, whiteSpace: 'pre-wrap', fontSize: 11, color: 'var(--text3)' }}>{JSON.stringify(selectedBlock.dimensions_json || {}, null, 2)}</pre>
                  </>
                )
              })()}
            </div>
          )}
          </FoldSection>
        </div>
      </div>
    </div>
  )
}
