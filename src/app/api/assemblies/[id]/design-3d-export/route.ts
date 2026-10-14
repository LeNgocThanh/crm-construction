import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { sanitizeAssemblyBlockDimensions } from '@/lib/estimate/block-semantics'

type Ctx = { params: { id: string } }

function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? Number(v) : v))) as T
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

function minSizeByComponentType(componentType: string | null | undefined) {
  const t = String(componentType || '').trim().toLowerCase()
  if (t === 'slab' || t === 'ceiling') return 0.1
  return 0.5
}

function blockGeom(block: any) {
  const d = block?.dimensions_json && typeof block.dimensions_json === 'object' ? block.dimensions_json : {}
  const minDim = minSizeByComponentType(block?.component_type)
  const area = pickNum(d as Record<string, unknown>, ['area_m2', 'area', 'floor_area', 'footprint_area'])
  const length = Math.max(minDim, pickNum(d as Record<string, unknown>, ['length_m', 'length', 'build_length_m']) || Math.max(2, Math.sqrt(area || 25)))
  const width = Math.max(minDim, pickNum(d as Record<string, unknown>, ['width_m', 'width', 'build_width_m']) || 4)
  const defaultHeight = Math.max(2.8, area ? Math.sqrt(area) * 0.25 : 3.6)
  const height = Math.max(minDim, pickNum(d as Record<string, unknown>, ['height_m', 'floor_height_m', 'height']) || defaultHeight)
  const x = n((d as any).x_m) ?? 0
  const y = n((d as any).y_m) ?? 0
  const z = n((d as any).z_m) ?? 0
  return { length, width, height, x, y, z, area_hint_m2: area }
}

