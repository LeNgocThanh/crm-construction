'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { PRINT_BRAND_DEFAULT, mergePrintBrandSettings, type PrintBrandSettings } from '@/lib/print/brand'
import { renderPrintHeaderHtml, renderPrintShellHtml } from '@/lib/print/layout'
import {
  evaluateSalesBriefHeat,
  getDefaultSalesBriefHeatConfig,
  normalizeSalesBriefHeatConfig,
  type SalesBriefHeatEvaluation,
} from '@/lib/estimate/sales-brief-heat'

type SupplierOption = { value: string; name: string }
type QuoteItem = {
  id?: string
  material_key: string
  material_name?: string | null
  unit?: string | null
  quantity?: number | null
  unit_price?: number | null
  cost?: number | null
  note?: string | null
}
type Block = {
  id: string
  component_type: string
  level_index: number
  block_name?: string | null
  dimensions_json?: Record<string, unknown> | null
  template?: {
    id: string
    template_code: string
    template_name: string
    version?: number
  } | null
}
type BlockGroup = {
  block_id: string
  block_name: string
  component_type: string
  level_index: number
  template_key: string
  template_label: string
  items: QuoteItem[]
  subtotal: number
}
type RecomputeData = {
  template_key: string
  old_group_subtotal: number
  new_group_subtotal: number
  totals: {
    old_subtotal: number
    new_subtotal: number
    old_total: number
    new_total: number
  }
  old_group_items: QuoteItem[]
  new_group_items: QuoteItem[]
  warnings: string[]
}
type LevelCostRow = {
  level_index: number
  block_count: number
  subtotal: number
}
type ComponentCostRow = {
  component_type: string
  block_count: number
  subtotal: number
}

type Context = {
  preview_result: any
  input_payload: Record<string, any>
  assembly: Record<string, any>
  blocks: Block[]
  assembly_summary?: any
  preview_images?: {
    plan_2d?: string | null
    model_3d?: string | null
  }
}

type CustomerBriefData = {
  id: string
  full_name?: string | null
  address?: string | null
  construction_address?: string | null
  status?: string | null
  budget_min?: number | string | null
  budget_max?: number | string | null
  active_care_activity_id?: string | null
  active_care_due_at?: string | null
  active_care_priority?: string | null
  active_care_status?: string | null
  active_care_pipeline_phase?: string | null
  next_action?: string | null
}

type SalesBrief = {
  documentTitle: string
  summary: string
  fitReason: string
  talkingPoints: string[]
  questionsToConfirm: string[]
  nextStepSuggestion: string
  heat: SalesBriefHeatEvaluation
}

type FollowUpSuggestion = {
  key: string
  title: string
  detail: string
  severity: 'info' | 'action'
}

type TaxonomyRow = {
  kind: string
  value: string
  name: string
}

type ProposalTone = 'cost_priority'
type HeatConfigRow = { config_key: string; config_value: string }

const STORAGE_KEY = 'assembly_estimate_preview_context_v1'

const DIMENSION_LABELS: Record<string, string> = {
  length_m: 'Chiều dài (m)',
  length: 'Chiều dài',
  build_length_m: 'Chiều dài xây dựng (m)',
  width_m: 'Chiều rộng (m)',
  width: 'Chiều rộng',
  build_width_m: 'Chiều rộng xây dựng (m)',
  height_m: 'Chiều cao (m)',
  height: 'Chiều cao',
  floor_height_m: 'Chiều cao tầng (m)',
  area_m2: 'Diện tích (m2)',
  area: 'Diện tích',
  floor_area: 'Diện tích sàn',
  footprint_area: 'Diện tích xây dựng',
  count: 'Số lượng',
  room_count: 'Số phòng',
  qty: 'Số lượng',
  room_type: 'Loại phòng',
  foundation_type: 'Loại móng',
}

const DIMENSION_ORDER = [
  'length_m',
  'build_length_m',
  'width_m',
  'build_width_m',
  'height_m',
  'floor_height_m',
  'area_m2',
  'floor_area',
  'footprint_area',
  'count',
  'room_count',
  'qty',
  'room_type',
  'foundation_type',
]

function normalizeKey(v: unknown) {
  return String(v || '').trim().toLowerCase()
}

function parseTemplateNote(note: unknown) {
  const raw = String(note || '').trim()
  if (!raw.startsWith('template:')) return null
  const body = raw.slice('template:'.length).trim()
  if (!body) return null
  const [codeVerRaw] = body.split('|')
  const codeVer = String(codeVerRaw || '').trim()
  const at = codeVer.indexOf('@v')
  if (at < 0) return null
  const code = codeVer.slice(0, at).trim()
  const version = Number(codeVer.slice(at + 2).trim())
  if (!code || !Number.isFinite(version)) return null
  return { template_key: `${code}@v${version}`, template_code: code, version }
}

