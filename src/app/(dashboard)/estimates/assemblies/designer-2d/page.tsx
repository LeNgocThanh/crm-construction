'use client'

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import 'konva/lib/shapes/Rect'
import 'konva/lib/shapes/Text'
import 'konva/lib/shapes/Circle'
import 'konva/lib/shapes/Line'
import { Circle, Layer, Line, Rect, Stage, Text } from 'react-konva/lib/ReactKonvaCore'
import { getAssemblyComponentVisual } from '@/lib/estimate/block-visuals'
import { buildPresetOptions, getOpeningPresetConfig } from '@/lib/estimate/preset-taxonomies'

type AssemblyRow = {
  id: string
  name: string
  customer_id?: string | null
  house_type?: string | null
  style?: string | null
  level?: string | null
  region_code?: string | null
  status?: string | null
  blocks?: Block[]
  _count?: { blocks?: number }
}

type AssemblyDetail = {
  id: string
  name: string
  customer_id?: string | null
  house_type?: string | null
  style?: string | null
  level?: string | null
  region_code?: string | null
  customer?: { full_name?: string | null } | null
  blocks?: Block[]
}

type Block = {
  id: string
  component_type: string
  template_id?: string | null
  sort_order?: number
  length_order?: number
  height_order?: number
  block_name?: string | null
  level_index: number
  dimensions_json?: Record<string, unknown> | null
  template?: {
    template_name?: string | null
  } | null
}

type OpeningDraft = {
  type: 'door' | 'window' | 'vent'
  face: 'front' | 'back' | 'left' | 'right'
  offset: number
  width: number
  height: number
  sill: number
}

type BlockDraft = {
  x_m?: number
  y_m?: number
  length_m?: number
  height_m?: number
  wall_area_m2?: number
  wall_length_m?: number
  block_name?: string
  component_type?: string
  level_index?: number
  template_id?: string
  sort_order?: number
  length_order?: number
  height_order?: number
  width_m?: number
  area_m2?: number
  count?: number
  room_type?: string
  space_type?: string
  space_profile?: string
  facade_role?: string
  foundation_type?: string
  has_ceiling?: boolean
  has_paint?: boolean
  has_electrical?: boolean
  has_plumbing?: boolean
  has_window?: boolean
  has_door?: boolean
  opening_preset?: string
  locked?: boolean
  openings?: OpeningDraft[]
  extra_json_text?: string
}
type DraftDeltaChange = {
  blockId: string
  before?: BlockDraft
  after?: BlockDraft
}
type DraftDelta = {
  changes: DraftDeltaChange[]
}

type Tax = { id: string; kind: string; value: string; name: string; is_active: boolean }
type TemplateOpt = { id: string; template_name: string; template_code: string; is_active?: boolean }
type CustomerOpt = { id: string; full_name: string | null; phone_number: string | null }
type RegionOpt = { code: string; name: string }
type PaginationState = { page: number; limit: number; total: number; totalPages: number }
type LayoutPresetKey = 'zero' | 'compact' | 'standard' | 'spacious'
type LayoutModeKey = 'pack' | 'by_length'
type ColorPresetKey = 'default' | 'pastel' | 'contrast' | 'print_friendly'
type EditorMode = 'quick' | 'standard' | 'advanced'
const ASSEMBLY_DETAIL_CACHE_LIMIT = 10

const DESIGNER_3D_COLOR_OVERRIDES_KEY = 'assembly_designer_3d_color_overrides'
const DESIGNER_3D_COLOR_PRESET_KEY = 'assembly_designer_3d_color_preset'
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

type Box = {
  block: Block
  x: number
  y: number
  w: number
  h: number
  label: string
  length_m: number
  height_m: number
}

function overlapArea(a: Box, b: Box) {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)
  const w = x2 - x1
  const h = y2 - y1
  if (w <= 0 || h <= 0) return 0
  return w * h
}

const STORAGE_KEY = 'assembly_estimate_preview_context_v1'
const GRID_STEP_M = 0.5
const CANVAS_PADDING = 24
const SNAP_STEP_M = 0.1
const MIN_BLOCK_SIZE_M = 0.5
const MIN_BLOCK_SIZE_THIN_M = 0.1
const MIN_BLOCK_RENDER_PX = 10
const SPACE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'living_room', label: 'Phòng khách' },
  { value: 'bedroom', label: 'Phòng ngủ' },
  { value: 'master_bedroom', label: 'Phòng ngủ master' },
  { value: 'kitchen', label: 'Bếp' },
  { value: 'wc', label: 'WC' },
  { value: 'hallway', label: 'Hành lang' },
  { value: 'stair', label: 'Cầu thang' },
  { value: 'balcony', label: 'Ban công' },
  { value: 'garage', label: 'Gara' },
  { value: 'storage', label: 'Kho' },
  { value: 'tum', label: 'Tum' },
  { value: 'roof', label: 'Mái / sân thượng' },
  { value: 'foundation', label: 'Móng' },
  { value: 'other', label: 'Khác' },
]
const SPACE_PROFILE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'basic', label: 'Cơ bản' },
  { value: 'economy', label: 'Tiết kiệm' },
  { value: 'premium', label: 'Cao cấp' },
  { value: 'utility', label: 'Phụ trợ' },
]
const DEFAULT_OPENING_PRESET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'door_single', label: 'Cửa đi 1 cánh' },
  { value: 'door_double', label: 'Cửa đi 2 cánh' },
  { value: 'door_sliding', label: 'Cửa lùa' },
  { value: 'window_small', label: 'Cửa sổ nhỏ' },
  { value: 'window_large', label: 'Cửa sổ lớn' },
  { value: 'vent', label: 'Ô thông gió' },
]
const BLOCK_FEATURE_OPTIONS: Array<{ key: keyof BlockDraft; label: string }> = [
  { key: 'has_ceiling', label: 'Có trần' },
  { key: 'has_paint', label: 'Có sơn' },
  { key: 'has_electrical', label: 'Có điện' },
  { key: 'has_plumbing', label: 'Có nước' },
  { key: 'has_window', label: 'Có cửa sổ' },
  { key: 'has_door', label: 'Có cửa đi' },
]
const FACADE_ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'main_front', label: 'Mặt tiền chính' },
  { value: 'secondary_front', label: 'Mặt tiền phụ' },
  { value: 'side_left', label: 'Hông trái' },
  { value: 'side_right', label: 'Hông phải' },
  { value: 'rear', label: 'Mặt sau' },
  { value: 'interior', label: 'Khối bên trong' },
]
const ROOM_TYPE_OPTIONS_BY_COMPONENT: Record<string, string[]> = {
  room: ['living_room', 'bedroom', 'wc', 'kitchen', 'cau_thang', 'tum'],
}
const SPACE_TYPE_OPTIONS_BY_COMPONENT: Record<string, string[]> = {
  room: ['living_room', 'bedroom', 'master_bedroom', 'kitchen', 'wc', 'hallway', 'stair', 'balcony', 'garage', 'storage', 'tum', 'other'],
}
const FACADE_ROLE_OPTIONS_BY_COMPONENT: Record<string, string[]> = {
  room: ['main_front', 'secondary_front', 'side_left', 'side_right', 'rear', 'interior'],
  wall: ['main_front', 'secondary_front', 'side_left', 'side_right', 'rear', 'interior'],
  roof: ['main_front', 'secondary_front', 'side_left', 'side_right', 'rear'],
  tum: ['main_front', 'secondary_front', 'side_left', 'side_right', 'rear'],
  tum_roof: ['main_front', 'secondary_front', 'side_left', 'side_right', 'rear'],
}
type SemanticHint = { title: string; reasons: string[] }

function filterOptionsByComponent<T extends { value: string }>(options: T[], componentType: string, map: Record<string, string[]>) {
  const allowed = map[String(componentType || '').trim().toLowerCase()]
  if (!allowed || allowed.length === 0) return options
  const allowedSet = new Set(allowed)
  return options.filter((x) => allowedSet.has(String(x.value || '').trim().toLowerCase()))
}

function filterOpeningPresetOptionsByComponent<T extends { value: string }>(options: T[], componentType: string) {
  const normalized = String(componentType || '').trim().toLowerCase()
  if (normalized !== 'room' && normalized !== 'wall') return []
  return options.filter((x) => {
    const value = String(x.value || '').trim().toLowerCase()
    return value.startsWith('door_') || value.startsWith('window_') || value === 'vent'
  })
}

function getComponentFieldFlags(componentType?: string) {
  const type = String(componentType || '').trim().toLowerCase()
  const isRoom = type === 'room'
  const isWall = type === 'wall'
  const isFoundation = type === 'foundation'
  const supportsFacade = isRoom || isWall || type === 'roof' || type === 'tum' || type === 'tum_roof'
  const allowsOpenings = isRoom || isWall
  const allowedFeatureKeys = isRoom
    ? new Set(BLOCK_FEATURE_OPTIONS.map((x) => x.key))
    : isWall
      ? new Set<keyof BlockDraft>(['has_window', 'has_door'])
      : new Set<keyof BlockDraft>()
  return { isRoom, isWall, isFoundation, supportsFacade, allowsOpenings, allowedFeatureKeys }
}

function sanitizeBlockDraftByComponentType<T extends Record<string, any>>(componentType: string, draft: T): T {
  const flags = getComponentFieldFlags(componentType)
  const next = { ...draft }
  if (!flags.isRoom) {
    next.room_type = ''
    next.space_type = ''
    next.space_profile = ''
  }
  if (!flags.supportsFacade) next.facade_role = ''
  if (!flags.isFoundation) next.foundation_type = ''
  if (!flags.isWall) {
    next.wall_area_m2 = ''
    next.wall_length_m = ''
  }
  if (!flags.allowsOpenings) next.openings = []
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
    hints.push({ title: `Preset cau thang: ${stairPreset}`, reasons: ['Dang co logic cau thang trong 3D va extra facts preview'] })
  }

  return hints
}
const LAYOUT_PRESETS: Record<LayoutPresetKey, { gapX: number; gapY: number }> = {
  zero: { gapX: 0, gapY: 0 },
  compact: { gapX: 0.5, gapY: 0.5 },
  standard: { gapX: 1, gapY: 1 },
  spacious: { gapX: 2, gapY: 1.5 },
}
function minSizeByComponentType(componentType: string | null | undefined) {
  const t = String(componentType || '').trim().toLowerCase()
  if (t === 'slab' || t === 'ceiling') return MIN_BLOCK_SIZE_THIN_M
  return MIN_BLOCK_SIZE_M
}
function isBlockLocked(block: Block, draft?: BlockDraft) {
  if (typeof draft?.locked === 'boolean') return draft.locked
  return Boolean((block?.dimensions_json as any)?.locked)
}

function pickNum(obj: Record<string, unknown> | null | undefined, keys: string[]) {
  const src = obj && typeof obj === 'object' ? obj : {}
  for (const k of keys) {
    const n = Number((src as any)[k])
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
function snap01(n: number) {
  return Math.round(n / SNAP_STEP_M) * SNAP_STEP_M
}
function nat(v: unknown) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.trunc(n))
}

function blockDims(block: Block, draft?: BlockDraft) {
  const dims = block.dimensions_json || {}
  const length = draft?.length_m || pickNum(dims, ['length_m', 'length', 'build_length_m'])
  const height = draft?.height_m || pickNum(dims, ['height_m', 'floor_height_m', 'height'])
  const width = pickNum(dims, ['width_m', 'width', 'build_width_m'])
  const area = pickNum(dims, ['area_m2', 'area', 'floor_area', 'footprint_area'])
  const defaultLen = Math.max(2, Math.sqrt(area || 25))
  const defaultH = Math.max(2.8, area ? Math.sqrt(area) * 0.25 : 3.6)
  return {
    length: length || defaultLen,
    height: height || defaultH,
    width: width || null,
  }
}