function componentTypeLabel(value: string | null | undefined) {
  switch (String(value || '').trim().toLowerCase()) {
    case 'foundation': return 'Móng'
    case 'basement': return 'Tầng hầm'
    case 'slab': return 'Sàn'
    case 'wall': return 'Tường'
    case 'room': return 'Phòng'
    case 'column': return 'Cột'
    case 'stair': return 'Cầu thang'
    case 'ceiling': return 'Trần'
    case 'tum': return 'Tum'
    case 'roof': return 'Mái'
    case 'tum_roof': return 'Mái tum'
    default: return value || 'Khối'
  }
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assemblyId = String(ctx.params.id || '')
  const prismaAny = db as any
  const assembly = await prismaAny.projectAssembly.findUnique({
    where: { id: assemblyId },
    include: {
      customer: { select: { id: true, full_name: true, address: true, status: true } },
      blocks: {
        where: { is_active: true },
        orderBy: [{ level_index: 'asc' }, { height_order: 'asc' }, { length_order: 'asc' }, { sort_order: 'asc' }, { created_at: 'asc' }],
        include: {
          template: { select: { id: true, template_name: true, template_type: true } },
        },
      },
    },
  })
  if (!assembly) return NextResponse.json({ error: 'Assembly not found' }, { status: 404 })

  const blocks = Array.isArray(assembly.blocks) ? assembly.blocks : []
  const mappedBlocks = blocks.map((block: any) => {
    const geom = blockGeom(block)
    const semanticDims = sanitizeAssemblyBlockDimensions(block.component_type, block.dimensions_json)
    return {
      id: String(block.id),
      name: block.block_name || null,
      component_type: block.component_type || null,
      component_type_label: componentTypeLabel(block.component_type),
      level_index: Number(block.level_index || 0),
      sort_order: Number(block.sort_order || 0),
      length_order: Number(block.length_order || 0),
      height_order: Number(block.height_order || 0),
      template: block.template ? {
        id: String(block.template.id),
        name: block.template.template_name || null,
        template_type: block.template.template_type || null,
      } : null,
      semantic: {
        room_type: (semanticDims as any).room_type || null,
        space_type: (semanticDims as any).space_type || null,
        space_profile: (semanticDims as any).space_profile || null,
        interior_preset: (semanticDims as any).interior_preset || null,
        opening_preset: (semanticDims as any).opening_preset || null,
        openings: Array.isArray((semanticDims as any).openings)
          ? (semanticDims as any).openings
          : [],
        foundation_type: (semanticDims as any).foundation_type || null,
        roof_preset: (semanticDims as any).roof_preset || null,
        stair_preset: (semanticDims as any).stair_preset || null,
        has_ceiling: Boolean((semanticDims as any).has_ceiling),
        has_paint: Boolean((semanticDims as any).has_paint),
        has_electrical: Boolean((semanticDims as any).has_electrical),
        has_plumbing: Boolean((semanticDims as any).has_plumbing),
        has_window: Boolean((semanticDims as any).has_window),
        has_door: Boolean((semanticDims as any).has_door),
      },
      position_m: {
        x: Number(geom.x.toFixed(2)),
        y: Number(geom.y.toFixed(2)),
        z: Number(geom.z.toFixed(2)),
      },
      size_m: {
        length: Number(geom.length.toFixed(2)),
        width: Number(geom.width.toFixed(2)),
        height: Number(geom.height.toFixed(2)),
      },
      footprint_area_m2: Number((geom.length * geom.width).toFixed(2)),
      volume_m3: Number((geom.length * geom.width * geom.height).toFixed(2)),
      area_hint_m2: geom.area_hint_m2 != null ? Number(Number(geom.area_hint_m2).toFixed(2)) : null,
      dimensions_json: block.dimensions_json || null,
      facts_override_json: block.facts_override_json || null,
    }
  })

  const levelsMap = new Map<number, any[]>()
  for (const block of mappedBlocks) {
    const lv = Number(block.level_index || 0)
    if (!levelsMap.has(lv)) levelsMap.set(lv, [])
    levelsMap.get(lv)!.push(block)
  }

  const levels = Array.from(levelsMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([levelIndex, items]: [number, any[]]) => {
      const totalFootprint = items.reduce((sum: number, x: any) => sum + Number(x.footprint_area_m2 || 0), 0)
      const maxHeight = items.reduce((sum: number, x: any) => Math.max(sum, Number(x.size_m?.height || 0)), 0)
      return {
        level_index: levelIndex,
        level_label: levelIndex === 0 ? 'Tầng trệt' : `Tầng ${levelIndex + 1}`,
        block_count: items.length,
        estimated_footprint_area_m2: Number(totalFootprint.toFixed(2)),
        max_block_height_m: Number(maxHeight.toFixed(2)),
        blocks: items,
      }
    })

  const componentStatsMap = new Map<string, { component_type: string; component_type_label: string; count: number; total_footprint_area_m2: number; total_volume_m3: number }>()
  for (const block of mappedBlocks) {
    const key = String(block.component_type || 'unknown')
    const current = componentStatsMap.get(key) || {
      component_type: key,
      component_type_label: block.component_type_label,
      count: 0,
      total_footprint_area_m2: 0,
      total_volume_m3: 0,
    }
    current.count += 1
    current.total_footprint_area_m2 += Number(block.footprint_area_m2 || 0)
    current.total_volume_m3 += Number(block.volume_m3 || 0)
    componentStatsMap.set(key, current)
  }

  const totalFootprint = mappedBlocks.reduce((sum: number, x: any) => sum + Number(x.footprint_area_m2 || 0), 0)
  const totalVolume = mappedBlocks.reduce((sum: number, x: any) => sum + Number(x.volume_m3 || 0), 0)
  const componentStats = Array.from(componentStatsMap.values()).map((x) => ({
    ...x,
    total_footprint_area_m2: Number(x.total_footprint_area_m2.toFixed(2)),
    total_volume_m3: Number(x.total_volume_m3.toFixed(2)),
  }))

  const briefLines = [
    `Tạo một phương án kiến trúc sơ bộ dựa trên dữ liệu 3D sau.`,
    `Tên phương án: ${assembly.name || '-'}.`,
    assembly.house_type ? `Loại nhà: ${assembly.house_type}.` : null,
    assembly.style ? `Phong cách mong muốn: ${assembly.style}.` : null,
    assembly.level ? `Mức hoàn thiện: ${assembly.level}.` : null,
    assembly.region_code ? `Mã vùng: ${assembly.region_code}.` : null,
    `Số tầng đang có dữ liệu: ${levels.length}.`,
    `Tổng số khối: ${mappedBlocks.length}.`,
    `Tổng diện tích footprint ước tính: ${Number(totalFootprint.toFixed(2))} m2.`,
    `Tổng thể tích khối ước tính: ${Number(totalVolume.toFixed(2))} m3.`,
    `Ưu tiên đọc cấu trúc theo từng tầng, từng block, vị trí và kích thước mét.`,
    `Không cần coi đây là bản vẽ kỹ thuật cuối cùng; hãy dựng thành concept sơ bộ dễ hiểu, hợp lý công năng.`,
  ].filter(Boolean)

  const payload = {
    schema_version: 'assembly-3d-export-v1',
    exported_at: new Date().toISOString(),
    export_purpose: 'Dữ liệu cho AI dựng concept kiến trúc sơ bộ từ assembly 3D',
    assembly: {
      id: String(assembly.id),
      name: assembly.name || null,
      house_type: assembly.house_type || null,
      style: assembly.style || null,
      finish_level: assembly.level || null,
      region_code: assembly.region_code || null,
      status: assembly.status || null,
      customer: assembly.customer ? {
        id: String(assembly.customer.id),
        name: assembly.customer.full_name || null,
        address: assembly.customer.address || null,
        status: assembly.customer.status || null,
      } : null,
    },
    summary: {
      level_count: levels.length,
      block_count: mappedBlocks.length,
      estimated_total_footprint_area_m2: Number(totalFootprint.toFixed(2)),
      estimated_total_volume_m3: Number(totalVolume.toFixed(2)),
      component_stats: componentStats,
    },
    levels,
    flat_blocks: mappedBlocks,
    ai_drawing_brief: briefLines.join(' '),
  }

  return NextResponse.json({ data: jsonSafe(payload) })
}
