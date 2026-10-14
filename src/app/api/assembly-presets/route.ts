import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { sanitizeAssemblyBlockDimensions } from '@/lib/estimate/block-semantics'

function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? Number(v) : v))) as T
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const activeOnly = String(sp.get('active_only') || 'true') !== 'false'
  const limitRaw = Number(sp.get('limit') || 100)
  const limit = Number.isFinite(limitRaw) ? Math.min(300, Math.max(1, Math.trunc(limitRaw))) : 100
  const prismaAny = db as any
  const where: any = {}
  if (activeOnly) where.is_active = true
  const data = await prismaAny.projectAssemblyPreset.findMany({
    where,
    orderBy: [{ updated_at: 'desc' }],
    take: limit,
    include: {
      blocks: {
        where: { is_active: true },
        orderBy: [{ level_index: 'asc' }, { sort_order: 'asc' }, { created_at: 'asc' }],
      },
    },
  })
  return NextResponse.json({ data: jsonSafe(data) })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const name = String(body?.name || '').trim()
  if (!name) return NextResponse.json({ error: 'Thieu name' }, { status: 400 })
  const sourceAssemblyId = String(body?.source_assembly_id || '').trim() || null
  const prismaAny = db as any

  let source: any = null
  if (sourceAssemblyId) {
    source = await prismaAny.projectAssembly.findUnique({
      where: { id: sourceAssemblyId },
      include: {
        blocks: {
          where: { is_active: true },
          orderBy: [{ level_index: 'asc' }, { sort_order: 'asc' }, { created_at: 'asc' }],
        },
      },
    })
    if (!source) return NextResponse.json({ error: 'Source assembly not found' }, { status: 404 })
  }

  const preset = await prismaAny.projectAssemblyPreset.create({
    data: {
      name,
      source_assembly_id: source?.id || null,
      house_type: body?.house_type ? String(body.house_type) : (source?.house_type || null),
      style: body?.style ? String(body.style) : (source?.style || null),
      level: body?.level ? String(body.level) : (source?.level || null),
      region_code: body?.region_code ? String(body.region_code) : (source?.region_code || 'ALL'),
      is_active: body?.is_active != null ? Boolean(body.is_active) : true,
      created_by: session.user.id,
    },
  })

  if (source?.blocks?.length) {
    await prismaAny.projectAssemblyPresetBlock.createMany({
      data: source.blocks.map((b: any) => ({
        preset_id: preset.id,
        component_type: String(b.component_type || ''),
        template_id: b.template_id || null,
        level_index: Number.isFinite(Number(b.level_index)) ? Math.trunc(Number(b.level_index)) : 0,
        block_name: b.block_name || null,
        dimensions_json: sanitizeAssemblyBlockDimensions(String(b.component_type || ''), b.dimensions_json || null),
        sort_order: Number.isFinite(Number(b.sort_order)) ? Math.trunc(Number(b.sort_order)) : 0,
        length_order: Number.isFinite(Number(b.length_order)) ? Math.trunc(Number(b.length_order)) : 0,
        height_order: Number.isFinite(Number(b.height_order)) ? Math.trunc(Number(b.height_order)) : 0,
        is_active: true,
      })),
    })
  }

  const data = await prismaAny.projectAssemblyPreset.findUnique({
    where: { id: preset.id },
    include: {
      blocks: {
        where: { is_active: true },
        orderBy: [{ level_index: 'asc' }, { sort_order: 'asc' }, { created_at: 'asc' }],
      },
    },
  })
  return NextResponse.json({ data: jsonSafe(data) }, { status: 201 })
}