function normalizeOpeningDraft(value: any, length: number, height: number, width: number): OpeningDraft | null {
  const typeRaw = String(value?.type || '').trim().toLowerCase()
  const faceRaw = String(value?.face || '').trim().toLowerCase()
  const type: OpeningDraft['type'] = typeRaw === 'window' || typeRaw === 'vent' ? typeRaw : 'door'
  const face: OpeningDraft['face'] = faceRaw === 'back' || faceRaw === 'left' || faceRaw === 'right' ? faceRaw : 'front'
  const safeWidthAxis = Math.max(1, width || 4)
  const faceSpan = face === 'left' || face === 'right' ? safeWidthAxis : Math.max(1, length)
  const safeHeightAxis = Math.max(1.5, height)
  const defaultWidth = type === 'door' ? Math.max(0.9, faceSpan * 0.18) : type === 'window' ? Math.max(1.2, faceSpan * 0.24) : Math.max(0.7, faceSpan * 0.16)
  const defaultHeight = type === 'door' ? Math.min(safeHeightAxis * 0.64, 2.2) : type === 'window' ? Math.max(0.8, safeHeightAxis * 0.28) : Math.max(0.32, safeHeightAxis * 0.12)
  const maxWidth = Math.max(0.4, faceSpan - 0.3)
  const safeWidth = Math.max(0.3, Math.min(maxWidth, Number(value?.width) || defaultWidth))
  const safeHeight = Math.max(0.25, Math.min(safeHeightAxis - 0.15, Number(value?.height) || defaultHeight))
  const safeSill = Math.max(0, Math.min(safeHeightAxis - safeHeight - 0.05, Number(value?.sill) || (type === 'door' ? 0 : safeHeightAxis * 0.28)))
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

function getDraftOpenings(block: Block, draft?: BlockDraft) {
  const dims = block?.dimensions_json && typeof block.dimensions_json === 'object' ? block.dimensions_json : {}
  const geom = blockDims(block, draft)
  const src = Array.isArray(draft?.openings) ? draft?.openings : Array.isArray((dims as any).openings) ? (dims as any).openings : []
  return src
    .map((opening: any) => normalizeOpeningDraft(opening, geom.length, geom.height, geom.width || 4))
    .filter(Boolean) as OpeningDraft[]
}

function getOpeningColor(type: OpeningDraft['type']) {
  if (type === 'door') return '#1d4ed8'
  if (type === 'window') return '#7dd3fc'
  return '#cbd5e1'
}

function getOpeningShortLabel(type: OpeningDraft['type']) {
  if (type === 'door') return 'D'
  if (type === 'window') return 'W'
  return 'V'
}

function getOpeningRects2D(box: Box, block: Block, draft?: BlockDraft) {
  const geom = blockDims(block, draft)
  const openings = getDraftOpenings(block, draft)
  const pxPerLen = box.w / Math.max(0.1, geom.length)
  const pxPerHeight = box.h / Math.max(0.1, geom.height)
  const sideWidth = Math.max(6, Math.min(14, box.w * 0.08))
  return openings.map((opening, index) => {
    const hPx = Math.max(4, opening.height * pxPerHeight)
    const top = (geom.height - opening.sill - opening.height) * pxPerHeight
    if (opening.face === 'left' || opening.face === 'right') {
      return {
        key: `${block.id}:opening:${index}`,
        x: opening.face === 'left' ? box.x : box.x + box.w - sideWidth,
        y: box.y + top,
        w: sideWidth,
        h: hPx,
        type: opening.type,
        color: getOpeningColor(opening.type),
        label: getOpeningShortLabel(opening.type),
        index,
        dash: opening.face === 'right' ? [4, 3] : undefined,
      }
    }
    const centerX = box.x + box.w / 2 + opening.offset * pxPerLen
    const wPx = Math.max(6, opening.width * pxPerLen)
    return {
      key: `${block.id}:opening:${index}`,
      x: centerX - wPx / 2,
      y: box.y + top,
      w: wPx,
      h: hPx,
      type: opening.type,
      color: getOpeningColor(opening.type),
      label: getOpeningShortLabel(opening.type),
      index,
      dash: opening.face === 'back' ? [4, 3] : undefined,
    }
  })
}

function getOpeningPresetRects2D(box: Box, block: Block, draft: BlockDraft | undefined, taxonomies: Tax[]) {
  const dims = block?.dimensions_json && typeof block.dimensions_json === 'object' ? block.dimensions_json : {}
  const openingPreset = String(draft?.opening_preset ?? (dims as any).opening_preset ?? '').trim().toLowerCase()
  if (!openingPreset) return []
  if (getDraftOpenings(block, draft).length > 0) return []
  const geom = blockDims(block, draft)
  const cfg = getOpeningPresetConfig(taxonomies as any, openingPreset)
  const type = cfg.opening_type || (openingPreset.startsWith('door_') ? 'door' : openingPreset.startsWith('window_') ? 'window' : openingPreset === 'vent' ? 'vent' : 'door')
  const widthRatio = cfg.width_ratio && cfg.width_ratio > 0 ? cfg.width_ratio : type === 'door' ? 0.18 : type === 'window' ? 0.24 : 0.16
  const minWidth = cfg.min_width && cfg.min_width > 0 ? cfg.min_width : type === 'door' ? 0.9 : type === 'window' ? 1.2 : 0.7
  const widthM = Math.max(minWidth, geom.length * widthRatio)
  const wPx = Math.max(6, widthM * (box.w / Math.max(0.1, geom.length)))
  const heightRatio = cfg.height_ratio && cfg.height_ratio > 0 ? cfg.height_ratio : type === 'door' ? 0.64 : type === 'window' ? 0.28 : 0.12
  const maxHeight = cfg.max_height && cfg.max_height > 0 ? cfg.max_height : type === 'door' ? 2.2 : type === 'window' ? 1.2 : 0.45
  const heightM = type === 'door' ? Math.min(geom.height * heightRatio, maxHeight) : Math.max(maxHeight, geom.height * heightRatio)
  const hPx = Math.max(4, heightM * (box.h / Math.max(0.1, geom.height)))
  const sillRatio = cfg.sill_ratio != null ? cfg.sill_ratio : type === 'door' ? 0 : type === 'window' ? 0.28 : 0.22
  const sillM = Math.max(0, Math.min(geom.height - heightM - 0.05, geom.height * sillRatio))
  const top = (geom.height - sillM - heightM) * (box.h / Math.max(0.1, geom.height))
  return [{
    key: `${block.id}:opening-preset:${openingPreset}`,
    x: box.x + box.w / 2 - wPx / 2,
    y: box.y + top,
    w: wPx,
    h: hPx,
    type,
    color: cfg.color || getOpeningColor(type),
    label: `${getOpeningShortLabel(type)}*`,
    index: -1,
    dash: [5, 4],
    isPresetFallback: true,
  }]
}

function toBoxes(blocks: Block[], drafts: Record<string, BlockDraft>, scalePxPerM: number, canvasPadding = CANVAS_PADDING): Box[] {
  const out: Box[] = []
  let cursorX = canvasPadding
  let cursorY = canvasPadding
  let rowMaxH = 0
  const rowLimit = 1200

  for (const b of blocks) {
    const draft = drafts[b.id] || {}
    const d = blockDims(b, draft)
    const w = Math.max(MIN_BLOCK_RENDER_PX, d.length * scalePxPerM)
    const h = Math.max(MIN_BLOCK_RENDER_PX, d.height * scalePxPerM)

    if (cursorX + w > rowLimit) {
      cursorX = canvasPadding
      cursorY += rowMaxH + 18
      rowMaxH = 0
    }

    const x = draft.x_m != null ? canvasPadding + draft.x_m * scalePxPerM : cursorX
    const y = draft.y_m != null ? canvasPadding + draft.y_m * scalePxPerM : cursorY

    out.push({
      block: b,
      x,
      y,
      w,
      h,
      label: `${b.block_name || b.component_type} (${round2(d.length)} x ${round2(d.height)}m)`,
      length_m: d.length,
      height_m: d.height,
    })

    cursorX += w + 18
    rowMaxH = Math.max(rowMaxH, h)
  }

  return out
}

function FoldSection({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.015))' }}>
      <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '12px 14px', fontSize: 11, letterSpacing: 1.2, color: 'var(--text4)', fontWeight: 700 }}>
        {title}
      </summary>
      <div style={{ padding: '0 14px 14px 14px', display: 'grid', gap: 10 }}>
        {children}
      </div>
    </details>
  )
}