function mergeSupplierOptions(taxonomyRows: any[], supplierRows: any[]) {
  const map = new Map<string, SupplierOption>()
  for (const x of taxonomyRows || []) {
    const value = String(x?.value || '').trim()
    if (!value) continue
    const key = normalizeKey(value)
    map.set(key, { value, name: String(x?.name || value) })
  }
  for (const x of supplierRows || []) {
    const value = String(x?.supplier_code || '').trim()
    if (!value) continue
    const key = normalizeKey(value)
    map.set(key, { value, name: String(x?.supplier_name || value) })
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
}

function getBlockTemplateKey(block: Block) {
  const code = String(block?.template?.template_code || '').trim()
  if (!code) return ''
  const version = Number(block?.template?.version || 1)
  return `${code}@v${version}`
}

function buildBlockGroups(blocks: Block[], items: QuoteItem[]) {
  const byTemplate = new Map<string, QuoteItem[]>()
  for (const it of items || []) {
    const p = parseTemplateNote(it?.note)
    if (!p) continue
    const rows = byTemplate.get(p.template_key) || []
    rows.push(it)
    byTemplate.set(p.template_key, rows)
  }

  const out: BlockGroup[] = []
  for (const b of blocks || []) {
    const templateKey = getBlockTemplateKey(b)
    if (!templateKey) continue
    const rows = byTemplate.get(templateKey) || []
    if (!rows.length) continue
    const subtotal = rows.reduce((s, x) => s + Number(x?.cost || 0), 0)
    const templateLabel = b?.template?.template_name ? `${b.template.template_name} (${templateKey})` : templateKey
    out.push({
      block_id: b.id,
      block_name: b.block_name || b.component_type,
      component_type: b.component_type,
      level_index: Number(b.level_index || 0),
      template_key: templateKey,
      template_label: templateLabel,
      items: rows,
      subtotal,
    })
  }
  return out
}

function humanizeKey(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

function getDimensionValue(input: Record<string, unknown> | null | undefined, keys: string[], fallback = 0) {
  const dims = input && typeof input === 'object' ? input : {}
  for (const key of keys) {
    const n = Number((dims as Record<string, unknown>)[key])
    if (Number.isFinite(n) && n > 0) return n
  }
  return fallback
}

function getCoordinateValue(input: Record<string, unknown> | null | undefined, keys: string[], fallback = Number.NaN) {
  const dims = input && typeof input === 'object' ? input : {}
  for (const key of keys) {
    const n = Number((dims as Record<string, unknown>)[key])
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function getComponentPreviewColor(componentType: string) {
  const key = String(componentType || '').trim().toLowerCase()
  const palette: Record<string, string> = {
    foundation: '#f59e0b',
    basement: '#f97316',
    slab: '#60a5fa',
    wall: '#34d399',
    room: '#a78bfa',
    column: '#2dd4bf',
    stair: '#fb7185',
    ceiling: '#38bdf8',
    tum: '#c084fc',
  }
  return palette[key] || '#64748b'
}

type PreviewBlockGeometry = {
  id: string
  block_name: string
  component_type: string
  level_index: number
  x: number
  y: number
  z: number
  length: number
  width: number
  height: number
  color: string
}

function buildPreviewBlockGeometries(blocks: Block[]) {
  const sorted = [...(blocks || [])].sort((a, b) => {
    const lv = Number(a.level_index || 0) - Number(b.level_index || 0)
    if (lv !== 0) return lv
    return String(a.block_name || a.component_type || '').localeCompare(String(b.block_name || b.component_type || ''), 'vi')
  })

  const layouts = new Map<number, { cursorX: number; cursorY: number; rowMaxWidth: number }>()
  const out: PreviewBlockGeometry[] = []

  for (const block of sorted) {
    const dims = block.dimensions_json || null
    const length = getDimensionValue(dims, ['length_m', 'length', 'build_length_m'], Math.max(3, Math.sqrt(calcAreaFromDimensions(dims) || 16)))
    const width = getDimensionValue(dims, ['width_m', 'width', 'build_width_m'], Math.max(3, Math.sqrt(calcAreaFromDimensions(dims) || 16)))
    const height = getDimensionValue(dims, ['height_m', 'floor_height_m', 'height'], 3.6)
    let x = getCoordinateValue(dims, ['x_m'], Number.NaN)
    let y = getCoordinateValue(dims, ['y_m'], Number.NaN)
    const z = getCoordinateValue(dims, ['z_m'], Number(block.level_index || 0) * 3.6)

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      const level = Number(block.level_index || 0)
      const lane = layouts.get(level) || { cursorX: 0, cursorY: level * 16, rowMaxWidth: 0 }
      if (lane.cursorX + length > 26) {
        lane.cursorX = 0
        lane.cursorY += lane.rowMaxWidth + 2
        lane.rowMaxWidth = 0
      }
      x = lane.cursorX
      y = lane.cursorY
      lane.cursorX += length + 2
      lane.rowMaxWidth = Math.max(lane.rowMaxWidth, width)
      layouts.set(level, lane)
    }

    out.push({
      id: block.id,
      block_name: String(block.block_name || block.component_type || 'Block'),
      component_type: String(block.component_type || 'other'),
      level_index: Number(block.level_index || 0),
      x,
      y,
      z,
      length,
      width,
      height,
      color: getComponentPreviewColor(block.component_type),
    })
  }

  return out
}

function svgDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function buildAutoPlanPreviewDataUri(blocks: Block[]) {
  const geoms = buildPreviewBlockGeometries(blocks)
  if (!geoms.length) return ''
  const pad = 18
  const minX = Math.min(...geoms.map((g) => g.x))
  const minY = Math.min(...geoms.map((g) => g.y))
  const maxX = Math.max(...geoms.map((g) => g.x + g.length))
  const maxY = Math.max(...geoms.map((g) => g.y + g.width))
  const scale = 18
  const width = Math.max(360, Math.ceil((maxX - minX) * scale + pad * 2))
  const height = Math.max(240, Math.ceil((maxY - minY) * scale + pad * 2))

  const rects = geoms.map((g) => {
    const x = pad + (g.x - minX) * scale
    const y = pad + (maxY - minY - (g.y - minY) - g.width) * scale
    const w = Math.max(24, g.length * scale)
    const h = Math.max(24, g.width * scale)
    const label = `${g.block_name} | T${g.level_index + 1}`
    return `
      <g>
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="8" fill="${g.color}" fill-opacity="0.18" stroke="${g.color}" stroke-width="2" />
        <text x="${(x + 8).toFixed(1)}" y="${(y + 18).toFixed(1)}" font-size="12" font-family="Arial, sans-serif" fill="#0f172a">${label}</text>
      </g>
    `
  }).join('')

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#ffffff" />
      <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="14" fill="#ffffff" stroke="#cbd5e1" />
      <text x="${pad}" y="22" font-size="14" font-family="Arial, sans-serif" font-weight="700" fill="#0f172a">Mặt bằng sơ đồ tự sinh từ dữ liệu block</text>
      ${rects}
    </svg>
  `
  return svgDataUri(svg)
}

function isoPoint(x: number, y: number, z: number) {
  return {
    x: x - y * 0.7,
    y: z * 0.9 + y * 0.45,
  }
}

function buildAutoMassingPreviewDataUri(blocks: Block[]) {
  const geoms = buildPreviewBlockGeometries(blocks)
  if (!geoms.length) return ''
  const shapes = geoms
    .map((g) => {
      const p1 = isoPoint(g.x, g.y, g.z)
      const p2 = isoPoint(g.x + g.length, g.y, g.z)
      const p3 = isoPoint(g.x + g.length, g.y + g.width, g.z)
      const p4 = isoPoint(g.x, g.y + g.width, g.z)
      const p5 = isoPoint(g.x, g.y, g.z + g.height)
      const p6 = isoPoint(g.x + g.length, g.y, g.z + g.height)
      const p7 = isoPoint(g.x + g.length, g.y + g.width, g.z + g.height)
      const p8 = isoPoint(g.x, g.y + g.width, g.z + g.height)
      const all = [p1, p2, p3, p4, p5, p6, p7, p8]
      return { g, points: { p1, p2, p3, p4, p5, p6, p7, p8 }, all, depth: g.x + g.y + g.z }
    })
    .sort((a, b) => a.depth - b.depth)

  const allPoints = shapes.flatMap((shape) => shape.all)
  const minX = Math.min(...allPoints.map((p) => p.x))
  const minY = Math.min(...allPoints.map((p) => p.y))
  const maxX = Math.max(...allPoints.map((p) => p.x))
  const maxY = Math.max(...allPoints.map((p) => p.y))
  const scale = 18
  const pad = 28
  const width = Math.max(360, Math.ceil((maxX - minX) * scale + pad * 2))
  const height = Math.max(260, Math.ceil((maxY - minY) * scale + pad * 2))

  function mapPoint(pt: { x: number; y: number }) {
    return {
      x: pad + (pt.x - minX) * scale,
      y: height - pad - (pt.y - minY) * scale,
    }
  }

  const svgBoxes = shapes.map(({ g, points }) => {
    const top = [points.p5, points.p6, points.p7, points.p8].map(mapPoint)
    const left = [points.p8, points.p5, points.p1, points.p4].map(mapPoint)
    const right = [points.p6, points.p7, points.p3, points.p2].map(mapPoint)
    const topStr = top.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const leftStr = left.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const rightStr = right.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const labelPoint = mapPoint(points.p7)
    return `
      <g>
        <polygon points="${leftStr}" fill="${g.color}" fill-opacity="0.18" stroke="${g.color}" stroke-width="1.5" />
        <polygon points="${rightStr}" fill="${g.color}" fill-opacity="0.28" stroke="${g.color}" stroke-width="1.5" />
        <polygon points="${topStr}" fill="${g.color}" fill-opacity="0.36" stroke="${g.color}" stroke-width="1.5" />
        <text x="${(labelPoint.x + 4).toFixed(1)}" y="${(labelPoint.y - 4).toFixed(1)}" font-size="11" font-family="Arial, sans-serif" fill="#0f172a">${g.block_name}</text>
      </g>
    `
  }).join('')

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#ffffff" />
      <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="14" fill="#ffffff" stroke="#cbd5e1" />
      <text x="${pad}" y="22" font-size="14" font-family="Arial, sans-serif" font-weight="700" fill="#0f172a">Phối khối sơ đồ tự sinh từ dữ liệu block</text>
      ${svgBoxes}
    </svg>
  `
  return svgDataUri(svg)
}

function renderProposalPreviewSection(ctx: Context | null) {
  const plan2d = String(ctx?.preview_images?.plan_2d || '').trim() || buildAutoPlanPreviewDataUri(Array.isArray(ctx?.blocks) ? ctx?.blocks : [])
  const model3d = String(ctx?.preview_images?.model_3d || '').trim() || buildAutoMassingPreviewDataUri(Array.isArray(ctx?.blocks) ? ctx?.blocks : [])
  if (!plan2d && !model3d) return ''
  return `
    <div class="print-section">
      <div class="print-section-title">Hình ảnh preview phương án</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px; align-items:start;">
        ${plan2d ? `
          <div>
            <div style="font-size:12px; font-weight:700; color:#0f172a; margin-bottom:8px;">Mặt bằng 2D</div>
            <img src="${plan2d}" alt="Preview 2D" style="width:100%; border:1px solid #cbd5e1; border-radius:10px; background:#fff;" />
          </div>
        ` : ''}
        ${model3d ? `
          <div>
            <div style="font-size:12px; font-weight:700; color:#0f172a; margin-bottom:8px;">Phối khối 3D</div>
            <img src="${model3d}" alt="Preview 3D" style="width:100%; border:1px solid #cbd5e1; border-radius:10px; background:#fff;" />
          </div>
        ` : ''}
      </div>
    </div>
  `
}

function buildGeneratedProposalPreviewImages(ctx: Context | null) {
  const blocks = Array.isArray(ctx?.blocks) ? ctx?.blocks : []
  return {
    plan_2d: buildAutoPlanPreviewDataUri(blocks),
    model_3d: buildAutoMassingPreviewDataUri(blocks),
  }
}

function buildDimensionRows(input: Record<string, unknown> | null | undefined) {
  const dims = input && typeof input === 'object' ? input : {}
  const rows: Array<{ key: string; label: string; value: string }> = []
  const used = new Set<string>()

  for (const k of DIMENSION_ORDER) {
    if (!(k in dims)) continue
    const raw = (dims as Record<string, unknown>)[k]
    if (raw === null || raw === undefined || raw === '') continue
    used.add(k)
    rows.push({
      key: k,
      label: DIMENSION_LABELS[k] || humanizeKey(k),
      value: typeof raw === 'number' ? String(raw) : String(raw),
    })
  }

  for (const [k, raw] of Object.entries(dims as Record<string, unknown>)) {
    if (used.has(k)) continue
    if (raw === null || raw === undefined || raw === '') continue
    rows.push({
      key: k,
      label: DIMENSION_LABELS[k] || humanizeKey(k),
      value: typeof raw === 'number' ? String(raw) : typeof raw === 'object' ? JSON.stringify(raw) : String(raw),
    })
  }
  return rows
}

function calcAreaFromDimensions(input: Record<string, unknown> | null | undefined) {
  const dims = input && typeof input === 'object' ? input : {}
  for (const key of ['area_m2', 'area', 'floor_area', 'footprint_area']) {
    const value = Number((dims as Record<string, unknown>)[key])
    if (Number.isFinite(value) && value > 0) return value
  }
  const length = ['length_m', 'length', 'build_length_m']
    .map((key) => Number((dims as Record<string, unknown>)[key]))
    .find((n) => Number.isFinite(n) && n > 0)
  const width = ['width_m', 'width', 'build_width_m']
    .map((key) => Number((dims as Record<string, unknown>)[key]))
    .find((n) => Number.isFinite(n) && n > 0)
  if (length && width) return length * width
  return 0
}

function formatMoney(value: number) {
  return `${Number(value || 0).toLocaleString('vi-VN')} VND`
}

function customerDisplayName(ctx: Context | null, customer: CustomerBriefData | null) {
  const fullName = String(customer?.full_name || '').trim()
  if (fullName) return fullName
  const contextName = String(ctx?.assembly?.customer_name || '').trim()
  if (contextName) return contextName
  const customerId = String(ctx?.assembly?.customer_id || '').trim()
  return customerId || '-'
}

function getTaxLabel(rows: TaxonomyRow[], kind: string, value: unknown, fallback = '-') {
  const raw = String(value || '').trim()
  if (!raw) return fallback
  const hit = rows.find((row) => row.kind === kind && String(row.value || '').trim() === raw)
  return String(hit?.name || raw)
}

function getProposalToneLabel(tone: ProposalTone) {
  if (tone === 'cost_priority') return 'Ưu tiên chi phí'
  return tone
}

function toNumberSafe(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function formatBudgetRange(minValue: unknown, maxValue: unknown) {
  const min = toNumberSafe(minValue)
  const max = toNumberSafe(maxValue)
  if (min > 0 && max > 0) return `${formatMoney(min)} - ${formatMoney(max)}`
  if (min > 0) return `từ ${formatMoney(min)}`
  if (max > 0) return `tối đa ${formatMoney(max)}`
  return ''
}

function buildSalesBrief(args: {
  ctx: Context
  customer: CustomerBriefData | null
  totalCost: number
  costPerM2: number
  totalArea: number
  maxLevel: number
  blockGroups: BlockGroup[]
  labels: {
    houseType: string
    style: string
    level: string
  }
  heatConfigRows: HeatConfigRow[]
}) : SalesBrief {
  const { ctx, customer, totalCost, costPerM2, totalArea, maxLevel, blockGroups, labels, heatConfigRows } = args
  const houseType = String(labels.houseType || '').trim() || 'phương án nhà dân dụng'
  const style = String(labels.style || '').trim() || 'phong cách chưa xác định'
  const finishLevel = String(labels.level || '').trim() || 'mức hoàn thiện chưa xác định'
  const budgetText = formatBudgetRange(customer?.budget_min, customer?.budget_max)
  const currentAction = String(customer?.next_action || '').trim()
  const componentTop = [...blockGroups].sort((a, b) => b.subtotal - a.subtotal).slice(0, 2)
  const customerShortName = String(customer?.full_name || 'khách').trim() || 'khách'
  const budgetMax = toNumberSafe(customer?.budget_max)
  const hasLocation = Boolean(String(customer?.construction_address || customer?.address || '').trim())
  const hasFunction = Boolean(String(ctx.input_payload?.bedroom_count || '').trim())
  const hasFoundation = Boolean(String(ctx.input_payload?.foundation_type || '').trim())
  const hasBudget = Boolean(toNumberSafe(customer?.budget_min) > 0 || budgetMax > 0)
  const hasActiveCare = Boolean(customer?.active_care_activity_id)
  const heat = evaluateSalesBriefHeat({
    totalCost,
    budgetMax,
    hasBudget,
    hasLocation,
    hasFunction,
    hasFoundation,
    hasActiveCare,
    config: normalizeSalesBriefHeatConfig(heatConfigRows || []),
  })

  const summary = [
    `Hiện tại ${customerShortName} đang xem một phương án ${houseType}, theo phong cách ${style}, quy mô khoảng ${maxLevel + 1} tầng và tổng diện tích tạm tính ${Number(totalArea || 0).toLocaleString('vi-VN')} m2.`,
    `Khung đầu tư sơ bộ đang vào khoảng ${formatMoney(totalCost)}, tương đương đơn giá bình quân ${formatMoney(costPerM2)}/m2.`,
  ].join(' ')

  let fitReason = `Phương án này khá dễ trao đổi vì giữ được sự cân bằng giữa công năng tổng thể, mức hoàn thiện ${finishLevel} và khả năng điều chỉnh tiếp theo theo phản hồi thực tế của khách.`
  if (budgetText) {
    if (budgetMax > 0 && totalCost > budgetMax) {
      fitReason = `Phương án này vẫn nên dùng để mở đầu câu chuyện vì giúp khách hình dung rõ quy mô và phong cách, nhưng khi trao đổi nên nhẹ nhàng đặt lại kỳ vọng vì tổng đầu tư sơ bộ đang cao hơn khung ngân sách hiện có (${budgetText}).`
    } else if (budgetMax > 0 && totalCost <= budgetMax) {
      fitReason = `Phương án này có lợi thế ở chỗ tổng đầu tư sơ bộ đang nằm trong hoặc khá sát khung ngân sách khách (${budgetText}), nên sales có thể đi vào trao đổi cụ thể mà không gây cảm giác bị vượt tầm quá sớm.`
    }
  }

  const talkingPoints = [
    `Mở đầu bằng quy mô ${maxLevel + 1} tầng và tổng diện tích khoảng ${Number(totalArea || 0).toLocaleString('vi-VN')} m2 để khách hình dung bức tranh chung trước.`,
    `Khi nói về chi phí, chỉ nên dẫn vào 1-2 cụm lớn và dễ hiểu nhất: ${componentTop.map((item) => `${humanizeKey(item.component_type)} khoảng ${formatMoney(item.subtotal)}`).join(', ') || 'chưa có cụm nổi bật'}.`,
    `Giữ trọng tâm cuộc trao đổi ở phong cách ${style} và mức hoàn thiện ${finishLevel}; chưa cần đi sâu vào từng vật tư hay chi tiết kỹ thuật ở lượt nói đầu.`,
  ]
  if (budgetMax > 0 && totalCost > budgetMax) {
    talkingPoints.push(`Nếu khách phản ứng với mức đầu tư, nên chuyển hướng sang tinh thần “mình đang chốt khung ưu tiên trước, rồi mình cùng tinh chỉnh để sát ngân sách hơn”.`)
  } else {
    talkingPoints.push(`Nếu khách phản hồi tích cực, có thể gợi mở ngay bước tiếp theo là chốt nhu cầu chi tiết hơn để tinh chỉnh phương án cho sát thực tế sử dụng.`)
  }

  const questionsToConfirm: string[] = []
  if (!budgetText) questionsToConfirm.push('Nên hỏi lại khung ngân sách theo cách mềm để tránh tư vấn lệch tầm đầu tư.')
  if (!String(customer?.construction_address || customer?.address || '').trim()) questionsToConfirm.push('Nên xác nhận rõ địa điểm xây dựng để còn chốt bối cảnh thi công và vùng giá.')
  if (!String(ctx.input_payload?.bedroom_count || '').trim()) questionsToConfirm.push('Nên hỏi thêm số phòng ngủ và nhu cầu công năng chính của gia đình.')
  if (!String(ctx.input_payload?.foundation_type || '').trim()) questionsToConfirm.push('Nên hỏi định hướng móng hoặc hiện trạng đất để giải thích phần chi phí nền móng cho hợp lý.')
  if (!questionsToConfirm.length) questionsToConfirm.push('Thông tin cốt lõi đã khá đầy đủ, có thể chuyển sang bước gửi proposal và hẹn buổi chốt sửa phương án.')

  let nextStepSuggestion = 'Bước tiếp theo phù hợp là gửi proposal sơ bộ cho khách, sau đó hẹn một buổi trao đổi ngắn để gom phản hồi và chốt hướng chỉnh phương án.'
  if (currentAction) nextStepSuggestion = `Hiện đang có việc mở: "${currentAction}". Sales nên bám nhịp theo việc này trước; nếu khách đã xem xong proposal thì đề xuất luôn một lịch trao đổi tiếp theo để chốt hướng sửa.`

  return {
    documentTitle: 'Brief nội bộ sales',
    summary,
    fitReason,
    talkingPoints,
    questionsToConfirm,
    nextStepSuggestion,
    heat,
  }
}

function buildFollowUpSuggestions(args: {
  ctx: Context
  customer: CustomerBriefData | null
  totalCost: number
  totalArea: number
  maxLevel: number
  labels: {
    houseType: string
    style: string
    level: string
  }
}) : FollowUpSuggestion[] {
  const { ctx, customer, totalCost, totalArea, maxLevel, labels } = args
  const list: FollowUpSuggestion[] = []
  const budgetText = formatBudgetRange(customer?.budget_min, customer?.budget_max)
  const houseType = String(labels.houseType || 'phương án hiện tại')
  const style = String(labels.style || 'phong cách hiện tại')
  const finishLevel = String(labels.level || 'mức hoàn thiện hiện tại')
  const hasOpenCare = Boolean(customer?.active_care_activity_id)

  if (!budgetText) {
    list.push({
      key: 'confirm_budget',
      title: 'Xác nhận lại ngân sách',
      detail: `Nên hỏi rõ ngân sách để xem phương án ${houseType} với mức đầu tư sơ bộ ${formatMoney(totalCost)} có sát nhu cầu thật hay không.`,
      severity: 'action',
    })
  }

  if (!String(customer?.construction_address || customer?.address || '').trim()) {
    list.push({
      key: 'confirm_location',
      title: 'Xác nhận địa điểm xây dựng',
      detail: 'Nên xác nhận địa điểm xây dựng để giải thích vùng giá, điều kiện thi công và mức độ phù hợp của phương án.',
      severity: 'action',
    })
  }

  if (!String(ctx.input_payload?.bedroom_count || '').trim()) {
    list.push({
      key: 'confirm_function',
      title: 'Hỏi thêm công năng chính',
      detail: `Nên hỏi thêm số phòng ngủ, nhu cầu sử dụng theo ${maxLevel + 1} tầng và các không gian ưu tiên để chốt phương án sát hơn.`,
      severity: 'action',
    })
  }

  if (totalArea > 0) {
    list.push({
      key: 'send_proposal',
      title: 'Gửi proposal sơ bộ',
      detail: `Có thể gửi proposal sơ bộ cho khách với thông điệp: ${houseType}, ${style}, ${finishLevel}, quy mô ${Number(totalArea).toLocaleString('vi-VN')} m2.`,
      severity: 'info',
    })
  }

  if (!hasOpenCare) {
    list.push({
      key: 'schedule_review',
      title: 'Hẹn buổi chỉnh phương án',
      detail: 'Nếu khách phản hồi tích cực, nên chốt một buổi trao đổi tiếp theo để sửa phương án và gom yêu cầu chi tiết hơn.',
      severity: 'info',
    })
  }

  return list.slice(0, 4)
}

function printInternalSalesBrief(args: {
  ctx: Context
  customerName: string
  salesBrief: SalesBrief
  customerDetail: CustomerBriefData | null
  printBrand: PrintBrandSettings
  proposalTone: ProposalTone
}) {
  const { ctx, customerName, salesBrief, customerDetail, printBrand, proposalTone } = args
  if (typeof window === 'undefined') return
  const win = window.open('', '_blank', 'width=1120,height=820')
  if (!win) return

  const scopeHtml = [
    `Khách hàng: <b>${customerName}</b>`,
    `Phương án: <b>${String(ctx.assembly?.name || '-')}</b>`,
    `Tài liệu: <b>Brief nội bộ sales</b>`,
  ].join(' | ')

  const headerHtml = renderPrintHeaderHtml(
    {
      title: 'Brief nội bộ sales',
      subtitle: 'Tài liệu nội bộ phục vụ tư vấn, không dùng để gửi trực tiếp cho khách hàng.',
      code: String(ctx.assembly?.id || ''),
      printedBy: 'Người dùng CRM',
      printedAt: new Date().toLocaleString('vi-VN'),
    },
    scopeHtml,
    printBrand,
  )

  const bodyHtml = `
    <div class="print-section">
      <div class="print-section-title">Tóm tắt nhanh</div>
      <div class="print-note">${salesBrief.summary}</div>
    </div>
    <div class="print-section">
      <div class="print-section-title">Mức độ nóng</div>
      <div class="print-note"><strong>${salesBrief.heat.labelText}</strong> | Điểm hiện tại: ${salesBrief.heat.score}</div>
      <ul style="margin-top:8px; padding-left:20px; color:#334155; font-size:12px; line-height:1.8;">
        ${salesBrief.heat.reasons.map((item) => `<li>${item}</li>`).join('')}
      </ul>
    </div>
    <div class="print-section">
      <div class="print-section-title">Vì sao phương án này hợp</div>
      <div class="print-note">${salesBrief.fitReason}</div>
    </div>
    <div class="print-section">
      <div class="print-section-title">Điểm nên nhấn khi trao đổi</div>
      <ul style="margin:0; padding-left:20px; color:#334155; font-size:12px; line-height:1.8;">
        ${salesBrief.talkingPoints.map((item) => `<li>${item}</li>`).join('')}
      </ul>
    </div>
    <div class="print-section">
      <div class="print-section-title">Thông tin cần hỏi thêm</div>
      <ul style="margin:0; padding-left:20px; color:#334155; font-size:12px; line-height:1.8;">
        ${salesBrief.questionsToConfirm.map((item) => `<li>${item}</li>`).join('')}
      </ul>
    </div>
    <div class="print-section">
      <div class="print-section-title">Bước tiếp theo đề xuất</div>
      <div class="print-note">${salesBrief.nextStepSuggestion}</div>
      <div class="print-note" style="margin-top:8px;">Tone proposal đang dùng: ${getProposalToneLabel(proposalTone)}.</div>
      <div class="print-note" style="margin-top:8px;">Chăm sóc hiện tại: ${customerDetail?.active_care_activity_id ? `đang mở (${customerDetail.active_care_priority || 'normal'})` : 'chưa có hoạt động chăm sóc đang mở'}.</div>
    </div>
  `

  win.document.write(renderPrintShellHtml({
    titleTag: 'Brief nội bộ sales',
    headerHtml,
    bodyHtml,
    brand: printBrand,
    printButtonLabel: 'In / Lưu PDF',
  }))
  win.document.close()
  win.focus()
}

export default function AssemblyResultV2Page() {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [busyBlockId, setBusyBlockId] = useState('')
  const [ctx, setCtx] = useState<Context | null>(null)
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [overridesByBlock, setOverridesByBlock] = useState<Record<string, Record<string, string>>>({})
  const [recomputeByBlock, setRecomputeByBlock] = useState<Record<string, RecomputeData>>({})
  const [showBlockFacts, setShowBlockFacts] = useState(false)
  const [printBrand, setPrintBrand] = useState<PrintBrandSettings>(PRINT_BRAND_DEFAULT)
  const [customerDetail, setCustomerDetail] = useState<CustomerBriefData | null>(null)
  const [taxonomies, setTaxonomies] = useState<TaxonomyRow[]>([])
  const [proposalTone] = useState<ProposalTone>('cost_priority')
  const [heatConfigRows, setHeatConfigRows] = useState<HeatConfigRow[]>([])
  const [proposalMenuOpen, setProposalMenuOpen] = useState(false)
  const proposalMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (!proposalMenuOpen) return
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null
      if (proposalMenuRef.current && target && !proposalMenuRef.current.contains(target)) {
        setProposalMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [proposalMenuOpen])

  async function loadData() {
    setLoading(true)
    try {
      const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(STORAGE_KEY) : null
      const parsed = raw ? (JSON.parse(raw) as Context) : null
      setCtx(parsed)
      const [txRes, supRes, brandRes, heatRes] = await Promise.all([
        fetch('/api/settings/estimate/taxonomies?active_only=true'),
        fetch('/api/settings/suppliers?active_only=true'),
        fetch('/api/settings/print-brand', { cache: 'no-store' }).catch(() => null),
        fetch('/api/settings/sales-brief-heat', { cache: 'no-store' }).catch(() => null),
      ])
      const txJson = await txRes.json().catch(() => ({}))
      const supJson = await supRes.json().catch(() => ({}))
      setTaxonomies(Array.isArray(txJson.data) ? txJson.data : [])
      setSuppliers(mergeSupplierOptions(txJson.data || [], supJson.data || []))
      if (brandRes?.ok) {
        const brandJson = await brandRes.json().catch(() => ({}))
        setPrintBrand(mergePrintBrandSettings(brandJson?.data || null))
      }
      if (heatRes?.ok) {
        const heatJson = await heatRes.json().catch(() => ({}))
        setHeatConfigRows(Array.isArray(heatJson?.data) ? heatJson.data : [])
      } else {
        const fallback = Object.entries(getDefaultSalesBriefHeatConfig()).map(([config_key, config_value]) => ({ config_key, config_value: String(config_value) }))
        setHeatConfigRows(fallback)
      }
      const customerId = String(parsed?.assembly?.customer_id || '').trim()
      if (customerId) {
        const customerRes = await fetch(`/api/customers/${customerId}`, { cache: 'no-store' }).catch(() => null)
        if (customerRes?.ok) {
          const customerJson = await customerRes.json().catch(() => ({}))
          setCustomerDetail((customerJson?.data || null) as CustomerBriefData | null)
        } else {
          setCustomerDetail(null)
        }
      } else {
        setCustomerDetail(null)
      }

      const initOverrides: Record<string, Record<string, string>> = {}
      for (const b of parsed?.blocks || []) initOverrides[String(b.id)] = {}
      setOverridesByBlock(initOverrides)
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  function setOverride(blockId: string, materialKey: string, supplierKey: string) {
    setOverridesByBlock((prev) => ({
      ...prev,
      [blockId]: {
        ...(prev[blockId] || {}),
        [materialKey]: supplierKey,
      },
    }))
  }

  async function recomputeBlock(group: BlockGroup) {
    if (!ctx?.preview_result || !ctx?.input_payload) return
    setBusyBlockId(group.block_id)
    try {
      const r = await fetch('/api/estimates/v2/recompute-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preview_result: ctx.preview_result,
          input_payload: ctx.input_payload,
          template_key: group.template_key,
          replacement_template_id: null,
          supplier_overrides: overridesByBlock[group.block_id] || {},
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) return showToast(j?.error || 'Không thể tính lại block')
      setRecomputeByBlock((prev) => ({ ...prev, [group.block_id]: j.data }))
      showToast(`Đã tính lại block ${group.block_name}`)
    } finally {
      setBusyBlockId('')
    }
  }

  const blockGroups = useMemo(() => {
    if (!ctx?.preview_result?.items) return [] as BlockGroup[]
    return buildBlockGroups(Array.isArray(ctx.blocks) ? ctx.blocks : [], ctx.preview_result.items as QuoteItem[])
  }, [ctx])

  const totalView = useMemo(() => {
    if (!ctx?.preview_result) return { subtotal: 0, total: 0 }
    const baseSubtotal = Number(ctx.preview_result.subtotal_cost || 0)
    const baseTotal = Number(ctx.preview_result.total_cost || 0)
    const coeff = baseSubtotal > 0 ? baseTotal / baseSubtotal : 1

    const bestByTemplate = new Map<string, RecomputeData>()
    for (const rec of Object.values(recomputeByBlock)) {
      const key = String(rec?.template_key || '')
      if (!key) continue
      bestByTemplate.set(key, rec)
    }

    let subtotal = baseSubtotal
    for (const rec of bestByTemplate.values()) {
      subtotal += Number(rec.new_group_subtotal || 0) - Number(rec.old_group_subtotal || 0)
    }

    return {
      subtotal,
      total: Math.round(subtotal * coeff),
    }
  }, [ctx, recomputeByBlock])

  const levelCostRows = useMemo(() => {
    const map = new Map<number, LevelCostRow>()
    for (const group of blockGroups) {
      const rec = recomputeByBlock[group.block_id]
      const subtotal = rec ? Number(rec.new_group_subtotal || 0) : group.subtotal
      const current = map.get(group.level_index) || { level_index: group.level_index, block_count: 0, subtotal: 0 }
      current.block_count += 1
      current.subtotal += subtotal
      map.set(group.level_index, current)
    }
    return Array.from(map.values()).sort((a, b) => a.level_index - b.level_index)
  }, [blockGroups, recomputeByBlock])

  const componentCostRows = useMemo(() => {
    const map = new Map<string, ComponentCostRow>()
    for (const group of blockGroups) {
      const rec = recomputeByBlock[group.block_id]
      const subtotal = rec ? Number(rec.new_group_subtotal || 0) : group.subtotal
      const key = String(group.component_type || 'other')
      const current = map.get(key) || { component_type: key, block_count: 0, subtotal: 0 }
      current.block_count += 1
      current.subtotal += subtotal
      map.set(key, current)
    }
    return Array.from(map.values()).sort((a, b) => b.subtotal - a.subtotal)
  }, [blockGroups, recomputeByBlock])

  const summaryStats = useMemo(() => {
    const totalArea = Number(ctx?.assembly_summary?.inferred_floor_area_total || ctx?.input_payload?.floor_area_total || 0)
    const tumArea = Number(ctx?.assembly_summary?.inferred_tum_area_total || 0)
    const costPerM2 = totalArea > 0 ? Math.round(Number(totalView.total || 0) / totalArea) : 0
    const maxLevel = Array.isArray(ctx?.blocks) ? Math.max(...ctx.blocks.map((block) => Number(block.level_index || 0)), 0) : 0
    const footprintArea = Array.isArray(ctx?.blocks)
      ? Math.max(...ctx.blocks.map((block) => calcAreaFromDimensions(block.dimensions_json || null)), 0)
      : 0
    return { totalArea, tumArea, costPerM2, maxLevel, footprintArea }
  }, [ctx, totalView.total])

  const customerName = useMemo(() => customerDisplayName(ctx, customerDetail), [ctx, customerDetail])
  const houseTypeLabel = useMemo(() => getTaxLabel(taxonomies, 'house_type', ctx?.assembly?.house_type), [taxonomies, ctx?.assembly?.house_type])
  const styleLabel = useMemo(() => getTaxLabel(taxonomies, 'style', ctx?.assembly?.style), [taxonomies, ctx?.assembly?.style])
  const levelLabel = useMemo(() => getTaxLabel(taxonomies, 'level', ctx?.assembly?.level), [taxonomies, ctx?.assembly?.level])

  const salesBrief = useMemo(() => {
    if (!ctx?.preview_result) return null
    return buildSalesBrief({
      ctx,
      customer: customerDetail,
      totalCost: Number(totalView.total || 0),
      costPerM2: Number(summaryStats.costPerM2 || 0),
      totalArea: Number(summaryStats.totalArea || 0),
      maxLevel: Number(summaryStats.maxLevel || 0),
      blockGroups,
      labels: {
        houseType: houseTypeLabel,
        style: styleLabel,
        level: levelLabel,
      },
      heatConfigRows,
    })
  }, [ctx, customerDetail, totalView.total, summaryStats.costPerM2, summaryStats.totalArea, summaryStats.maxLevel, blockGroups, houseTypeLabel, styleLabel, levelLabel, heatConfigRows])

  const followUpSuggestions = useMemo(() => {
    if (!ctx?.preview_result) return [] as FollowUpSuggestion[]
    return buildFollowUpSuggestions({
      ctx,
      customer: customerDetail,
      totalCost: Number(totalView.total || 0),
      totalArea: Number(summaryStats.totalArea || 0),
      maxLevel: Number(summaryStats.maxLevel || 0),
      labels: {
        houseType: houseTypeLabel,
        style: styleLabel,
        level: levelLabel,
      },
    })
  }, [ctx, customerDetail, totalView.total, summaryStats.totalArea, summaryStats.maxLevel, houseTypeLabel, styleLabel, levelLabel])

  function printProposal() {
    if (!ctx?.preview_result || typeof window === 'undefined') return
    const win = window.open('', '_blank', 'width=1120,height=820')
    if (!win) {
      showToast('Không mở được cửa sổ in')
      return
    }

    const totalArea = Number(ctx?.assembly_summary?.inferred_floor_area_total || ctx?.input_payload?.floor_area_total || 0)
    const totalCost = Number(totalView.total || 0)
    const costPerM2 = totalArea > 0 ? Math.round(totalCost / totalArea) : 0
    const summaryHtml = `
      <div class="print-summary-grid">
        <div class="print-summary-card">
          <div class="print-summary-key">Tổng chi phí</div>
          <div class="print-summary-value">${formatMoney(totalCost)}</div>
        </div>
        <div class="print-summary-card">
          <div class="print-summary-key">Tổng diện tích</div>
          <div class="print-summary-value">${Number(totalArea || 0).toLocaleString('vi-VN')} m2</div>
        </div>
        <div class="print-summary-card">
          <div class="print-summary-key">Đơn giá bình quân</div>
          <div class="print-summary-value">${formatMoney(costPerM2)}/m2</div>
        </div>
        <div class="print-summary-card">
          <div class="print-summary-key">Số block</div>
          <div class="print-summary-value">${Array.isArray(ctx.blocks) ? ctx.blocks.length : 0}</div>
        </div>
      </div>
    `
    const levelHtml = levelCostRows.map((row) => `
      <tr>
        <td>Tầng ${row.level_index + 1}</td>
        <td>${row.block_count}</td>
        <td>${formatMoney(row.subtotal)}</td>
      </tr>
    `).join('')
    const blockHtml = blockGroups.map((group) => {
      const rec = recomputeByBlock[group.block_id]
      const subtotal = rec ? Number(rec.new_group_subtotal || 0) : group.subtotal
      return `
        <tr>
          <td>${group.block_name}</td>
          <td>${humanizeKey(group.component_type)}</td>
          <td>Tang ${group.level_index + 1}</td>
          <td>${formatMoney(subtotal)}</td>
        </tr>
      `
    }).join('')
    const scopeHtml = [
      `Phương án: <b>${String(ctx.assembly?.name || '-')}</b>`,
      `Khách hàng: <b>${customerName}</b>`,
      `Loại nhà: <b>${houseTypeLabel}</b>`,
      `Phong cách: <b>${styleLabel}</b>`,
      `Mức hoàn thiện: <b>${levelLabel}</b>`,
    ].join(' | ')
    const headerHtml = renderPrintHeaderHtml(
      {
        title: 'Dự toán sơ bộ theo block',
        subtitle: 'Tài liệu trình bày nhanh để so sánh và trao đổi phương án với khách hàng.',
        code: String(ctx.assembly?.id || ''),
        printedBy: 'Người dùng CRM',
        printedAt: new Date().toLocaleString('vi-VN'),
      },
      scopeHtml,
      printBrand,
    )
    const bodyHtml = `
      ${summaryHtml}
      <div class="print-section">
        <div class="print-section-title">Chi phí theo tầng</div>
        <table class="print-table">
          <thead><tr><th>Tầng</th><th>Số block</th><th>Chi phí</th></tr></thead>
          <tbody>${levelHtml || '<tr><td colspan="3">Không có dữ liệu</td></tr>'}</tbody>
        </table>
      </div>
      <div class="print-section">
        <div class="print-section-title">Chi phí theo block</div>
        <table class="print-table">
          <thead><tr><th>Block</th><th>Loại</th><th>Tầng</th><th>Chi phí</th></tr></thead>
          <tbody>${blockHtml || '<tr><td colspan="4">Không có dữ liệu</td></tr>'}</tbody>
        </table>
      </div>
    `

    win.document.write(renderPrintShellHtml({
      titleTag: 'Dự toán sơ bộ theo block',
      headerHtml,
      bodyHtml,
      brand: printBrand,
      printButtonLabel: 'In / Lưu PDF',
    }))
    win.document.close()
    win.focus()
  }

  function printCustomerProposal(overrideCtx?: Context | null) {
    const sourceCtx = overrideCtx || ctx
    if (!sourceCtx?.preview_result || typeof window === 'undefined') return
    const win = window.open('', '_blank', 'width=1120,height=820')
    if (!win) {
      showToast('Không mở được cửa sổ in')
      return
    }

    const totalArea = Number(summaryStats.totalArea || 0)
    const totalCost = Number(totalView.total || 0)
    const costPerM2 = totalArea > 0 ? Math.round(totalCost / totalArea) : 0
    const customerAddress = String(customerDetail?.construction_address || customerDetail?.address || '').trim()
    const componentRows = componentCostRows.slice(0, 4).map((row) => `
      <tr>
        <td>${humanizeKey(row.component_type)}</td>
        <td>${row.block_count}</td>
        <td>${formatMoney(row.subtotal)}</td>
      </tr>
    `).join('')
    const scopeHtml = [
      `Khách hàng: <b>${customerName}</b>`,
      `Phương án: <b>${String(sourceCtx.assembly?.name || '-')}</b>`,
      `Loại nhà: <b>${houseTypeLabel}</b>`,
      `Phong cách: <b>${styleLabel}</b>`,
    ].join(' | ')
    const headerHtml = renderPrintHeaderHtml(
      {
        title: 'Proposal phương án sơ bộ - Ưu tiên chi phí',
        subtitle: 'Tài liệu tóm tắt để khách hàng hình dung nhanh quy mô và mức đầu tư dự kiến, ưu tiên định hướng kiểm soát ngân sách.',
        code: String(sourceCtx.assembly?.id || ''),
        printedBy: 'Người dùng CRM',
        printedAt: new Date().toLocaleString('vi-VN'),
      },
      scopeHtml,
      printBrand,
    )
    const previewSectionHtml = renderProposalPreviewSection(sourceCtx)
    const bodyHtml = `
      <div class="print-summary-grid">
        <div class="print-summary-card">
          <div class="print-summary-key">Tổng diện tích dự kiến</div>
          <div class="print-summary-value">${Number(totalArea || 0).toLocaleString('vi-VN')} m2</div>
        </div>
        <div class="print-summary-card">
          <div class="print-summary-key">Số tầng dự kiến</div>
          <div class="print-summary-value">${summaryStats.maxLevel + 1}</div>
        </div>
        <div class="print-summary-card">
          <div class="print-summary-key">Tổng đầu tư sơ bộ</div>
          <div class="print-summary-value">${formatMoney(totalCost)}</div>
        </div>
        <div class="print-summary-card">
          <div class="print-summary-key">Đơn giá bình quân</div>
          <div class="print-summary-value">${formatMoney(costPerM2)}/m2</div>
        </div>
      </div>
      <div class="print-section">
        <div class="print-section-title">Thông tin tổng quan</div>
        <table class="print-table">
          <tbody>
            <tr><td>Khách hàng</td><td>${customerName}</td></tr>
            <tr><td>Địa điểm xây dựng</td><td>${customerAddress || 'Sẽ xác nhận thêm'}</td></tr>
            <tr><td>Loại nhà</td><td>${houseTypeLabel}</td></tr>
            <tr><td>Phong cách</td><td>${styleLabel}</td></tr>
            <tr><td>Mức hoàn thiện</td><td>${levelLabel}</td></tr>
            <tr><td>Định hướng proposal</td><td>${getProposalToneLabel(proposalTone)}</td></tr>
          </tbody>
        </table>
      </div>
      ${previewSectionHtml}
      <div class="print-section">
        <div class="print-section-title">Cơ cấu dự toán sơ bộ theo nhóm chi phí</div>
        <table class="print-table">
          <thead><tr><th>Nhóm hạng mục</th><th>Số block</th><th>Giá trị tạm tính</th></tr></thead>
          <tbody>${componentRows || '<tr><td colspan="3">Không có dữ liệu</td></tr>'}</tbody>
        </table>
        <div class="print-note">Lưu ý: đây là proposal sơ bộ theo hướng ưu tiên chi phí, để trao đổi và chốt khung đầu tư ban đầu. Chi phí và phạm vi sẽ được tinh chỉnh tiếp khi xác nhận thêm nhu cầu và thông số chi tiết.</div>
        <div class="print-note" style="margin-top:8px;">Có thể tiếp tục điều chỉnh phương án để tăng hoặc giảm mức đầu tư theo ưu tiên thực tế của khách hàng.</div>
      </div>
    `
    win.document.write(renderPrintShellHtml({
      titleTag: 'Proposal phương án sơ bộ',
      headerHtml,
      bodyHtml,
      brand: printBrand,
      printButtonLabel: 'In / Lưu PDF',
    }))
    win.document.close()
    win.focus()
  }

  function regenerateProposalPreviewImages() {
    if (!ctx || typeof window === 'undefined') return null
    const nextImages = buildGeneratedProposalPreviewImages(ctx)
    const nextCtx: Context = {
      ...ctx,
      preview_images: {
        ...ctx.preview_images,
        ...nextImages,
      },
    }
    setCtx(nextCtx)
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextCtx))
    return nextCtx
  }

  function regenerateProposalPreviewImagesAndPrint() {
    const nextCtx = regenerateProposalPreviewImages()
    if (!nextCtx) return
    showToast('Đã gen mới ảnh preview cho proposal khách hàng')
    printCustomerProposal(nextCtx)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 70 }}>
        <span className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    )
  }

  if (!ctx?.preview_result) {
    return <div className="card" style={{ padding: 14 }}>Không có dữ liệu preview assembly. Hãy quay lại trang assemblies và chạy preview trước.</div>
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>
            KẾT QUẢ ASSEMBLY V2
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Dự toán sơ bộ theo block</h1>
        </div>
        <button className="btn btn-ghost" onClick={printProposal} style={{ borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}>
          In / xuất PDF sơ bộ
        </button>
        <div ref={proposalMenuRef} style={{ position: 'relative' }}>
          <button
            className="btn btn-ghost"
            onClick={() => setProposalMenuOpen((p) => !p)}
            style={{ borderRadius: 10, padding: '10px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            In proposal khách hàng
            <span style={{ display: 'inline-flex', transition: 'transform .16s ease', transform: proposalMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>
          {proposalMenuOpen ? (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 240, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 10px 24px rgba(0,0,0,.28)', padding: 6, zIndex: 20 }}>
              <button
                className="btn-ghost"
                style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 4 }}
                onClick={() => {
                  printCustomerProposal()
                  setProposalMenuOpen(false)
                }}
              >
                In bằng ảnh hiện có
              </button>
              <button
                className="btn-ghost"
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => {
                  regenerateProposalPreviewImagesAndPrint()
                  setProposalMenuOpen(false)
                }}
              >
                Làm mới ảnh + in proposal
              </button>
            </div>
          ) : null}
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => salesBrief && printInternalSalesBrief({
            ctx,
            customerName,
            salesBrief,
            customerDetail,
            printBrand,
            proposalTone,
          })}
          style={{ borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}
        >
          In brief nội bộ sales
        </button>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
          Phương án: <strong>{String(ctx.assembly?.name || '-')}</strong> | Mã: {String(ctx.assembly?.id || '-')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8, fontSize: 12, color: 'var(--text3)' }}>
          <div>Khách hàng: {customerName}</div>
          <div>Loại nhà: {houseTypeLabel}</div>
          <div>Phong cách: {styleLabel}</div>
          <div>Mức hoàn thiện: {levelLabel}</div>
          <div>Vùng giá: {String(ctx.assembly?.region_code || 'ALL')}</div>
          <div>Số block: {Array.isArray(ctx.blocks) ? ctx.blocks.length : 0}</div>
          <div>Tổng tạm tính mới: <strong style={{ color: 'var(--green)' }}>{formatMoney(Number(totalView.total || 0))}</strong></div>
          <div>Tổng trước hệ số: <strong>{formatMoney(Number(totalView.subtotal || 0))}</strong></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 12 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 4 }}>Tổng diện tích tạm tính</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{Number(summaryStats.totalArea || 0).toLocaleString('vi-VN')} m2</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 4 }}>Đơn giá bình quân</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>{formatMoney(summaryStats.costPerM2)}/m2</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 4 }}>Số tầng suy ra</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{summaryStats.maxLevel + 1}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 4 }}>Diện tích tum</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{Number(summaryStats.tumArea || 0).toLocaleString('vi-VN')} m2</div>
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setShowBlockFacts((p) => !p)}
            style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
          >
            {showBlockFacts ? 'Ẩn danh sách block + thông số' : 'Hiện danh sách block + thông số'}
          </button>
        </div>
        {showBlockFacts && (
          <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
            {(Array.isArray(ctx.blocks) ? ctx.blocks : []).map((b) => (
              <details key={b.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text)' }}>
                  {(b.block_name || b.component_type)} | {humanizeKey(b.component_type)} | tầng {b.level_index + 1}
                </summary>
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
                  Mẫu áp dụng: {b.template?.template_name || '-'}
                </div>
                {buildDimensionRows(b.dimensions_json).length === 0 ? (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>Không có thông số.</div>
                ) : (
                  <div style={{ marginTop: 6, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    {buildDimensionRows(b.dimensions_json).map((row) => (
                      <div key={`${b.id}-${row.key}`} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 8, padding: '6px 8px', borderBottom: '1px solid rgba(148,163,184,.12)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text)' }}>{row.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </details>
            ))}
          </div>
        )}
      </div>

      {salesBrief && (
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 1.2, color: 'var(--text4)', fontWeight: 700 }}>BRIEF NỘI BỘ SALES - PHASE 1</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                Brief này chỉ phục vụ nội bộ tư vấn. Dữ liệu ưu tiên đọc từ hoạt động chăm sóc đang mở; `customers.next_action` chỉ được xem như fallback đồng bộ cũ.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  const lines = [
                    'Tóm tắt phương án:',
                    salesBrief.summary,
                    '',
                    'Vì sao phương án này hợp:',
                    salesBrief.fitReason,
                    '',
                    'Điểm nên nhấn với khách:',
                    ...salesBrief.talkingPoints.map((item, index) => `${index + 1}. ${item}`),
                    '',
                    'Thông tin cần hỏi thêm:',
                    ...salesBrief.questionsToConfirm.map((item, index) => `${index + 1}. ${item}`),
                    '',
                    'Bước tiếp theo đề xuất:',
                    salesBrief.nextStepSuggestion,
                  ]
                  navigator.clipboard.writeText(lines.join('\n')).then(() => showToast('Đã copy brief nội bộ sales'))
                }}
                style={{ borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}
              >
                Copy brief nội bộ
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => printInternalSalesBrief({
                  ctx,
                  customerName,
                  salesBrief,
                  customerDetail,
                  printBrand,
                  proposalTone,
                })}
                style={{ borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}
              >
                In brief nội bộ sales
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{
              border: `1px solid ${salesBrief.heat.label === 'easy_close' ? 'rgba(16,185,129,.35)' : salesBrief.heat.label === 'reduce_budget' ? 'rgba(239,68,68,.35)' : 'rgba(245,158,11,.35)'}`,
              borderRadius: 10,
              padding: 12,
              background: salesBrief.heat.label === 'easy_close' ? 'rgba(16,185,129,.08)' : salesBrief.heat.label === 'reduce_budget' ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.08)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Mức độ nóng hiện tại</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{salesBrief.heat.labelText}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  Điểm: <strong>{salesBrief.heat.score}</strong>
                  {salesBrief.heat.budgetDeltaPct != null ? ` | Chênh ngân sách: ${salesBrief.heat.budgetDeltaPct > 0 ? '+' : ''}${salesBrief.heat.budgetDeltaPct}%` : ''}
                </div>
              </div>
              <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                {salesBrief.heat.reasons.map((item, index) => (
                  <div key={`heat-${index}`} style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{index + 1}. {item}</div>
                ))}
              </div>
            </div>
            <div style={{ border: '1px solid rgba(16,185,129,.25)', borderRadius: 10, padding: 12, background: 'rgba(16,185,129,.08)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Tone proposal khách hàng hiện tại</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                Đang khóa ở chế độ <strong>{getProposalToneLabel(proposalTone)}</strong>. Hai tone <strong>Cân bằng công năng</strong> và <strong>Ưu tiên hình ảnh / mặt tiền</strong> sẽ bổ sung sau khi dữ liệu block, công năng và vật liệu dày hơn.
              </div>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Tóm tắt phương án</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{salesBrief.summary}</div>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Vì sao phương án này hợp</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{salesBrief.fitReason}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Điểm nên nhấn với khách</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {salesBrief.talkingPoints.map((item, index) => (
                    <div key={`talk-${index}`} style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{index + 1}. {item}</div>
                  ))}
                </div>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Thông tin cần hỏi thêm</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {salesBrief.questionsToConfirm.map((item, index) => (
                    <div key={`ask-${index}`} style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{index + 1}. {item}</div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'rgba(59,130,246,.08)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Bước tiếp theo đề xuất</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{salesBrief.nextStepSuggestion}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                Chăm sóc đang mở: {customerDetail?.active_care_activity_id ? `đang mở (${customerDetail.active_care_priority || 'normal'})` : 'chưa có hoạt động chăm sóc đang mở'}
              </div>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Gợi ý follow-up</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                    Đây là gợi ý để sales chọn lọc. Chưa tạo next action, chưa ghi notification, chưa đưa vào workboard.
                  </div>
                </div>
              </div>
              {followUpSuggestions.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có gợi ý follow-up phù hợp.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {followUpSuggestions.map((item) => (
                    <div
                      key={item.key}
                      style={{
                        border: `1px solid ${item.severity === 'action' ? 'rgba(245,158,11,.35)' : 'rgba(59,130,246,.25)'}`,
                        background: item.severity === 'action' ? 'rgba(245,158,11,.08)' : 'rgba(59,130,246,.06)',
                        borderRadius: 10,
                        padding: 10,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{item.title}</div>
                        <button
                          className="btn btn-ghost"
                          onClick={() => {
                             navigator.clipboard.writeText(`${item.title}: ${item.detail}`).then(() => showToast('Đã copy gợi ý follow-up'))
                          }}
                          style={{ borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 11 }}
                        >
                          Copy
                        </button>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginTop: 6 }}>{item.detail}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 12, marginBottom: 12 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.2, color: 'var(--text4)', fontWeight: 700, marginBottom: 8 }}>CHI PHI THEO TANG</div>
          {levelCostRows.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có dữ liệu theo tầng.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {levelCostRows.map((row) => (
                <div key={`level-${row.level_index}`} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Tầng {row.level_index + 1}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.block_count} block</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--green)' }}>{formatMoney(row.subtotal)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.2, color: 'var(--text4)', fontWeight: 700, marginBottom: 8 }}>CƠ CẤU CHI PHÍ THEO LOẠI BLOCK</div>
          {componentCostRows.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có dữ liệu cơ cấu.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {componentCostRows.map((row) => (
                <div key={`component-${row.component_type}`} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{humanizeKey(row.component_type)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.block_count} block</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--orange)' }}>{formatMoney(row.subtotal)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.2, color: 'var(--text4)', fontWeight: 700, marginBottom: 8 }}>
          Chi tiết dự toán theo từng block
        </div>
        {blockGroups.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Không có block nào map được với dữ liệu preview.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {blockGroups.map((g) => {
              const rec = recomputeByBlock[g.block_id]
              const items = rec?.new_group_items?.length ? rec.new_group_items : g.items
              const subtotal = rec ? Number(rec.new_group_subtotal || 0) : g.subtotal
              return (
                <div key={g.block_id} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 10px', background: 'rgba(148,163,184,.06)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700 }}>{g.block_name} | {humanizeKey(g.component_type)} | tầng {g.level_index + 1}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>Mẫu áp dụng: {g.template_label}</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>Tổng block: {formatMoney(subtotal)}</div>
                  </div>

                  <div style={{ padding: 10 }}>
                    {items.map((it, idx) => {
                      const key = String(it.material_key || '')
                      return (
                        <div key={`${g.block_id}-${key}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.8fr 1fr auto', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(148,163,184,.12)' }}>
                          <div style={{ fontSize: 12, color: 'var(--text)' }}>{it.material_name || it.material_key} ({it.material_key})</div>
                          <div style={{ fontSize: 12, color: 'var(--text3)' }}>SL: {it.quantity != null ? Number(it.quantity).toFixed(2) : '-'} {it.unit || ''}</div>
                          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Đơn giá: {formatMoney(Number(it.unit_price || 0))}</div>
                          <div style={{ fontSize: 12, color: 'var(--orange)' }}>Thành tiền: {formatMoney(Number(it.cost || 0))}</div>
                          <select
                            className="select"
                            value={overridesByBlock[g.block_id]?.[key] || ''}
                            onChange={(e) => setOverride(g.block_id, key, e.target.value)}
                            style={{ minWidth: 180 }}
                          >
                            <option value="">(Nhà cung cấp mặc định)</option>
                            {suppliers.map((s) => <option key={`${g.block_id}-${key}-${s.value}`} value={s.value}>{s.name}</option>)}
                          </select>
                        </div>
                      )
                    })}
                    <div style={{ marginTop: 8 }}>
                      <button className="btn-primary" onClick={() => recomputeBlock(g)} disabled={busyBlockId === g.block_id}>
                        {busyBlockId === g.block_id ? 'Đang tính...' : 'Tính lại block'}
                      </button>
                    </div>
                    {!!rec?.warnings?.length && (
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--orange)' }}>
                        {rec.warnings.join(' | ')}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 9, padding: '10px 16px', fontSize: 13, zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