export default function AssemblyDesigner2DPage() {
  const sp = useSearchParams()
  const router = useRouter()
  const [assemblies, setAssemblies] = useState<AssemblyRow[]>([])
  const [selectedAssemblyId, setSelectedAssemblyId] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<number | 'all'>('all')
  const [selectedBlockId, setSelectedBlockId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [scalePxPerM, setScalePxPerM] = useState(18)
  const [drafts, setDrafts] = useState<Record<string, BlockDraft>>({})
  const [undoStack, setUndoStack] = useState<DraftDelta[]>([])
  const [redoStack, setRedoStack] = useState<DraftDelta[]>([])
  const [savingBlockId, setSavingBlockId] = useState('')
  const [savingAll, setSavingAll] = useState(false)
  const [stackTargetBlockId, setStackTargetBlockId] = useState('')
  const [selectedOpeningIndex, setSelectedOpeningIndex] = useState<number | null>(null)
  const [numInputs, setNumInputs] = useState<Record<string, string>>({})
  const [layoutPreset, setLayoutPreset] = useState<LayoutPresetKey>('zero')
  const [editorMode, setEditorMode] = useState<EditorMode>('standard')
  const [colorPreset, setColorPreset] = useState<ColorPresetKey>('default')
  const [componentColorOverrides, setComponentColorOverrides] = useState<Record<string, string>>({})
  const [layoutMode] = useState<LayoutModeKey>('by_length')
  const [detail, setDetail] = useState<AssemblyDetail | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [taxonomies, setTaxonomies] = useState<Tax[]>([])
  const [templates, setTemplates] = useState<TemplateOpt[]>([])
  const [customers, setCustomers] = useState<CustomerOpt[]>([])
  const [regions, setRegions] = useState<RegionOpt[]>([{ code: 'ALL', name: 'ALL - Toan quoc' }])
  const [assemblyPage, setAssemblyPage] = useState(1)
  const [assemblyPagination, setAssemblyPagination] = useState<PaginationState>({ page: 1, limit: 20, total: 0, totalPages: 1 })
  const [assemblyForm, setAssemblyForm] = useState({
    name: '',
    customer_id: '',
    house_type: '',
    style: '',
    level: 'tieu_chuan',
    region_code: 'ALL',
    status: 'draft',
  })
  const [newAssemblyName, setNewAssemblyName] = useState('')
  const [newBlock, setNewBlock] = useState({
    component_type: 'wall',
    template_id: '',
    sort_order: '0',
    length_order: '0',
    height_order: '0',
    block_name: '',
    level_index: '0',
    length_m: '6',
    width_m: '',
    height_m: '3.6',
    area_m2: '',
    count: '1',
    room_type: '',
    space_type: '',
    space_profile: 'basic',
    foundation_type: '',
    has_ceiling: false,
    has_paint: false,
    has_electrical: false,
    has_plumbing: false,
    has_window: false,
    has_door: false,
    locked: false,
    wall_area_m2: '',
    wall_length_m: '',
    extra_json_text: '',
  })
  const assemblyDetailCacheRef = useRef<Record<string, AssemblyDetail>>({})
  const assemblyDetailOrderRef = useRef<string[]>([])
  useEffect(() => {
    try {
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

  function getComponentDisplayColor(componentType?: string | null) {
    const key = String(componentType || '').trim().toLowerCase()
    const presetColors = COLOR_PRESETS[colorPreset] || {}
    return componentColorOverrides[key] || presetColors[key] || getAssemblyComponentVisual(componentType).color
  }

  useEffect(() => {
    const qId = String(sp.get('assembly_id') || '')
    loadAssemblies(qId, assemblyPage)
    loadMasterData()
  }, [sp, assemblyPage])

  useEffect(() => {
    const qBlock = String(sp.get('block_id') || '').trim()
    if (!qBlock) return
    setSelectedBlockId(qBlock)
  }, [sp, selectedAssemblyId])

  useEffect(() => {
    setSelectedOpeningIndex(null)
  }, [selectedBlockId])

  useEffect(() => {
    if (!selectedAssemblyId) return
    loadAssemblyDetail(selectedAssemblyId)
  }, [selectedAssemblyId])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
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
  function cloneDraft(src: BlockDraft | undefined) {
    if (!src) return undefined
    return JSON.parse(JSON.stringify(src)) as BlockDraft
  }
  const historyMuteRef = useRef(false)
  const stageRef = useRef<any>(null)
  function makeDelta(prev: Record<string, BlockDraft>, next: Record<string, BlockDraft>): DraftDelta | null {
    const ids = new Set<string>([...Object.keys(prev || {}), ...Object.keys(next || {})])
    const changes: DraftDeltaChange[] = []
    for (const id of ids) {
      const b = prev[id]
      const a = next[id]
      const bs = JSON.stringify(b ?? null)
      const as = JSON.stringify(a ?? null)
      if (bs === as) continue
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
      const next: Record<string, BlockDraft> = { ...prev }
      for (const c of delta.changes) {
        const v = c[pick]
        if (!v) {
          delete next[c.blockId]
        } else {
          next[c.blockId] = cloneDraft(v) || {}
        }
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
      showToast('Da undo thay doi draft')
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
      showToast('Da redo thay doi draft')
      return next
    })
  }
  function setZoom(next: number) {
    setScalePxPerM(Math.max(6, Math.min(60, Number(next) || 18)))
  }

  async function loadAssemblies(preferId = '', page = 1) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/assemblies?limit=20&page=${page}&summary_only=true`)
      const json = await res.json().catch(() => ({}))
      const rows = Array.isArray(json.data) ? json.data : []
      const pg = json?.pagination || {}
      setAssemblies(rows)
      setAssemblyPagination({
        page: Number(pg.page || page || 1),
        limit: Number(pg.limit || 20),
        total: Number(pg.total || 0),
        totalPages: Number(pg.totalPages || 1),
      })
      const picked = rows.find((x: any) => String(x.id) === preferId)
      if (picked) setSelectedAssemblyId(String(picked.id))
      else if (rows.length > 0) setSelectedAssemblyId(String(rows[0].id))
    } catch (e: any) {
      setError(e?.message || 'Không tải được assemblies')
    } finally {
      setLoading(false)
    }
  }

  async function loadMasterData() {
    const [tRes, tplRes, cRes, rRes] = await Promise.all([
      fetch('/api/settings/estimate/taxonomies?active_only=false'),
      fetch('/api/settings/estimate/templates?active_only=true'),
      fetch('/api/customers?limit=300&sort=updated_at&dir=desc'),
      fetch('/api/settings/regions?active_only=true&level=province&limit=500'),
    ])
    const tJson = await tRes.json().catch(() => ({}))
    const tplJson = await tplRes.json().catch(() => ({}))
    const cJson = await cRes.json().catch(() => ({}))
    const rJson = await rRes.json().catch(() => ({}))
    setTaxonomies(Array.isArray(tJson.data) ? tJson.data : [])
    setTemplates(Array.isArray(tplJson.data) ? tplJson.data : [])
    setCustomers(
      (Array.isArray(cJson.data) ? cJson.data : [])
        .map((x: any) => ({
          id: String(x.id || ''),
          full_name: x.full_name ? String(x.full_name) : null,
          phone_number: x.phone_number ? String(x.phone_number) : null,
        }))
        .filter((x: CustomerOpt) => x.id)
    )
    const rs = (Array.isArray(rJson.data) ? rJson.data : [])
      .map((x: any) => ({ code: String(x.code || ''), name: String(x.name || x.code || '') }))
      .filter((x: RegionOpt) => x.code)
    setRegions([{ code: 'ALL', name: 'ALL - Toàn quốc' }, ...rs])
  }

  async function loadAssemblyDetail(id: string, forceRefresh = false) {
    const cached = !forceRefresh ? assemblyDetailCacheRef.current[id] : null
    if (cached) {
      setDetail(cached)
      setAssemblyForm({
        name: String(cached?.name || ''),
        customer_id: String(cached?.customer_id || ''),
        house_type: String(cached?.house_type || ''),
        style: String(cached?.style || ''),
        level: String(cached?.level || 'tieu_chuan'),
        region_code: String(cached?.region_code || 'ALL'),
        status: String((cached as any)?.status || 'draft'),
      })
      const cachedDrafts: Record<string, BlockDraft> = {}
      for (const b of (cached?.blocks || [])) {
        const dims = b?.dimensions_json || {}
        const x = Number((dims as any).x_m)
        const y = Number((dims as any).y_m)
        const l = Number((dims as any).length_m)
        const h = Number((dims as any).height_m)
        const wallArea = Number((dims as any).wall_area_m2)
        const wallLength = Number((dims as any).wall_length_m)
        const width = Number((dims as any).width_m)
        const area = Number((dims as any).area_m2)
        const count = Number((dims as any).count)
        cachedDrafts[b.id] = {
          x_m: Number.isFinite(x) ? x : undefined,
          y_m: Number.isFinite(y) ? y : undefined,
          length_m: Number.isFinite(l) && l > 0 ? l : undefined,
          height_m: Number.isFinite(h) && h > 0 ? h : undefined,
          wall_area_m2: Number.isFinite(wallArea) && wallArea > 0 ? wallArea : undefined,
          wall_length_m: Number.isFinite(wallLength) && wallLength > 0 ? wallLength : undefined,
          block_name: String(b?.block_name || ''),
          component_type: String(b?.component_type || ''),
          level_index: Number.isFinite(Number(b?.level_index)) ? Math.trunc(Number(b.level_index)) : 0,
          template_id: String((b as any)?.template_id || ''),
          sort_order: Number.isFinite(Number((b as any)?.sort_order)) ? Math.trunc(Number((b as any).sort_order)) : 0,
          length_order: Number.isFinite(Number((b as any)?.length_order)) ? Math.trunc(Number((b as any).length_order)) : 0,
          height_order: Number.isFinite(Number((b as any)?.height_order)) ? Math.trunc(Number((b as any).height_order)) : 0,
          width_m: Number.isFinite(width) && width > 0 ? width : undefined,
          area_m2: Number.isFinite(area) && area > 0 ? area : undefined,
          count: Number.isFinite(count) && count > 0 ? Math.trunc(count) : undefined,
          room_type: String((dims as any).room_type || ''),
          space_type: String((dims as any).space_type || ''),
          space_profile: String((dims as any).space_profile || ''),
          facade_role: String((dims as any).facade_role || ''),
          foundation_type: String((dims as any).foundation_type || ''),
          opening_preset: String((dims as any).opening_preset || ''),
          has_ceiling: typeof (dims as any).has_ceiling === 'boolean' ? Boolean((dims as any).has_ceiling) : undefined,
          has_paint: typeof (dims as any).has_paint === 'boolean' ? Boolean((dims as any).has_paint) : undefined,
          has_electrical: typeof (dims as any).has_electrical === 'boolean' ? Boolean((dims as any).has_electrical) : undefined,
          has_plumbing: typeof (dims as any).has_plumbing === 'boolean' ? Boolean((dims as any).has_plumbing) : undefined,
          has_window: typeof (dims as any).has_window === 'boolean' ? Boolean((dims as any).has_window) : undefined,
          has_door: typeof (dims as any).has_door === 'boolean' ? Boolean((dims as any).has_door) : undefined,
          locked: Boolean((dims as any).locked),
          openings: Array.isArray((dims as any).openings)
            ? ((dims as any).openings
              .map((x: any) => normalizeOpeningDraft(x, Number.isFinite(l) && l > 0 ? l : 6, Number.isFinite(h) && h > 0 ? h : 3.6, Number.isFinite(width) && width > 0 ? width : 4))
              .filter(Boolean) as OpeningDraft[])
            : undefined,
          extra_json_text: '',
        }
      }
      setDrafts(cachedDrafts)
      setUndoStack([])
      setRedoStack([])
      return
    }
    const res = await fetch(`/api/assemblies/${id}`)
    const json = await res.json().catch(() => ({}))
    const data = json?.data || null
    if (data) rememberAssemblyDetail(data)
    setDetail(data)
    setAssemblyForm({
      name: String(data?.name || ''),
      customer_id: String(data?.customer_id || ''),
      house_type: String(data?.house_type || ''),
      style: String(data?.style || ''),
      level: String(data?.level || 'tieu_chuan'),
      region_code: String(data?.region_code || 'ALL'),
      status: String(data?.status || 'draft'),
    })

    const nextDrafts: Record<string, BlockDraft> = {}
    for (const b of (data?.blocks || [])) {
      const dims = b?.dimensions_json || {}
      const x = Number((dims as any).x_m)
      const y = Number((dims as any).y_m)
      const l = Number((dims as any).length_m)
      const h = Number((dims as any).height_m)
      const wallArea = Number((dims as any).wall_area_m2)
      const wallLength = Number((dims as any).wall_length_m)
      const width = Number((dims as any).width_m)
      const area = Number((dims as any).area_m2)
      const count = Number((dims as any).count)
      nextDrafts[b.id] = {
        x_m: Number.isFinite(x) ? x : undefined,
        y_m: Number.isFinite(y) ? y : undefined,
        length_m: Number.isFinite(l) && l > 0 ? l : undefined,
        height_m: Number.isFinite(h) && h > 0 ? h : undefined,
        wall_area_m2: Number.isFinite(wallArea) && wallArea > 0 ? wallArea : undefined,
        wall_length_m: Number.isFinite(wallLength) && wallLength > 0 ? wallLength : undefined,
        block_name: String(b?.block_name || ''),
        component_type: String(b?.component_type || ''),
        level_index: Number.isFinite(Number(b?.level_index)) ? Math.trunc(Number(b.level_index)) : 0,
        template_id: String((b as any)?.template_id || ''),
        sort_order: Number.isFinite(Number((b as any)?.sort_order)) ? Math.trunc(Number((b as any).sort_order)) : 0,
        length_order: Number.isFinite(Number((b as any)?.length_order)) ? Math.trunc(Number((b as any).length_order)) : 0,
        height_order: Number.isFinite(Number((b as any)?.height_order)) ? Math.trunc(Number((b as any).height_order)) : 0,
        width_m: Number.isFinite(width) && width > 0 ? width : undefined,
        area_m2: Number.isFinite(area) && area > 0 ? area : undefined,
        count: Number.isFinite(count) && count > 0 ? Math.trunc(count) : undefined,
        room_type: String((dims as any).room_type || ''),
        space_type: String((dims as any).space_type || ''),
        space_profile: String((dims as any).space_profile || ''),
        facade_role: String((dims as any).facade_role || ''),
        foundation_type: String((dims as any).foundation_type || ''),
        opening_preset: String((dims as any).opening_preset || ''),
        has_ceiling: typeof (dims as any).has_ceiling === 'boolean' ? Boolean((dims as any).has_ceiling) : undefined,
        has_paint: typeof (dims as any).has_paint === 'boolean' ? Boolean((dims as any).has_paint) : undefined,
        has_electrical: typeof (dims as any).has_electrical === 'boolean' ? Boolean((dims as any).has_electrical) : undefined,
        has_plumbing: typeof (dims as any).has_plumbing === 'boolean' ? Boolean((dims as any).has_plumbing) : undefined,
        has_window: typeof (dims as any).has_window === 'boolean' ? Boolean((dims as any).has_window) : undefined,
        has_door: typeof (dims as any).has_door === 'boolean' ? Boolean((dims as any).has_door) : undefined,
        locked: Boolean((dims as any).locked),
        openings: Array.isArray((dims as any).openings)
          ? ((dims as any).openings
            .map((x: any) => normalizeOpeningDraft(x, Number.isFinite(l) && l > 0 ? l : 6, Number.isFinite(h) && h > 0 ? h : 3.6, Number.isFinite(width) && width > 0 ? width : 4))
            .filter(Boolean) as OpeningDraft[])
          : undefined,
        extra_json_text: '',
      }
    }
    setDrafts(nextDrafts)
    setUndoStack([])
    setRedoStack([])
  }

  async function createAssemblyQuick() {
    const name = newAssemblyName.trim()
    if (!name) return showToast('Nhap tên assembly')
    const res = await fetch('/api/assemblies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, region_code: 'ALL', level: 'tieu_chuan' }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(json?.error || 'Không tạo được assembly')
    const createdId = String(json?.data?.id || '')
    setNewAssemblyName('')
    await loadAssemblies(createdId, 1)
    setAssemblyPage(1)
    showToast('Đã tạo assembly')
  }

  async function saveCurrentAssembly() {
    if (!selectedAssemblyId) return
    const payload = {
      name: assemblyForm.name.trim(),
      customer_id: assemblyForm.customer_id || null,
      house_type: assemblyForm.house_type || null,
      style: assemblyForm.style || null,
      level: assemblyForm.level || null,
      region_code: assemblyForm.region_code || 'ALL',
      status: assemblyForm.status || 'draft',
    }
    if (!payload.name) return showToast('Tên assembly không được rỗng')
    const res = await fetch(`/api/assemblies/${selectedAssemblyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(json?.error || 'Không cập nhật được assembly')
    await loadAssemblies(selectedAssemblyId, assemblyPage)
    await loadAssemblyDetail(selectedAssemblyId, true)
    showToast('Đã cập nhật assembly')
  }

  async function deleteCurrentAssembly() {
    if (!selectedAssemblyId) return
    if (!confirm('Xóa assembly hiện tại?')) return
    const res = await fetch(`/api/assemblies/${selectedAssemblyId}`, { method: 'DELETE' })
    if (!res.ok) return showToast('Không xóa được assembly')
    setSelectedBlockId('')
    setDetail(null)
    await loadAssemblies('', assemblyPage)
    showToast('Đã xóa assembly')
  }

  async function addBlockQuick() {
    if (!selectedAssemblyId) return showToast('Chon assembly truoc')
    const preparedNewBlock = sanitizeBlockDraftByComponentType(String(newBlock.component_type || '').trim(), newBlock as any)
    const componentType = String(preparedNewBlock.component_type || '').trim()
    if (!componentType) return showToast('Thiếu component_type')
    const minM = minSizeByComponentType(componentType)
    const length = Math.max(minM, snap01(Number(preparedNewBlock.length_m) || minM))
    const height = Math.max(minM, snap01(Number(preparedNewBlock.height_m) || minM))
    const levelIndex = nat(preparedNewBlock.level_index)
    const payload = {
      component_type: componentType,
      block_name: String(preparedNewBlock.block_name || '').trim() || null,
      level_index: levelIndex,
      template_id: preparedNewBlock.template_id || null,
      sort_order: nat(preparedNewBlock.sort_order),
      length_order: nat(preparedNewBlock.length_order),
      height_order: nat(preparedNewBlock.height_order),
      dimensions_json: (() => {
        let dims: Record<string, any> = {
          length_m: round2(length),
          height_m: round2(height),
          locked: Boolean(preparedNewBlock.locked),
        }
        const width = Number(preparedNewBlock.width_m)
        const area = Number(preparedNewBlock.area_m2)
        const count = Number(preparedNewBlock.count)
        const wallArea = Number(preparedNewBlock.wall_area_m2)
        const wallLength = Number(preparedNewBlock.wall_length_m)
        if (Number.isFinite(width) && width > 0) dims.width_m = round2(Math.max(minM, snap01(width)))
        if (Number.isFinite(area) && area > 0) dims.area_m2 = round2(area)
        if (Number.isFinite(count) && count > 0) dims.count = Math.trunc(count)
        if (preparedNewBlock.room_type) dims.room_type = preparedNewBlock.room_type
        if (preparedNewBlock.space_type) dims.space_type = preparedNewBlock.space_type
        if (preparedNewBlock.space_profile) dims.space_profile = preparedNewBlock.space_profile
        if (preparedNewBlock.facade_role) dims.facade_role = preparedNewBlock.facade_role
        if (preparedNewBlock.foundation_type) dims.foundation_type = preparedNewBlock.foundation_type
        if (preparedNewBlock.opening_preset) dims.opening_preset = preparedNewBlock.opening_preset
        dims.has_ceiling = Boolean(preparedNewBlock.has_ceiling)
        dims.has_paint = Boolean(preparedNewBlock.has_paint)
        dims.has_electrical = Boolean(preparedNewBlock.has_electrical)
        dims.has_plumbing = Boolean(preparedNewBlock.has_plumbing)
        dims.has_window = Boolean(preparedNewBlock.has_window)
        dims.has_door = Boolean(preparedNewBlock.has_door)
        if (Number.isFinite(wallArea) && wallArea > 0) dims.wall_area_m2 = round2(wallArea)
        if (Number.isFinite(wallLength) && wallLength > 0) dims.wall_length_m = round2(wallLength)
        if (Array.isArray(preparedNewBlock.openings) && preparedNewBlock.openings.length) dims.openings = preparedNewBlock.openings
        const rawExtra = String(preparedNewBlock.extra_json_text || '').trim()
        if (rawExtra) {
          try {
            const extraObj = JSON.parse(rawExtra)
            if (extraObj && typeof extraObj === 'object' && !Array.isArray(extraObj)) {
              dims = { ...dims, ...extraObj }
            }
          } catch {}
        }
        return dims
      })(),
    }
    const res = await fetch(`/api/assemblies/${selectedAssemblyId}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(json?.error || 'Không thêm được block')
    await loadAssemblyDetail(selectedAssemblyId, true)
    await loadAssemblies(selectedAssemblyId, assemblyPage)
    showToast('Đã thêm block')
  }

  async function deleteSelectedBlock() {
    if (!selectedBlockId) return
    if (!confirm('Xóa block đang chọn?')) return
    const res = await fetch(`/api/assemblies/blocks/${selectedBlockId}`, { method: 'DELETE' })
    if (!res.ok) return showToast('Không xóa được block')
    const deletingId = selectedBlockId
    setSelectedBlockId('')
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[deletingId]
      return next
    })
    await loadAssemblyDetail(selectedAssemblyId, true)
    await loadAssemblies(selectedAssemblyId, assemblyPage)
    showToast('Đã xóa block')
  }

  const selectedAssembly = useMemo(
    () => detail && detail.id === selectedAssemblyId ? detail : (assemblies.find((x) => x.id === selectedAssemblyId) || null),
    [assemblies, selectedAssemblyId, detail]
  )

  const sourceBlocks = useMemo(() => {
    const d = Array.isArray(detail?.blocks) ? detail?.blocks : []
    if (d.length > 0) return d
    return Array.isArray(selectedAssembly?.blocks) ? selectedAssembly.blocks : []
  }, [detail, selectedAssembly])

  const levels = useMemo(() => {
    const set = new Set<number>()
    for (const b of sourceBlocks || []) {
      const n = Number(b.level_index)
      if (Number.isFinite(n)) set.add(Math.trunc(n))
    }
    return Array.from(set).sort((a, b) => a - b)
  }, [sourceBlocks])

  const blocksForView = useMemo(() => {
    const src = sourceBlocks.filter((b) => b)
    if (selectedLevel === 'all') return src
    return src.filter((b) => Number(b.level_index) === selectedLevel)
  }, [sourceBlocks, selectedLevel])
  const sortedBlocksForPick = useMemo(() => {
    return [...blocksForView].sort((a: any, b: any) => {
      const lva = Number.isFinite(Number(a?.level_index)) ? Number(a.level_index) : 0
      const lvb = Number.isFinite(Number(b?.level_index)) ? Number(b.level_index) : 0
      if (lva !== lvb) return lva - lvb
      const ha = Number.isFinite(Number(a?.height_order)) ? Number(a.height_order) : 0
      const hb = Number.isFinite(Number(b?.height_order)) ? Number(b.height_order) : 0
      if (ha !== hb) return ha - hb
      const la = Number.isFinite(Number(a?.length_order)) ? Number(a.length_order) : 0
      const lb = Number.isFinite(Number(b?.length_order)) ? Number(b.length_order) : 0
      if (la !== lb) return la - lb
      const sa = Number.isFinite(Number(a?.sort_order)) ? Number(a.sort_order) : 0
      const sb = Number.isFinite(Number(b?.sort_order)) ? Number(b.sort_order) : 0
      if (sa !== sb) return sa - sb
      return String(a?.block_name || a?.component_type || '').localeCompare(String(b?.block_name || b?.component_type || ''))
    })
  }, [blocksForView])

  const boxes = useMemo(() => toBoxes(blocksForView, drafts, scalePxPerM), [blocksForView, drafts, scalePxPerM])
  const roomTypeOptions = useMemo(
    () => taxonomies.filter((x) => x.kind === 'room_type' && x.is_active),
    [taxonomies]
  )
  const openingPresetOptions = useMemo(
    () => buildPresetOptions(taxonomies as any, 'opening_preset', DEFAULT_OPENING_PRESET_OPTIONS),
    [taxonomies]
  )
  const newBlockOpeningPresetOptions = useMemo(
    () => filterOpeningPresetOptionsByComponent(openingPresetOptions, String(newBlock.component_type || '')),
    [newBlock.component_type, openingPresetOptions]
  )
  const newBlockRoomTypeOptions = useMemo(
    () => filterOptionsByComponent(roomTypeOptions, String(newBlock.component_type || ''), ROOM_TYPE_OPTIONS_BY_COMPONENT),
    [newBlock.component_type, roomTypeOptions]
  )
  const newBlockSpaceTypeOptions = useMemo(
    () => filterOptionsByComponent(SPACE_TYPE_OPTIONS, String(newBlock.component_type || ''), SPACE_TYPE_OPTIONS_BY_COMPONENT),
    [newBlock.component_type]
  )
  const newBlockFacadeRoleOptions = useMemo(
    () => filterOptionsByComponent(FACADE_ROLE_OPTIONS, String(newBlock.component_type || ''), FACADE_ROLE_OPTIONS_BY_COMPONENT),
    [newBlock.component_type]
  )
  const selectedBox = useMemo(() => boxes.find((x) => x.block.id === selectedBlockId) || null, [boxes, selectedBlockId])
  const boxesForRender = useMemo(() => {
    if (!selectedBlockId) return boxes
    const normal = boxes.filter((b) => b.block.id !== selectedBlockId)
    const active = boxes.find((b) => b.block.id === selectedBlockId)
    return active ? [...normal, active] : boxes
  }, [boxes, selectedBlockId])

  const canvasSize = useMemo(() => {
    let maxX = 1200
    let maxY = 460
    for (const b of boxes) {
      maxX = Math.max(maxX, b.x + b.w + 40)
      maxY = Math.max(maxY, b.y + b.h + 40)
    }
    return { width: maxX, height: maxY }
  }, [boxes])
  const rulerSize = 22
  function yDisplayFromLogical(logicalY: number, h: number) {
    return canvasSize.height - h - logicalY
  }
  function logicalYFromDisplay(displayY: number, h: number) {
    return canvasSize.height - h - displayY
  }
  function yMetersFromBox(box: Box) {
    return round2((box.y - CANVAS_PADDING) / scalePxPerM)
  }

  const selectedBlock = useMemo(() => {
    return sourceBlocks.find((x) => x.id === selectedBlockId) || null
  }, [sourceBlocks, selectedBlockId])
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
      openingPreset: '',
      roofPreset: '',
      stairPreset: '',
    })
  }, [drafts, selectedBlock])
  const stackTargetBox = useMemo(() => boxes.find((x) => x.block.id === stackTargetBlockId) || null, [boxes, stackTargetBlockId])
  const overlappedBoxes = useMemo(() => {
    if (!selectedBox) return [] as Array<{ box: Box; areaPx: number }>
    const rows = boxes
      .filter((b) => b.block.id !== selectedBox.block.id)
      .map((b) => ({ box: b, areaPx: overlapArea(selectedBox, b) }))
      .filter((x) => x.areaPx > 0)
      .sort((a, b) => b.areaPx - a.areaPx)
    return rows
  }, [boxes, selectedBox])
  const overlappedIds = useMemo(() => new Set(overlappedBoxes.map((x) => x.box.block.id)), [overlappedBoxes])
  const newBlockFieldFlags = useMemo(() => getComponentFieldFlags(String(newBlock.component_type || '')), [newBlock.component_type])
  const selectedComponentType = useMemo(() => String(drafts[selectedBlockId]?.component_type ?? selectedBlock?.component_type ?? ''), [drafts, selectedBlock, selectedBlockId])
  const selectedFieldFlags = useMemo(() => getComponentFieldFlags(selectedComponentType), [selectedComponentType])
  const selectedRoomTypeOptions = useMemo(
    () => filterOptionsByComponent(roomTypeOptions, selectedComponentType, ROOM_TYPE_OPTIONS_BY_COMPONENT),
    [roomTypeOptions, selectedComponentType]
  )
  const selectedSpaceTypeOptions = useMemo(
    () => filterOptionsByComponent(SPACE_TYPE_OPTIONS, selectedComponentType, SPACE_TYPE_OPTIONS_BY_COMPONENT),
    [selectedComponentType]
  )
  const selectedFacadeRoleOptions = useMemo(
    () => filterOptionsByComponent(FACADE_ROLE_OPTIONS, selectedComponentType, FACADE_ROLE_OPTIONS_BY_COMPONENT),
    [selectedComponentType]
  )
  const selectedOpeningPresetOptions = useMemo(
    () => filterOpeningPresetOptionsByComponent(openingPresetOptions, selectedComponentType),
    [openingPresetOptions, selectedComponentType]
  )

  function updateDraft(blockId: string, patch: BlockDraft, options?: { history?: boolean }) {
    const withHistory = options?.history !== false
    setDrafts((prev) => {
      const hit = sourceBlocks.find((b) => b.id === blockId)
      const merged = { ...(prev[blockId] || {}), ...patch }
      const componentType = String(merged.component_type || hit?.component_type || '')
      const next = { ...prev, [blockId]: sanitizeBlockDraftByComponentType(componentType, merged) }
      if (withHistory && !historyMuteRef.current) {
        const d = makeDelta(prev, next)
        if (d) pushUndoDelta(d)
      }
      return next
    })
  }
  function addOpening(blockId: string, type: OpeningDraft['type']) {
    const hit = sourceBlocks.find((b) => b.id === blockId)
    if (!hit) return
    const geom = blockDims(hit, drafts[blockId])
    const current = getDraftOpenings(hit, drafts[blockId])
    const nextOpening = normalizeOpeningDraft(
      { type, face: 'front', offset: 0, width: type === 'door' ? 1.2 : type === 'window' ? 1.6 : 0.8, height: type === 'door' ? 2.1 : type === 'window' ? 1.2 : 0.45, sill: type === 'door' ? 0 : 0.9 },
      geom.length,
      geom.height,
      geom.width || 4
    )
    updateDraft(blockId, { openings: nextOpening ? [...current, nextOpening] : current })
    if (nextOpening) setSelectedOpeningIndex(current.length)
  }
  function updateOpening(blockId: string, index: number, patch: Partial<OpeningDraft>) {
    const hit = sourceBlocks.find((b) => b.id === blockId)
    if (!hit) return
    const geom = blockDims(hit, drafts[blockId])
    const current = getDraftOpenings(hit, drafts[blockId])
    const next = current.map((opening, i) => i === index ? (normalizeOpeningDraft({ ...opening, ...patch }, geom.length, geom.height, geom.width || 4) || opening) : opening)
    updateDraft(blockId, { openings: next })
  }
  function removeOpening(blockId: string, index: number) {
    const hit = sourceBlocks.find((b) => b.id === blockId)
    if (!hit) return
    const current = getDraftOpenings(hit, drafts[blockId])
    updateDraft(blockId, { openings: current.filter((_, i) => i !== index) })
    setSelectedOpeningIndex((prev) => {
      if (prev == null) return prev
      if (prev === index) return null
      if (prev > index) return prev - 1
      return prev
    })
  }
  function setDraftsWithHistory(next: Record<string, BlockDraft>) {
    setDrafts((prev) => {
      if (!historyMuteRef.current) {
        const d = makeDelta(prev, next)
        if (d) pushUndoDelta(d)
      }
      return next
    })
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
  function stackSelectedBlockOnTop2D() {
    if (!selectedBlock || !selectedBox || !stackTargetBox) return
    if (isBlockLocked(selectedBlock, drafts[selectedBlock.id])) return
    const targetX = round2((stackTargetBox.x - CANVAS_PADDING) / scalePxPerM)
    const targetY = yMetersFromBox(stackTargetBox)
    const targetH = round2(stackTargetBox.height_m)
    updateDraft(selectedBlock.id, {
      x_m: targetX,
      y_m: round2(targetY + targetH),
    })
  }
  function runAutoLayout2D() {
    const all = [...sourceBlocks]
    if (all.length === 0) return
    const { gapX, gapY } = LAYOUT_PRESETS[layoutPreset]
    const byLevel = new Map<number, Block[]>()
    for (const b of all) {
      const lv = Number.isFinite(Number(b.level_index)) ? Math.trunc(Number(b.level_index)) : 0
      if (!byLevel.has(lv)) byLevel.set(lv, [])
      byLevel.get(lv)!.push(b)
    }
    const levelsSorted = Array.from(byLevel.keys()).sort((a, b) => a - b)
    const next = { ...drafts }
    const rowLimitM = 40
    let currentY = 0
    for (const lv of levelsSorted) {
      const list = (byLevel.get(lv) || []).filter((b) => !isBlockLocked(b, next[b.id])).sort((a: any, b: any) => {
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
      if (layoutMode === 'by_length') {
        // Layer by height_order, then place length_order groups left->right.
        // All blocks in same (height_order, length_order) share same x/y (overlap).
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
          let cursorX = 0
          let layerMaxH = 0
          for (const lKey of lengthKeys) {
            const group = byLength.get(lKey) || []
            let groupMaxL = 0
            let groupMaxH = 0
            for (const b of group) {
              const d = blockDims(b, next[b.id])
              const length = Math.max(minSizeByComponentType(b.component_type), d.length || 1)
              const height = Math.max(minSizeByComponentType(b.component_type), d.height || 1)
              groupMaxL = Math.max(groupMaxL, length)
              groupMaxH = Math.max(groupMaxH, height)
              next[b.id] = {
                ...(next[b.id] || {}),
                x_m: round2(snap01(cursorX)),
                y_m: round2(snap01(currentY)),
                level_index: lv,
              }
            }
            // Next length_order starts after the longest block of previous order.
            cursorX += groupMaxL + gapX
            layerMaxH = Math.max(layerMaxH, groupMaxH)
          }
          currentY += layerMaxH + gapY
        }
      } else {
        let cursorX = 0
        let rowMaxH = 0
        for (const b of list) {
          const d = blockDims(b, next[b.id])
          const length = Math.max(minSizeByComponentType(b.component_type), d.length || 1)
          const height = Math.max(minSizeByComponentType(b.component_type), d.height || 1)
          if (cursorX + length > rowLimitM) {
            cursorX = 0
            currentY += rowMaxH + gapY
            rowMaxH = 0
          }
          next[b.id] = {
            ...(next[b.id] || {}),
            x_m: round2(snap01(cursorX)),
            y_m: round2(snap01(currentY)),
            level_index: lv,
          }
          cursorX += length + gapX
          rowMaxH = Math.max(rowMaxH, height)
        }
        currentY += rowMaxH + gapY
      }
    }
    setDraftsWithHistory(next)
    showToast(`Auto-layout (${layoutMode}, ${layoutPreset})`)
  }

  async function saveSelectedBlock() {
    if (!selectedBlock || !selectedBox) return
    setSavingBlockId(selectedBlock.id)
    try {
      const existing = selectedBlock.dimensions_json && typeof selectedBlock.dimensions_json === 'object'
        ? selectedBlock.dimensions_json
        : {}
      const draft = drafts[selectedBlock.id] || {}
      let nextExtra: Record<string, any> = {}
      const rawExtra = String(draft.extra_json_text || '').trim()
      if (rawExtra) {
        try {
          const extraObj = JSON.parse(rawExtra)
          if (extraObj && typeof extraObj === 'object' && !Array.isArray(extraObj)) nextExtra = extraObj
        } catch {}
      }
      const nextDims = {
        ...existing,
        ...nextExtra,
        length_m: round2(snap01(draft.length_m || selectedBox.length_m)),
        height_m: round2(snap01(draft.height_m || selectedBox.height_m)),
        x_m: round2(snap01(draft.x_m || ((selectedBox.x - CANVAS_PADDING) / scalePxPerM))),
        y_m: round2(snap01(draft.y_m || yMetersFromBox(selectedBox))),
        width_m: draft.width_m != null ? round2(snap01(draft.width_m)) : (existing as any).width_m,
        area_m2: draft.area_m2 != null ? round2(draft.area_m2) : (existing as any).area_m2,
        count: draft.count != null ? Math.max(1, Math.trunc(draft.count)) : (existing as any).count,
        room_type: draft.room_type != null ? draft.room_type : (existing as any).room_type,
        space_type: draft.space_type != null ? draft.space_type : (existing as any).space_type,
        space_profile: draft.space_profile != null ? draft.space_profile : (existing as any).space_profile,
        facade_role: draft.facade_role != null ? draft.facade_role : (existing as any).facade_role,
        foundation_type: draft.foundation_type != null ? draft.foundation_type : (existing as any).foundation_type,
        opening_preset: draft.opening_preset != null ? draft.opening_preset : (existing as any).opening_preset,
        has_ceiling: draft.has_ceiling != null ? Boolean(draft.has_ceiling) : Boolean((existing as any).has_ceiling),
        has_paint: draft.has_paint != null ? Boolean(draft.has_paint) : Boolean((existing as any).has_paint),
        has_electrical: draft.has_electrical != null ? Boolean(draft.has_electrical) : Boolean((existing as any).has_electrical),
        has_plumbing: draft.has_plumbing != null ? Boolean(draft.has_plumbing) : Boolean((existing as any).has_plumbing),
        has_window: draft.has_window != null ? Boolean(draft.has_window) : Boolean((existing as any).has_window),
        has_door: draft.has_door != null ? Boolean(draft.has_door) : Boolean((existing as any).has_door),
        locked: draft.locked != null ? Boolean(draft.locked) : Boolean((existing as any).locked),
        openings: draft.openings != null
          ? draft.openings
            .map((x) => normalizeOpeningDraft(x, round2(snap01(draft.length_m || selectedBox.length_m)), round2(snap01(draft.height_m || selectedBox.height_m)), draft.width_m != null ? round2(snap01(draft.width_m)) : Number((existing as any).width_m || 4)))
            .filter(Boolean)
          : (existing as any).openings,
        wall_area_m2: draft.wall_area_m2 != null ? round2(draft.wall_area_m2) : (existing as any).wall_area_m2,
        wall_length_m: draft.wall_length_m != null ? round2(draft.wall_length_m) : (existing as any).wall_length_m,
      }
      const res = await fetch(`/api/assemblies/blocks/${selectedBlock.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_name: String(draft.block_name ?? selectedBlock.block_name ?? '').trim() || null,
          component_type: String(draft.component_type ?? selectedBlock.component_type ?? '').trim() || selectedBlock.component_type,
          level_index: nat(draft.level_index ?? selectedBlock.level_index),
          template_id: (draft.template_id !== undefined ? (String(draft.template_id || '').trim() || null) : (selectedBlock as any).template_id ?? null),
          sort_order: nat(draft.sort_order ?? (selectedBlock as any).sort_order ?? 0),
          length_order: nat(draft.length_order ?? (selectedBlock as any).length_order ?? 0),
          height_order: nat(draft.height_order ?? (selectedBlock as any).height_order ?? 0),
          dimensions_json: nextDims,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return showToast(json?.error || 'Không lưu được block')
      const updated: Block = json.data
      setDetail((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          blocks: (prev.blocks || []).map((b) => (b.id === updated.id ? updated : b)),
        }
      })
      setAssemblies((prev) => prev.map((a) => {
        if (a.id !== selectedAssemblyId) return a
        return {
          ...a,
          blocks: (a.blocks || []).map((b) => (b.id === updated.id ? updated : b)),
        }
      }))
      showToast('Đã lưu block')
    } finally {
      setSavingBlockId('')
    }
  }

  async function saveAllBlocks() {
    if (!selectedAssemblyId) return
    const changedBlocks = sourceBlocks.filter((b) => {
      const d = drafts[b.id]
      return d && Object.keys(d).length > 0
    })
    if (changedBlocks.length === 0) {
      showToast('Không có thay đổi để lưu')
      return
    }
    setSavingAll(true)
    try {
      for (const block of changedBlocks) {
        const draft = drafts[block.id] || {}
        const existing = block.dimensions_json && typeof block.dimensions_json === 'object'
          ? block.dimensions_json
          : {}
        const box = boxes.find((x) => x.block.id === block.id) || null
        const dims = blockDims(block, draft)
        let nextExtra: Record<string, any> = {}
        const rawExtra = String(draft.extra_json_text || '').trim()
        if (rawExtra) {
          try {
            const extraObj = JSON.parse(rawExtra)
            if (extraObj && typeof extraObj === 'object' && !Array.isArray(extraObj)) nextExtra = extraObj
          } catch {}
        }
        const existingX = Number((existing as any).x_m)
        const existingY = Number((existing as any).y_m)
        const nextDims = {
          ...existing,
          ...nextExtra,
          length_m: round2(snap01(draft.length_m ?? box?.length_m ?? dims.length)),
          height_m: round2(snap01(draft.height_m ?? box?.height_m ?? dims.height)),
          x_m: round2(snap01(draft.x_m ?? (Number.isFinite(existingX) ? existingX : 0))),
          y_m: round2(snap01(draft.y_m ?? (Number.isFinite(existingY) ? existingY : 0))),
          width_m: draft.width_m != null ? round2(snap01(draft.width_m)) : (existing as any).width_m,
          area_m2: draft.area_m2 != null ? round2(draft.area_m2) : (existing as any).area_m2,
          count: draft.count != null ? Math.max(1, Math.trunc(draft.count)) : (existing as any).count,
          room_type: draft.room_type != null ? draft.room_type : (existing as any).room_type,
          space_type: draft.space_type != null ? draft.space_type : (existing as any).space_type,
          space_profile: draft.space_profile != null ? draft.space_profile : (existing as any).space_profile,
          facade_role: draft.facade_role != null ? draft.facade_role : (existing as any).facade_role,
          foundation_type: draft.foundation_type != null ? draft.foundation_type : (existing as any).foundation_type,
          opening_preset: draft.opening_preset != null ? draft.opening_preset : (existing as any).opening_preset,
          has_ceiling: draft.has_ceiling != null ? Boolean(draft.has_ceiling) : Boolean((existing as any).has_ceiling),
          has_paint: draft.has_paint != null ? Boolean(draft.has_paint) : Boolean((existing as any).has_paint),
          has_electrical: draft.has_electrical != null ? Boolean(draft.has_electrical) : Boolean((existing as any).has_electrical),
          has_plumbing: draft.has_plumbing != null ? Boolean(draft.has_plumbing) : Boolean((existing as any).has_plumbing),
          has_window: draft.has_window != null ? Boolean(draft.has_window) : Boolean((existing as any).has_window),
          has_door: draft.has_door != null ? Boolean(draft.has_door) : Boolean((existing as any).has_door),
          locked: draft.locked != null ? Boolean(draft.locked) : Boolean((existing as any).locked),
          openings: draft.openings != null
            ? draft.openings
              .map((x) => normalizeOpeningDraft(x, round2(snap01(draft.length_m ?? box?.length_m ?? dims.length)), round2(snap01(draft.height_m ?? box?.height_m ?? dims.height)), draft.width_m != null ? round2(snap01(draft.width_m)) : Number((existing as any).width_m || dims.width || 4)))
              .filter(Boolean)
            : (existing as any).openings,
          wall_area_m2: draft.wall_area_m2 != null ? round2(draft.wall_area_m2) : (existing as any).wall_area_m2,
          wall_length_m: draft.wall_length_m != null ? round2(draft.wall_length_m) : (existing as any).wall_length_m,
        }
        await fetch(`/api/assemblies/blocks/${block.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            block_name: String(draft.block_name ?? block.block_name ?? '').trim() || null,
            component_type: String(draft.component_type ?? block.component_type ?? '').trim() || block.component_type,
            level_index: nat(draft.level_index ?? block.level_index),
            template_id: (draft.template_id !== undefined ? (String(draft.template_id || '').trim() || null) : (block as any).template_id ?? null),
            sort_order: nat(draft.sort_order ?? (block as any).sort_order ?? 0),
            length_order: nat(draft.length_order ?? (block as any).length_order ?? 0),
            height_order: nat(draft.height_order ?? (block as any).height_order ?? 0),
            dimensions_json: nextDims,
          }),
        })
      }
      await loadAssemblyDetail(selectedAssemblyId, true)
      await loadAssemblies(selectedAssemblyId)
      showToast(`Da luu ${changedBlocks.length} block`)
    } finally {
      setSavingAll(false)
    }
  }

  async function previewEstimateFromDesigner() {
    if (!selectedAssemblyId) return
    setPreviewing(true)
    try {
      const res = await fetch(`/api/assemblies/${selectedAssemblyId}/estimate-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.data) {
        showToast(json?.error || 'Không preview duoc')
        return
      }

      let preview2dImage: string | null = null
      try {
        const stage = stageRef.current
        if (stage?.toDataURL) {
          preview2dImage = stage.toDataURL({ pixelRatio: 2 })
        }
      } catch {}

      const ctx = {
        preview_result: json.data,
        input_payload: json.inferred_input || {},
        assembly: {
          id: detail?.id || selectedAssembly?.id,
          name: detail?.name || selectedAssembly?.name,
          customer_id: detail?.customer_id || selectedAssembly?.customer_id || null,
          customer_name: detail?.customer?.full_name || null,
          house_type: detail?.house_type || null,
          style: detail?.style || null,
          level: detail?.level || null,
          region_code: detail?.region_code || 'ALL',
        },
        blocks: detail?.blocks || selectedAssembly?.blocks || [],
        assembly_summary: json.assembly_summary || null,
        preview_images: {
          plan_2d: preview2dImage,
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

  async function cloneSelectedBlock() {
    if (!selectedAssemblyId || !selectedBlock) return
    const baseDims = (selectedBlock.dimensions_json && typeof selectedBlock.dimensions_json === 'object' ? selectedBlock.dimensions_json : {}) as Record<string, any>
    const d = drafts[selectedBlock.id] || {}
    const payload = {
      component_type: String(d.component_type ?? selectedBlock.component_type ?? '').trim() || selectedBlock.component_type,
      block_name: `${String(d.block_name ?? selectedBlock.block_name ?? selectedBlock.component_type)} (copy)`,
      level_index: nat(d.level_index ?? selectedBlock.level_index ?? 0),
      template_id: (d.template_id !== undefined ? (String(d.template_id || '').trim() || null) : (selectedBlock as any).template_id ?? null),
      sort_order: nat(d.sort_order ?? (selectedBlock as any).sort_order ?? 0),
      length_order: nat(d.length_order ?? (selectedBlock as any).length_order ?? 0),
      height_order: nat(d.height_order ?? (selectedBlock as any).height_order ?? 0),
      dimensions_json: {
        ...baseDims,
        x_m: round2(snap01((d.x_m ?? Number(baseDims.x_m) ?? 0) + 0.5)),
        y_m: round2(snap01(d.y_m ?? Number(baseDims.y_m) ?? 0)),
        length_m: round2(snap01(d.length_m ?? Number(baseDims.length_m) ?? 6)),
        height_m: round2(snap01(d.height_m ?? Number(baseDims.height_m) ?? 3.6)),
        width_m: d.width_m != null ? round2(snap01(d.width_m)) : baseDims.width_m,
        area_m2: d.area_m2 != null ? round2(d.area_m2) : baseDims.area_m2,
        count: d.count != null ? Math.max(1, Math.trunc(d.count)) : baseDims.count,
        room_type: d.room_type != null ? d.room_type : baseDims.room_type,
        space_type: d.space_type != null ? d.space_type : baseDims.space_type,
        space_profile: d.space_profile != null ? d.space_profile : baseDims.space_profile,
        facade_role: d.facade_role != null ? d.facade_role : baseDims.facade_role,
        foundation_type: d.foundation_type != null ? d.foundation_type : baseDims.foundation_type,
        has_ceiling: d.has_ceiling != null ? Boolean(d.has_ceiling) : Boolean(baseDims.has_ceiling),
        has_paint: d.has_paint != null ? Boolean(d.has_paint) : Boolean(baseDims.has_paint),
        has_electrical: d.has_electrical != null ? Boolean(d.has_electrical) : Boolean(baseDims.has_electrical),
        has_plumbing: d.has_plumbing != null ? Boolean(d.has_plumbing) : Boolean(baseDims.has_plumbing),
        has_window: d.has_window != null ? Boolean(d.has_window) : Boolean(baseDims.has_window),
        has_door: d.has_door != null ? Boolean(d.has_door) : Boolean(baseDims.has_door),
        wall_area_m2: d.wall_area_m2 != null ? round2(d.wall_area_m2) : baseDims.wall_area_m2,
        wall_length_m: d.wall_length_m != null ? round2(d.wall_length_m) : baseDims.wall_length_m,
        locked: d.locked != null ? Boolean(d.locked) : Boolean(baseDims.locked),
      },
    }
    const res = await fetch(`/api/assemblies/${selectedAssemblyId}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(json?.error || 'Không clone được block')
    await loadAssemblyDetail(selectedAssemblyId, true)
    showToast('Da clone block')
  }

  async function cloneCurrentLevelToNext() {
    if (!selectedAssemblyId) return
    const sourceLevel = selectedBlock ? nat(selectedBlock.level_index) : (selectedLevel === 'all' ? (levels[0] || 0) : nat(selectedLevel))
    const targetLevel = sourceLevel + 1
    const levelBlocks = sourceBlocks.filter((b) => nat(b.level_index) === sourceLevel)
    if (!levelBlocks.length) return showToast('Không có block để clone tầng')
    for (const b of levelBlocks) {
      const baseDims = (b.dimensions_json && typeof b.dimensions_json === 'object' ? b.dimensions_json : {}) as Record<string, any>
      const d = drafts[b.id] || {}
      const payload = {
        component_type: String(d.component_type ?? b.component_type ?? '').trim() || b.component_type,
        block_name: `${String(d.block_name ?? b.block_name ?? b.component_type)} (L${targetLevel})`,
        level_index: targetLevel,
        template_id: (d.template_id !== undefined ? (String(d.template_id || '').trim() || null) : (b as any).template_id ?? null),
        sort_order: nat(d.sort_order ?? (b as any).sort_order ?? 0),
        length_order: nat(d.length_order ?? (b as any).length_order ?? 0),
        height_order: nat(d.height_order ?? (b as any).height_order ?? 0),
        dimensions_json: {
          ...baseDims,
          x_m: round2(snap01(d.x_m ?? Number(baseDims.x_m) ?? 0)),
          y_m: round2(snap01(d.y_m ?? Number(baseDims.y_m) ?? 0)),
          length_m: round2(snap01(d.length_m ?? Number(baseDims.length_m) ?? 6)),
          height_m: round2(snap01(d.height_m ?? Number(baseDims.height_m) ?? 3.6)),
          width_m: d.width_m != null ? round2(snap01(d.width_m)) : baseDims.width_m,
          area_m2: d.area_m2 != null ? round2(d.area_m2) : baseDims.area_m2,
          count: d.count != null ? Math.max(1, Math.trunc(d.count)) : baseDims.count,
          room_type: d.room_type != null ? d.room_type : baseDims.room_type,
          space_type: d.space_type != null ? d.space_type : baseDims.space_type,
          space_profile: d.space_profile != null ? d.space_profile : baseDims.space_profile,
          facade_role: d.facade_role != null ? d.facade_role : baseDims.facade_role,
          foundation_type: d.foundation_type != null ? d.foundation_type : baseDims.foundation_type,
          has_ceiling: d.has_ceiling != null ? Boolean(d.has_ceiling) : Boolean(baseDims.has_ceiling),
          has_paint: d.has_paint != null ? Boolean(d.has_paint) : Boolean(baseDims.has_paint),
          has_electrical: d.has_electrical != null ? Boolean(d.has_electrical) : Boolean(baseDims.has_electrical),
          has_plumbing: d.has_plumbing != null ? Boolean(d.has_plumbing) : Boolean(baseDims.has_plumbing),
          has_window: d.has_window != null ? Boolean(d.has_window) : Boolean(baseDims.has_window),
          has_door: d.has_door != null ? Boolean(d.has_door) : Boolean(baseDims.has_door),
          wall_area_m2: d.wall_area_m2 != null ? round2(d.wall_area_m2) : baseDims.wall_area_m2,
          wall_length_m: d.wall_length_m != null ? round2(d.wall_length_m) : baseDims.wall_length_m,
          locked: d.locked != null ? Boolean(d.locked) : Boolean(baseDims.locked),
        },
      }
      await fetch(`/api/assemblies/${selectedAssemblyId}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    await loadAssemblyDetail(selectedAssemblyId, true)
    showToast(`Da clone tang ${sourceLevel} -> ${targetLevel}`)
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
          ASSEMBLY DESIGNER 2D
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>{'Gh\u00e9p block 2D'}</h1>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 12, display: 'grid', gap: 12 }}>
        <FoldSection title="TẠO ASSEMBLY MỚI">
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 10, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'T\u00ean assembly m\u1edbi'}</div>
              <input className="input" value={newAssemblyName} onChange={(e) => setNewAssemblyName(e.target.value)} />
            </div>
            <button className="btn-primary" onClick={createAssemblyQuick}>{'+ T\u1ea1o assembly'}</button>
            <button className="btn btn-ghost" onClick={deleteCurrentAssembly} style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)', color: 'var(--red)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}>
              {'X\u00f3a assembly'}
            </button>
          </div>
        </FoldSection>

        <FoldSection title="THÔNG TIN ASSEMBLY">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr)) auto', gap: 10, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'T\u00ean assembly'}</div>
              <input className="input" value={assemblyForm.name} onChange={(e) => setAssemblyForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'Kh\u00e1ch h\u00e0ng'}</div>
              <select className="select" value={assemblyForm.customer_id} onChange={(e) => setAssemblyForm((p) => ({ ...p, customer_id: e.target.value }))}>
                <option value="">{'Kh\u00f4ng ch\u1ecdn kh\u00e1ch h\u00e0ng'}</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{(c.full_name?.trim() || 'Kh\u00e1ch')} - {c.phone_number || c.id}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'Lo\u1ea1i nh\u00e0'}</div>
              <select className="select" value={assemblyForm.house_type} onChange={(e) => setAssemblyForm((p) => ({ ...p, house_type: e.target.value }))}>
                <option value="">{'Ch\u1ecdn lo\u1ea1i nh\u00e0'}</option>
                {taxonomies.filter((x) => x.kind === 'house_type' && x.is_active).map((x) => <option key={x.id} value={x.value}>{x.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'Phong c\u00e1ch'}</div>
              <select className="select" value={assemblyForm.style} onChange={(e) => setAssemblyForm((p) => ({ ...p, style: e.target.value }))}>
                <option value="">{'Ch\u1ecdn phong c\u00e1ch'}</option>
                {taxonomies.filter((x) => x.kind === 'style' && x.is_active).map((x) => <option key={x.id} value={x.value}>{x.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'M\u1ee9c ho\u00e0n thi\u1ec7n'}</div>
              <select className="select" value={assemblyForm.level} onChange={(e) => setAssemblyForm((p) => ({ ...p, level: e.target.value }))}>
                {taxonomies.filter((x) => x.kind === 'level' && x.is_active).map((x) => <option key={x.id} value={x.value}>{x.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'V\u00f9ng gi\u00e1'}</div>
              <select className="select" value={assemblyForm.region_code} onChange={(e) => setAssemblyForm((p) => ({ ...p, region_code: e.target.value }))}>
                {regions.map((r) => <option key={r.code} value={r.code}>{r.code} - {r.name}</option>)}
              </select>
            </div>
            <button className="btn-primary" onClick={saveCurrentAssembly}>{'L\u01b0u assembly'}</button>
          </div>
        </FoldSection>

        <FoldSection title="ĐIỀU KHIỂN THAO TÁC">
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr .9fr .9fr auto auto auto auto', gap: 10, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'Assembly \u0111ang ch\u1ecdn'}</div>
              <select className="select" value={selectedAssemblyId} onChange={(e) => setSelectedAssemblyId(e.target.value)}>
                {assemblies.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.id.slice(0, 8)})</option>
                ))}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={assemblyPagination.page <= 1}
                  onClick={() => setAssemblyPage((p) => Math.max(1, p - 1))}
                  style={{ borderRadius: 8, padding: '6px 10px', cursor: assemblyPagination.page <= 1 ? 'not-allowed' : 'pointer' }}
                >
                  {'Trang trước'}
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={assemblyPagination.page >= assemblyPagination.totalPages}
                  onClick={() => setAssemblyPage((p) => Math.min(assemblyPagination.totalPages, p + 1))}
                  style={{ borderRadius: 8, padding: '6px 10px', cursor: assemblyPagination.page >= assemblyPagination.totalPages ? 'not-allowed' : 'pointer' }}
                >
                  {'Trang sau'}
                </button>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {`Trang ${assemblyPagination.page}/${assemblyPagination.totalPages} - ${assemblyPagination.total} assembly`}
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'T\u1ea7ng hi\u1ec3n th\u1ecb'}</div>
              <select className="select" value={String(selectedLevel)} onChange={(e) => setSelectedLevel(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                <option value="all">{'T\u1ea5t c\u1ea3 t\u1ea7ng'}</option>
                {levels.map((lv) => <option key={lv} value={lv}>{'T\u1ea7ng '}{lv}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'Preset b\u1ed1 c\u1ee5c'}</div>
              <select className="select" value={layoutPreset} onChange={(e) => setLayoutPreset(e.target.value as LayoutPresetKey)}>
                <option value="zero">Zero (0m)</option>
                <option value="compact">{'G\u1ea7n'}</option>
                <option value="standard">{'Chu\u1ea9n'}</option>
                <option value="spacious">{'R\u1ed9ng'}</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Chế độ thao tác</div>
              <select className="select" value={editorMode} onChange={(e) => setEditorMode(e.target.value as EditorMode)}>
                <option value="quick">Nhanh</option>
                <option value="standard">Chuẩn</option>
                <option value="advanced">Nâng cao</option>
              </select>
            </div>
            <button className="btn-primary" onClick={previewEstimateFromDesigner} disabled={previewing}>{previewing ? '\u0110ang preview...' : 'Xem trước dự toán'}</button>
            <button className="btn-primary" onClick={runAutoLayout2D}>Tự dàn bố cục</button>
            {editorMode !== 'quick' ? <button className="btn btn-ghost" onClick={cloneSelectedBlock} disabled={!selectedBlock} style={{ borderRadius: 10, padding: '10px 14px', cursor: !selectedBlock ? 'not-allowed' : 'pointer' }}>Clone block</button> : <></>}
            {editorMode !== 'quick' ? <button className="btn btn-ghost" onClick={cloneCurrentLevelToNext} disabled={sourceBlocks.length === 0} style={{ borderRadius: 10, padding: '10px 14px', cursor: sourceBlocks.length === 0 ? 'not-allowed' : 'pointer' }}>{'Clone t\u1ea7ng +1'}</button> : <></>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            M\u00e0u block b\u1ea3n 2D \u0111ang t\u1ef1 \u0111\u1ed9c theo preset hi\u1ec3n th\u1ecb v\u00e0 m\u00e0u t\u00f9y ch\u1ec9nh \u0111\u00e3 ch\u1ecdn \u1edf Designer 3D.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, alignItems: 'end' }}>
            {editorMode !== 'quick' ? <button className="btn btn-ghost" onClick={undoLastDraftChange} disabled={undoStack.length === 0} style={{ borderRadius: 10, padding: '10px 14px', cursor: undoStack.length === 0 ? 'not-allowed' : 'pointer' }}>Undo</button> : <></>}
            {editorMode !== 'quick' ? <button className="btn btn-ghost" onClick={redoLastDraftChange} disabled={redoStack.length === 0} style={{ borderRadius: 10, padding: '10px 14px', cursor: redoStack.length === 0 ? 'not-allowed' : 'pointer' }}>Redo</button> : <></>}
            {editorMode === 'advanced' ? <button className="btn-primary" onClick={() => selectedBlockId && saveSelectedBlock()} disabled={!selectedBlockId || savingBlockId === selectedBlockId}>{savingBlockId === selectedBlockId ? '\u0110ang l\u01b0u...' : 'L\u01b0u block \u0111ang ch\u1ecdn'}</button> : <></>}
            <button className="btn-primary" onClick={saveAllBlocks} disabled={savingAll}>{savingAll ? '\u0110ang l\u01b0u t\u1ea5t c\u1ea3...' : 'L\u01b0u t\u1ea5t c\u1ea3'}</button>
          </div>
        </FoldSection>

        <FoldSection title="THÊM BLOCK MỚI">
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr .7fr 1.2fr .7fr .7fr .7fr auto auto', gap: 10, alignItems: 'end' }}>
            <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'T\u00ean block'}</div><input className="input" value={newBlock.block_name} onChange={(e) => setNewBlock((p) => ({ ...p, block_name: e.target.value }))} /></div>
            <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'Lo\u1ea1i block'}</div><select className="select" value={newBlock.component_type} onChange={(e) => setNewBlock((p) => sanitizeBlockDraftByComponentType(e.target.value, { ...p, component_type: e.target.value }))}>{taxonomies.filter((x) => x.kind === 'assembly_component_type' && x.is_active).map((x) => <option key={x.id} value={x.value}>{x.name}</option>)}</select></div>
            <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'T\u1ea7ng'}</div><input className="input" value={newBlock.level_index} onChange={(e) => setNewBlock((p) => ({ ...p, level_index: e.target.value }))} /></div>
            <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Template</div><select className="select" value={newBlock.template_id} onChange={(e) => setNewBlock((p) => ({ ...p, template_id: e.target.value }))}><option value="">{'Kh\u00f4ng ch\u1ecdn template'}</option>{templates.filter((t) => t.is_active !== false).map((t) => <option key={t.id} value={t.id}>{t.template_name} ({t.template_code})</option>)}</select></div>
            <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Sort</div><input className="input" value={newBlock.sort_order} onChange={(e) => setNewBlock((p) => ({ ...p, sort_order: e.target.value }))} /></div>
            <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'Order d\u1ecdc'}</div><input className="input" value={newBlock.length_order} onChange={(e) => setNewBlock((p) => ({ ...p, length_order: e.target.value }))} /></div>
            <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Order ngang</div><input className="input" value={newBlock.height_order} onChange={(e) => setNewBlock((p) => ({ ...p, height_order: e.target.value }))} /></div>
            <button className="btn-primary" onClick={addBlockQuick}>{'+ Th\u00eam block'}</button>
            <button className="btn btn-ghost" onClick={deleteSelectedBlock} disabled={!selectedBlockId} style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)', color: 'var(--red)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}>{'X\u00f3a block \u0111\u00e3 ch\u1ecdn'}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: 10 }}>
            <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'Chi\u1ec1u d\u00e0i (m)'}</div><input className="input" value={newBlock.length_m} onChange={(e) => setNewBlock((p) => ({ ...p, length_m: e.target.value }))} /></div>
            <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'Chi\u1ec1u cao (m)'}</div><input className="input" value={newBlock.height_m} onChange={(e) => setNewBlock((p) => ({ ...p, height_m: e.target.value }))} /></div>
            <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'Chi\u1ec1u r\u1ed9ng (m)'}</div><input className="input" placeholder={'Kh\u00f4ng b\u1eaft bu\u1ed9c'} value={newBlock.width_m} onChange={(e) => setNewBlock((p) => ({ ...p, width_m: e.target.value }))} /></div>
            <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'Di\u1ec7n t\u00edch (m2)'}</div><input className="input" placeholder={'Kh\u00f4ng b\u1eaft bu\u1ed9c'} value={newBlock.area_m2} onChange={(e) => setNewBlock((p) => ({ ...p, area_m2: e.target.value }))} /></div>
            <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'S\u1ed1 l\u01b0\u1ee3ng'}</div><input className="input" value={newBlock.count} onChange={(e) => setNewBlock((p) => ({ ...p, count: e.target.value }))} /></div>
            {newBlockFieldFlags.isWall ? <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'Di\u1ec7n t\u00edch t\u01b0\u1eddng (m2)'}</div><input className="input" placeholder={'Kh\u00f4ng b\u1eaft bu\u1ed9c'} value={newBlock.wall_area_m2} onChange={(e) => setNewBlock((p) => ({ ...p, wall_area_m2: e.target.value }))} /></div> : <div />}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
            {newBlockFieldFlags.isWall ? <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'Chi\u1ec1u d\u00e0i t\u01b0\u1eddng (m)'}</div><input className="input" placeholder={'Kh\u00f4ng b\u1eaft bu\u1ed9c'} value={newBlock.wall_length_m} onChange={(e) => setNewBlock((p) => ({ ...p, wall_length_m: e.target.value }))} /></div> : <div />}
            {newBlockFieldFlags.isRoom ? <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'Lo\u1ea1i ph\u00f2ng'}</div><select className="select" value={newBlock.room_type} onChange={(e) => setNewBlock((p) => ({ ...p, room_type: e.target.value }))}><option value="">{'Kh\u00f4ng ch\u1ecdn'}</option>{newBlockRoomTypeOptions.map((x) => <option key={x.id} value={x.value}>{x.name}</option>)}</select></div> : <div />}
            {newBlockFieldFlags.isRoom ? <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>{'Kh\u00f4ng gian ch\u00ednh'}<span title="Cho biet block nay dang phuc vu khong gian nao nhu phong khach, phong ngu, bep, WC. Day la semantic chinh de goi y template va boc tach." style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 999, border: '1px solid var(--border)', color: 'var(--text4)', cursor: 'help', fontSize: 11, lineHeight: 1 }}>?</span></div><select className="select" value={newBlock.space_type} onChange={(e) => setNewBlock((p) => ({ ...p, space_type: e.target.value }))}><option value="">{'Kh\u00f4ng ch\u1ecdn'}</option>{newBlockSpaceTypeOptions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></div> : <div />}
            {newBlockFieldFlags.isRoom ? <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>{'M\u1ee9c kh\u00f4ng gian'}<span title="Cho biet muc do hoan thien hay tinh chat su dung cua khong gian, vi du co ban, tiet kiem, cao cap, phu tro." style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 999, border: '1px solid var(--border)', color: 'var(--text4)', cursor: 'help', fontSize: 11, lineHeight: 1 }}>?</span></div><select className="select" value={newBlock.space_profile} onChange={(e) => setNewBlock((p) => ({ ...p, space_profile: e.target.value }))}><option value="">{'Kh\u00f4ng ch\u1ecdn'}</option>{SPACE_PROFILE_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></div> : <div />}
            {newBlockFieldFlags.supportsFacade ? <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>{'Vai tr\u00f2 m\u1eb7t ti\u1ec1n'}<span title="Danh dau block nao la mat ngoai can boc facade. Mat tien chinh se uu tien keo template facade, khoi ben trong thi khong." style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 999, border: '1px solid var(--border)', color: 'var(--text4)', cursor: 'help', fontSize: 11, lineHeight: 1 }}>?</span></div><select className="select" value={String(newBlock.facade_role || '')} onChange={(e) => setNewBlock((p) => ({ ...p, facade_role: e.target.value }))}><option value="">{'Kh\u00f4ng ch\u1ecdn'}</option>{newBlockFacadeRoleOptions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></div> : <div />}
          </div>
          {newBlockFieldFlags.allowsOpenings ? <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 320px) 1fr', gap: 10, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>{'Preset \u00f4 m\u1edf'}<span title="Mau o mo mac dinh cho block. Neu chua khai bao danh sach cua/cua so chi tiet, canvas va preview se fallback theo preset nay." style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 999, border: '1px solid var(--border)', color: 'var(--text4)', cursor: 'help', fontSize: 11, lineHeight: 1 }}>?</span></div>
              <select className="select" value={String(newBlock.opening_preset || '')} onChange={(e) => setNewBlock((p) => ({ ...p, opening_preset: e.target.value }))}>
                <option value="">{'Kh\u00f4ng d\u00f9ng preset'}</option>
                {newBlockOpeningPresetOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {'N\u1ebfu ch\u01b0a khai b\u00e1o danh s\u00e1ch c\u1eeda / c\u1eeda s\u1ed5 chi ti\u1ebft, block m\u1edbi s\u1ebd hi\u1ec7n fallback theo preset n\u00e0y tr\u00ean canvas.'}
            </div>
          </div> : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
            {newBlockFieldFlags.isFoundation ? <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'Lo\u1ea1i m\u00f3ng'}</div><select className="select" value={newBlock.foundation_type} onChange={(e) => setNewBlock((p) => ({ ...p, foundation_type: e.target.value }))}><option value="">{'Kh\u00f4ng ch\u1ecdn'}</option>{taxonomies.filter((x) => x.kind === 'foundation_type' && x.is_active).map((x) => <option key={x.id} value={x.value}>{x.name}</option>)}</select></div> : <div />}
            <div><div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'Tr\u1ea1ng th\u00e1i kh\u00f3a'}</div><select className="select" value={String(newBlock.locked)} onChange={(e) => setNewBlock((p) => ({ ...p, locked: e.target.value === 'true' }))}><option value="false">{'Block m\u1edf kh\u00f3a'}</option><option value="true">{'Block kh\u00f3a'}</option></select></div>
          </div>
          {newBlockFieldFlags.allowedFeatureKeys.size > 0 ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
            {BLOCK_FEATURE_OPTIONS.filter((feature) => newBlockFieldFlags.allowedFeatureKeys.has(feature.key)).map((feature) => (
              <label key={String(feature.key)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)' }}>
                <input type="checkbox" checked={Boolean((newBlock as any)[feature.key])} onChange={(e) => setNewBlock((p) => ({ ...p, [feature.key]: e.target.checked }))} />
                <span>{feature.label}</span>
              </label>
            ))}
          </div> : null}
        </FoldSection>

        <FoldSection title="THU PHONG">
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 120px auto auto 1fr', gap: 8, alignItems: 'end', maxWidth: 460 }}>
            <button className="btn btn-ghost" onClick={() => setZoom(scalePxPerM - 2)} style={{ borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>-</button>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{'T\u1ef7 l\u1ec7 px / m'}</div>
              <input className="input" value={String(scalePxPerM)} onChange={(e) => setZoom(Number(e.target.value))} />
            </div>
            <button className="btn btn-ghost" onClick={() => setZoom(scalePxPerM + 2)} style={{ borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>+</button>
            <button className="btn btn-ghost" onClick={() => setZoom(18)} style={{ borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>1x</button>
            <div style={{ fontSize: 12, color: 'var(--text4)', alignSelf: 'center' }}>{'Ctrl + wheel \u0111\u1ec3 zoom nhanh'}</div>
          </div>
        </FoldSection>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12 }}>
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: 30, fontSize: 12, color: 'var(--text3)' }}>Đang tải...</div>
          ) : error ? (
            <div style={{ padding: 30, fontSize: 12, color: 'var(--red)' }}>{error}</div>
          ) : !selectedAssembly ? (
            <div style={{ padding: 30, fontSize: 12, color: 'var(--text3)' }}>Chưa có assembly.</div>
          ) : (
            <Stage
              ref={stageRef}
              width={canvasSize.width + rulerSize}
              height={canvasSize.height + rulerSize}
              style={{ background: 'linear-gradient(180deg, #0f172a, #111827)' }}
              onMouseDown={() => setSelectedBlockId('')}
              onWheel={(e) => {
                if (!e.evt.ctrlKey) return
                e.evt.preventDefault()
                const dir = e.evt.deltaY > 0 ? -1 : 1
                setZoom(scalePxPerM + dir * 2)
              }}
            >
              <Layer>
                <Rect x={0} y={0} width={canvasSize.width + rulerSize} height={rulerSize} fill="#0b1220" />
                <Rect x={0} y={0} width={rulerSize} height={canvasSize.height + rulerSize} fill="#0b1220" />
                <Rect x={0} y={0} width={rulerSize} height={rulerSize} fill="#111827" />

                {Array.from({ length: Math.ceil(canvasSize.width / (scalePxPerM * GRID_STEP_M)) + 1 }).map((_, i) => {
                  const meters = i * GRID_STEP_M
                  const x = rulerSize + meters * scalePxPerM
                  const major = Math.abs(meters % 1) < 1e-9
                  return (
                    <Fragment key={`grid-v-${i}`}>
                      <Line points={[x, rulerSize, x, canvasSize.height + rulerSize]} stroke={major ? 'rgba(148,163,184,.20)' : 'rgba(148,163,184,.10)'} strokeWidth={1} />
                      <Line points={[x, rulerSize, x, major ? rulerSize + 10 : rulerSize + 6]} stroke="rgba(226,232,240,.8)" strokeWidth={1} />
                      {major && <Text x={x + 2} y={4} text={`${meters}`} fontSize={10} fill="#cbd5e1" />}
                    </Fragment>
                  )
                })}
                {Array.from({ length: Math.ceil(canvasSize.height / (scalePxPerM * GRID_STEP_M)) + 1 }).map((_, i) => {
                  const meters = i * GRID_STEP_M
                  const y = rulerSize + (canvasSize.height - meters * scalePxPerM)
                  const major = Math.abs(meters % 1) < 1e-9
                  return (
                    <Fragment key={`grid-h-${i}`}>
                      <Line points={[rulerSize, y, canvasSize.width + rulerSize, y]} stroke={major ? 'rgba(148,163,184,.20)' : 'rgba(148,163,184,.10)'} strokeWidth={1} />
                      <Line points={[rulerSize, y, major ? rulerSize + 10 : rulerSize + 6, y]} stroke="rgba(226,232,240,.8)" strokeWidth={1} />
                      {major && <Text x={2} y={y - 6} text={`${meters}`} fontSize={10} fill="#cbd5e1" />}
                    </Fragment>
                  )
                })}

                {boxesForRender.map((b) => {
                  const fill = getComponentDisplayColor(b.block.component_type)
                  const active = b.block.id === selectedBlockId
                  const overlapHit = overlappedIds.has(b.block.id)
                  const locked = isBlockLocked(b.block, drafts[b.block.id])
                  const yDraw = yDisplayFromLogical(b.y, b.h)
                  const openingRects = (() => {
                    const boxForOpenings = {
                      ...b,
                      y: yDraw,
                    }
                    const custom = getOpeningRects2D(boxForOpenings, b.block, drafts[b.block.id])
                    return custom.length > 0 ? custom : getOpeningPresetRects2D(boxForOpenings, b.block, drafts[b.block.id], taxonomies)
                  })()
                  return (
                    <Fragment key={b.block.id}>
                      <Rect
                        x={b.x + rulerSize}
                        y={yDraw + rulerSize}
                        width={b.w}
                        height={b.h}
                        fill={fill}
                        opacity={active ? 0.44 : 0.3}
                        stroke={active ? '#f8fafc' : overlapHit ? '#fbbf24' : fill}
                        strokeWidth={active ? 3 : overlapHit ? 2.5 : 2}
                        cornerRadius={6}
                        draggable={!locked}
                        onMouseDown={(e) => {
                          e.cancelBubble = true
                          setSelectedBlockId(b.block.id)
                        }}
                        onDragEnd={(e) => {
                          const xPx = e.target.x()
                          const yPx = e.target.y()
                          const xMRaw = (xPx - rulerSize - CANVAS_PADDING) / scalePxPerM
                          const yLogical = logicalYFromDisplay(yPx - rulerSize, b.h)
                          const yMRaw = (yLogical - CANVAS_PADDING) / scalePxPerM
                          updateDraft(b.block.id, {
                            x_m: round2(snap01(xMRaw)),
                            y_m: round2(snap01(yMRaw)),
                          })
                        }}
                      />
                      {openingRects.map((openingRect) => (
                        <Fragment key={openingRect.key}>
                          <Rect
                            x={openingRect.x + rulerSize}
                            y={openingRect.y + rulerSize}
                            width={openingRect.w}
                            height={openingRect.h}
                            fill={openingRect.color}
                            opacity={0.9}
                            stroke={active && selectedOpeningIndex === openingRect.index ? '#f8fafc' : '#e2e8f0'}
                            strokeWidth={active && selectedOpeningIndex === openingRect.index ? 2 : 1}
                            dash={openingRect.dash}
                            onMouseDown={(e) => {
                              e.cancelBubble = true
                              setSelectedBlockId(b.block.id)
                              setSelectedOpeningIndex(openingRect.index)
                            }}
                          />
                          <Text
                            x={openingRect.x + rulerSize + 1}
                            y={openingRect.y + rulerSize + Math.max(0, openingRect.h / 2 - 5)}
                            width={Math.max(10, openingRect.w - 2)}
                            align="center"
                            text={openingRect.label}
                            fontSize={10}
                            fontStyle="bold"
                            fill={openingRect.type === 'window' ? '#0f172a' : '#f8fafc'}
                            listening={false}
                          />
                        </Fragment>
                      ))}
                      <Text
                        x={b.x + rulerSize + 6}
                        y={yDraw + rulerSize + 6}
                        width={Math.max(30, b.w - 12)}
                        text={`${b.label}${locked ? ' [LOCK]' : ''}`}
                        fill="#e2e8f0"
                        fontSize={12}
                        lineHeight={1.2}
                        listening={false}
                      />
                      {active && !locked && (
                        <Circle
                          x={b.x + b.w + rulerSize}
                          y={yDraw + b.h + rulerSize}
                          radius={7}
                          fill="#f8fafc"
                          stroke="#1f2937"
                          strokeWidth={1}
                          draggable
                          onDragMove={(e) => {
                            const nx = e.target.x()
                            const ny = e.target.y()
                            const wPx = Math.max(MIN_BLOCK_RENDER_PX, nx - (b.x + rulerSize))
                            const hPx = Math.max(MIN_BLOCK_RENDER_PX, ny - (yDraw + rulerSize))
                            const lenRaw = wPx / scalePxPerM
                            const widRaw = hPx / scalePxPerM
                            const minM = minSizeByComponentType(b.block.component_type)
                            updateDraft(b.block.id, {
                              length_m: round2(Math.max(minM, snap01(lenRaw))),
                              height_m: round2(Math.max(minM, snap01(widRaw))),
                            }, { history: false })
                          }}
                          onDragEnd={(e) => {
                            const nx = e.target.x()
                            const ny = e.target.y()
                            const wPx = Math.max(MIN_BLOCK_RENDER_PX, nx - (b.x + rulerSize))
                            const hPx = Math.max(MIN_BLOCK_RENDER_PX, ny - (yDraw + rulerSize))
                            const lenRaw = wPx / scalePxPerM
                            const widRaw = hPx / scalePxPerM
                            const minM = minSizeByComponentType(b.block.component_type)
                            updateDraft(b.block.id, {
                              length_m: round2(Math.max(minM, snap01(lenRaw))),
                              height_m: round2(Math.max(minM, snap01(widRaw))),
                            })
                          }}
                          onMouseDown={(e) => {
                            e.cancelBubble = true
                            setSelectedBlockId(b.block.id)
                          }}
                        />
                      )}
                    </Fragment>
                  )
                })}
              </Layer>
            </Stage>
          )}
        </div>

        <div className="card" style={{ padding: 12 }}>
          <details style={{ border: '1px solid var(--border)', borderRadius: 12 }}>
            <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '10px 12px', fontSize: 11, letterSpacing: 1.2, color: 'var(--text4)', fontWeight: 700 }}>
              CHI TIẾT BLOCK
            </summary>
            <div style={{ padding: 12 }}>
          {!selectedBlock || !selectedBox ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chọn 1 block để sửa nhanh.</div>
              <div style={{ fontSize: 11, color: 'var(--text4)' }}>
                Danh sách theo thứ tự: `level_index` - `height_order` - `length_order`
              </div>
              <div style={{ maxHeight: 420, overflowY: 'auto', display: 'grid', gap: 6 }}>
                {sortedBlocksForPick.map((b: any) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBlockId(b.id)}
                    style={{
                      textAlign: 'left',
                      background: 'rgba(59,130,246,.10)',
                      border: '1px solid rgba(59,130,246,.25)',
                      color: 'var(--text2)',
                      borderRadius: 8,
                      padding: '7px 9px',
                      cursor: 'pointer',
                      fontSize: 11,
                    }}
                  >
                    {b.block_name || b.component_type} {isBlockLocked(b, drafts[b.id]) ? '[LOCK]' : ''} | L{Number(b.level_index) || 0} | H{Number((b as any).height_order) || 0} | X{Number((b as any).length_order) || 0}
                  </button>
                ))}
                {sortedBlocksForPick.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text4)' }}>Không có block nào trong bộ lọc hiện tại.</div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>{selectedBlock.block_name || selectedBlock.component_type}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Template: {selectedBlock.template?.template_name || '-'}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Tầng: {selectedBlock.level_index}</div>
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Tên block</label>
              <input
                className="input"
                value={String(drafts[selectedBlock.id]?.block_name ?? selectedBlock.block_name ?? '')}
                onChange={(e) => updateDraft(selectedBlock.id, { block_name: e.target.value })}
              />
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Loại block</label>
              <select
                className="select"
                value={String(drafts[selectedBlock.id]?.component_type ?? selectedBlock.component_type ?? '')}
                onChange={(e) => updateDraft(selectedBlock.id, { component_type: e.target.value })}
              >
                {taxonomies.filter((x) => x.kind === 'assembly_component_type' && x.is_active).map((x) => <option key={x.id} value={x.value}>{x.name}</option>)}
              </select>
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Tầng</label>
              <input
                className="input"
                value={String(drafts[selectedBlock.id]?.level_index ?? selectedBlock.level_index ?? 0)}
                onChange={(e) => updateDraft(selectedBlock.id, { level_index: nat(e.target.value) })}
              />
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Template</label>
              <select
                className="select"
                value={String(drafts[selectedBlock.id]?.template_id ?? (selectedBlock as any).template_id ?? '')}
                onChange={(e) => updateDraft(selectedBlock.id, { template_id: e.target.value })}
              >
                <option value="">(không chọn template)</option>
                {templates.filter((t) => t.is_active !== false).map((t) => <option key={t.id} value={t.id}>{t.template_name} ({t.template_code})</option>)}
              </select>
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Thứ tự sort</label>
              <input
                className="input"
                value={String(drafts[selectedBlock.id]?.sort_order ?? (selectedBlock as any).sort_order ?? 0)}
                onChange={(e) => updateDraft(selectedBlock.id, { sort_order: nat(e.target.value) })}
              />
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Thứ tự dọc</label>
              <input
                className="input"
                value={String(drafts[selectedBlock.id]?.length_order ?? (selectedBlock as any).length_order ?? 0)}
                onChange={(e) => updateDraft(selectedBlock.id, { length_order: nat(e.target.value) })}
              />
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Thứ tự ngang</label>
              <input
                className="input"
                value={String(drafts[selectedBlock.id]?.height_order ?? (selectedBlock as any).height_order ?? 0)}
                onChange={(e) => updateDraft(selectedBlock.id, { height_order: nat(e.target.value) })}
              />
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Khóa block</label>
              <select
                className="select"
                value={String(Boolean(drafts[selectedBlock.id]?.locked ?? (selectedBlock.dimensions_json as any)?.locked))}
                onChange={(e) => updateDraft(selectedBlock.id, { locked: e.target.value === 'true' })}
              >
                <option value="false">Mở khóa</option>
                <option value="true">Khóa</option>
              </select>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                Tọa độ / kích thước: x={round2(drafts[selectedBlock.id]?.x_m ?? ((selectedBox.x - CANVAS_PADDING) / scalePxPerM))}m, y={round2(drafts[selectedBlock.id]?.y_m ?? yMetersFromBox(selectedBox))}m, L={round2(drafts[selectedBlock.id]?.length_m ?? selectedBox.length_m)}m, H={round2(drafts[selectedBlock.id]?.height_m ?? selectedBox.height_m)}m
              </div>
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Block đang bị đè / chồng lấp với block này</label>
              {overlappedBoxes.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text4)' }}>Không có block nào đang chồng lấp.</div>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {overlappedBoxes.map((row) => (
                    <button
                      key={row.box.block.id}
                      onClick={() => setSelectedBlockId(row.box.block.id)}
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
                      {row.box.block.block_name || row.box.block.component_type} | chồng lấp {round2(row.areaPx / (scalePxPerM * scalePxPerM))} m2
                    </button>
                  ))}
                </div>
              )}
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Đặt đè lên block khác</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
                <select
                  className="select"
                  value={stackTargetBlockId}
                  onChange={(e) => setStackTargetBlockId(e.target.value)}
                >
                  <option value="">(chọn block đích)</option>
                  {boxes
                    .filter((b) => b.block.id !== selectedBlock.id)
                    .map((b) => (
                      <option key={b.block.id} value={b.block.id}>
                        {b.block.block_name || b.block.component_type}
                      </option>
                    ))}
                </select>
                <button
                  className="btn-primary"
                  onClick={stackSelectedBlockOnTop2D}
                  disabled={!stackTargetBox}
                >
                  Đặt đè lên
                </button>
              </div>
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>X (m)</label>
              <input
                className="input"
                value={readNumInput(selectedBlock.id, 'x_m', drafts[selectedBlock.id]?.x_m ?? round2((selectedBox.x - CANVAS_PADDING) / scalePxPerM))}
                onChange={(e) => writeNumInput(selectedBlock.id, 'x_m', e.target.value, (v) => updateDraft(selectedBlock.id, { x_m: round2(snap01(v)) }))}
                onBlur={() => commitNumInput(selectedBlock.id, 'x_m')}
              />
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Y (m)</label>
              <input
                className="input"
                value={readNumInput(selectedBlock.id, 'y_m', drafts[selectedBlock.id]?.y_m ?? yMetersFromBox(selectedBox))}
                onChange={(e) => writeNumInput(selectedBlock.id, 'y_m', e.target.value, (v) => updateDraft(selectedBlock.id, { y_m: round2(snap01(v)) }))}
                onBlur={() => commitNumInput(selectedBlock.id, 'y_m')}
              />
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Chiều dài (m)</label>
              <input
                className="input"
                value={readNumInput(selectedBlock.id, 'length_m', drafts[selectedBlock.id]?.length_m ?? selectedBox.length_m)}
                onChange={(e) => {
                  const minM = minSizeByComponentType(selectedBlock.component_type)
                  writeNumInput(selectedBlock.id, 'length_m', e.target.value, (v) => updateDraft(selectedBlock.id, { length_m: Math.max(minM, round2(snap01(v))) }))
                }}
                onBlur={() => commitNumInput(selectedBlock.id, 'length_m')}
              />
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Chiều cao (m)</label>
              <input
                className="input"
                value={readNumInput(selectedBlock.id, 'height_m', drafts[selectedBlock.id]?.height_m ?? selectedBox.height_m)}
                onChange={(e) => {
                  const minM = minSizeByComponentType(selectedBlock.component_type)
                  writeNumInput(selectedBlock.id, 'height_m', e.target.value, (v) => updateDraft(selectedBlock.id, { height_m: Math.max(minM, round2(snap01(v))) }))
                }}
                onBlur={() => commitNumInput(selectedBlock.id, 'height_m')}
              />
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Chiều rộng (m)</label>
              <input
                className="input"
                value={readNumInput(selectedBlock.id, 'width_m', drafts[selectedBlock.id]?.width_m ?? Number((selectedBlock.dimensions_json as any)?.width_m || 0))}
                onChange={(e) => writeNumInput(selectedBlock.id, 'width_m', e.target.value, (v) => updateDraft(selectedBlock.id, { width_m: Math.max(0, round2(snap01(v))) }))}
                onBlur={() => commitNumInput(selectedBlock.id, 'width_m')}
              />
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Diện tích (m2)</label>
              <input
                className="input"
                value={String(drafts[selectedBlock.id]?.area_m2 ?? Number((selectedBlock.dimensions_json as any)?.area_m2 || ''))}
                onChange={(e) => updateDraft(selectedBlock.id, { area_m2: Math.max(0, Number(e.target.value) || 0) })}
              />
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Số lượng</label>
              <input
                className="input"
                value={String(drafts[selectedBlock.id]?.count ?? Number((selectedBlock.dimensions_json as any)?.count || ''))}
                onChange={(e) => updateDraft(selectedBlock.id, { count: Math.max(1, Math.trunc(Number(e.target.value) || 1)) })}
              />
              {selectedFieldFlags.isRoom ? <>
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Loại phòng</label>
              <select
                className="select"
                value={String(drafts[selectedBlock.id]?.room_type ?? String((selectedBlock.dimensions_json as any)?.room_type || ''))}
                onChange={(e) => updateDraft(selectedBlock.id, { room_type: e.target.value })}
              >
                <option value="">(Loại phòng)</option>
                {selectedRoomTypeOptions.map((x) => <option key={x.id} value={x.value}>{x.name}</option>)}
              </select>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>Không gian chính<span title="Cho biết block này đang phục vụ không gian nào như phòng khách, phòng ngủ, bếp, WC. Đây là semantic chính để gợi ý template và bóc tách." style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 999, border: '1px solid var(--border)', color: 'var(--text4)', cursor: 'help', fontSize: 11, lineHeight: 1 }}>?</span></label>
              <select
                className="select"
                value={String(drafts[selectedBlock.id]?.space_type ?? String((selectedBlock.dimensions_json as any)?.space_type || ''))}
                onChange={(e) => updateDraft(selectedBlock.id, { space_type: e.target.value })}
              >
                <option value="">(Không gian chính)</option>
                {selectedSpaceTypeOptions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
              </select>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>Mức không gian<span title="Cho biết mức độ hoàn thiện hay tính chất sử dụng của không gian, ví dụ cơ bản, tiết kiệm, cao cấp, phụ trợ." style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 999, border: '1px solid var(--border)', color: 'var(--text4)', cursor: 'help', fontSize: 11, lineHeight: 1 }}>?</span></label>
              <select
                className="select"
                value={String(drafts[selectedBlock.id]?.space_profile ?? String((selectedBlock.dimensions_json as any)?.space_profile || ''))}
                onChange={(e) => updateDraft(selectedBlock.id, { space_profile: e.target.value })}
              >
                <option value="">(Mức không gian)</option>
                {SPACE_PROFILE_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
              </select>
              </> : null}
              {selectedFieldFlags.supportsFacade ? <>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>Vai trò mặt tiền<span title="Đánh dấu block nào là mặt ngoài cần bóc facade. Chọn Mặt tiền chính nếu đây là phần nhìn ra mặt trước công trình." style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 999, border: '1px solid var(--border)', color: 'var(--text4)', cursor: 'help', fontSize: 11, lineHeight: 1 }}>?</span></label>
              <select
                className="select"
                value={String(drafts[selectedBlock.id]?.facade_role ?? String((selectedBlock.dimensions_json as any)?.facade_role || ''))}
                onChange={(e) => updateDraft(selectedBlock.id, { facade_role: e.target.value })}
              >
                <option value="">(Vai trò mặt tiền)</option>
                {selectedFacadeRoleOptions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
              </select>
              </> : null}
              {selectedFieldFlags.isFoundation ? <>
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>Loại móng</label>
              <select
                className="select"
                value={String(drafts[selectedBlock.id]?.foundation_type ?? String((selectedBlock.dimensions_json as any)?.foundation_type || ''))}
                onChange={(e) => updateDraft(selectedBlock.id, { foundation_type: e.target.value })}
              >
                <option value="">(Loại móng)</option>
                {taxonomies.filter((x) => x.kind === 'foundation_type' && x.is_active).map((x) => <option key={x.id} value={x.value}>{x.name}</option>)}
              </select>
              </> : null}
              {selectedFieldFlags.allowedFeatureKeys.size > 0 ? <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
                {BLOCK_FEATURE_OPTIONS.filter((feature) => selectedFieldFlags.allowedFeatureKeys.has(feature.key)).map((feature) => (
                  <label key={String(feature.key)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(drafts[selectedBlock.id]?.[feature.key] ?? (selectedBlock.dimensions_json as any)?.[feature.key])}
                      onChange={(e) => updateDraft(selectedBlock.id, { [feature.key]: e.target.checked } as Partial<BlockDraft>)}
                    />
                    <span>{feature.label}</span>
                  </label>
                ))}
              </div> : null}
              <div style={{ gridColumn: '1 / -1', border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: 'rgba(148,163,184,.06)' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Gợi ý template semantic</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
                  Template hiện tại:{' '}
                  {templates.find((t) => t.id === (drafts[selectedBlock.id]?.template_id || selectedBlock.template_id || ''))?.template_name
                    || selectedBlock.template?.template_name
                    || 'Chưa gắn template'}
                </div>
                {selectedBlockSemanticHints.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa đủ semantic để gợi ý template.</div>
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
              {selectedFieldFlags.allowsOpenings ? <div style={{ gridColumn: '1 / -1', border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: 'rgba(59,130,246,.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Ô mở chi tiết (nhiều cửa / cửa sổ)</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>Nếu có `openings[]` thì ưu tiên dùng danh sách này thay vì preset mặc định.</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost" onClick={() => addOpening(selectedBlock.id, 'door')} style={{ borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                       + Cửa đi
                    </button>
                    <button className="btn btn-ghost" onClick={() => addOpening(selectedBlock.id, 'window')} style={{ borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                       + Cửa sổ
                    </button>
                    <button className="btn btn-ghost" onClick={() => addOpening(selectedBlock.id, 'vent')} style={{ borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                       + Ô thông gió
                    </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 240px) 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      {'Preset \u00f4 m\u1edf'}
                      <span
                         title="Mẫu ô mở mặc định cho block. Nếu chưa khai báo danh sách cửa, cửa sổ chi tiết thì hệ thống sẽ dùng preset này để preview và bóc tách sơ bộ."
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 999, border: '1px solid var(--border)', color: 'var(--text4)', cursor: 'help', fontSize: 11, lineHeight: 1 }}
                      >
                        ?
                      </span>
                    </label>
                    <select
                      className="select"
                      value={String(drafts[selectedBlock.id]?.opening_preset ?? (selectedBlock.dimensions_json as any)?.opening_preset ?? '')}
                      onChange={(e) => updateDraft(selectedBlock.id, { opening_preset: e.target.value })}
                    >
                      <option value="">{'(kh\u00f4ng d\u00f9ng preset)'}</option>
                      {selectedOpeningPresetOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'end' }}>
                    {'K\u00fd hi\u1ec7u c\u00f3 d\u1ea5u * tr\u00ean canvas l\u00e0 \u00f4 m\u1edf \u0111ang hi\u1ec3n th\u1ecb theo preset. Khi th\u00eam \u00f4 m\u1edf chi ti\u1ebft, preset ch\u1ec9 c\u00f2n l\u00e0 m\u1eb7c \u0111\u1ecbnh tham chi\u1ebfu.'}
                  </div>
                </div>
                {(() => {
                  const openingRows = getDraftOpenings(selectedBlock, drafts[selectedBlock.id])
                  if (openingRows.length === 0) {
                     return <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có ô mở chi tiết. Nếu để trống, hệ thống sẽ fallback về preset ô mở cũ.</div>
                  }
                  return (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {openingRows.map((opening, idx) => (
                        <div
                          key={`${selectedBlock.id}:opening:${idx}`}
                          onClick={() => setSelectedOpeningIndex(idx)}
                          style={{
                            border: selectedOpeningIndex === idx ? '1px solid rgba(248,250,252,.9)' : '1px dashed var(--border)',
                            borderRadius: 8,
                            padding: 8,
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
                            gap: 6,
                            background: selectedOpeningIndex === idx ? 'rgba(248,250,252,.06)' : 'transparent',
                            cursor: 'pointer',
                          }}
                        >
                          <select className="select" value={opening.type} onChange={(e) => updateOpening(selectedBlock.id, idx, { type: e.target.value as OpeningDraft['type'] })}>
                            <option value="door">Cửa đi</option>
                            <option value="window">Cửa sổ</option>
                            <option value="vent">Ô thông gió</option>
                          </select>
                          <select className="select" value={opening.face} onChange={(e) => updateOpening(selectedBlock.id, idx, { face: e.target.value as OpeningDraft['face'] })}>
                            <option value="front">Mặt trước</option>
                            <option value="back">Mặt sau</option>
                            <option value="left">Bên trái</option>
                            <option value="right">Bên phải</option>
                          </select>
                          <button className="btn btn-ghost" onClick={() => removeOpening(selectedBlock.id, idx)} style={{ borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--red)' }}>
                            Xóa
                          </button>
                          <input className="input" placeholder="offset (m)" value={String(opening.offset)} onChange={(e) => updateOpening(selectedBlock.id, idx, { offset: Number(e.target.value || 0) })} />
                          <input className="input" placeholder="width (m)" value={String(opening.width)} onChange={(e) => updateOpening(selectedBlock.id, idx, { width: Number(e.target.value || 0) })} />
                          <input className="input" placeholder="height (m)" value={String(opening.height)} onChange={(e) => updateOpening(selectedBlock.id, idx, { height: Number(e.target.value || 0) })} />
                          <input className="input" placeholder="sill (m)" value={String(opening.sill)} onChange={(e) => updateOpening(selectedBlock.id, idx, { sill: Number(e.target.value || 0) })} />
                          <div style={{ gridColumn: 'span 2', fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>
                            Offset âm/dương để dịch trái-phải trên mặt đang chọn.
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div> : null}
              {selectedFieldFlags.isWall && (
                <>
                  <label style={{ fontSize: 11, color: 'var(--text3)' }}>Diện tích tường (m2) - ưu tiên</label>
                  <input
                    className="input"
                    value={String(drafts[selectedBlock.id]?.wall_area_m2 ?? Number((selectedBlock.dimensions_json as any)?.wall_area_m2 || ''))}
                    onChange={(e) => updateDraft(selectedBlock.id, { wall_area_m2: Math.max(0, Number(e.target.value) || 0) })}
                  />
                  <label style={{ fontSize: 11, color: 'var(--text3)' }}>Chiều dài tường (m)</label>
                  <input
                    className="input"
                    value={String(drafts[selectedBlock.id]?.wall_length_m ?? Number((selectedBlock.dimensions_json as any)?.wall_length_m || ''))}
                    onChange={(e) => updateDraft(selectedBlock.id, { wall_length_m: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </>
              )}
              <label style={{ fontSize: 11, color: 'var(--text3)' }}>JSON nâng cao</label>
              <textarea
                className="textarea"
                style={{ minHeight: 56 }}
                value={String(drafts[selectedBlock.id]?.extra_json_text ?? '')}
                onChange={(e) => updateDraft(selectedBlock.id, { extra_json_text: e.target.value })}
                placeholder='{"pile_depth_m":3}'
              />
              <button className="btn-primary" onClick={saveSelectedBlock} disabled={savingBlockId === selectedBlock.id}>
                {savingBlockId === selectedBlock.id ? 'Đang lưu...' : 'Lưu block'}
              </button>
            </div>
          )}
            </div>
          </details>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 9, padding: '10px 16px', fontSize: 13, zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
