import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildCompatibleMapFromTaxonomies, isTemplateTypeCompatibleWithMap } from '@/lib/estimate/template-compat'
import { sanitizeAssemblyBlockDimensions } from '@/lib/estimate/block-semantics'

function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? Number(v) : v))) as T
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const presetId = String(ctx.params.id || '')
  if (!presetId) return NextResponse.json({ error: 'Missing preset id' }, { status: 400 })
  const body = await req.json().catch(() => ({}))
  const prismaAny = db as any
  const compatTax = await prismaAny.estimationTaxonomy.findMany({
    where: { kind: 'assembly_component_template_map', is_active: true },
    select: { kind: true, value: true, is_active: true },
  })
  const compatMap = buildCompatibleMapFromTaxonomies(compatTax)

  const preset = await prismaAny.projectAssemblyPreset.findUnique({
    where: { id: presetId },
    include: {
      blocks: {
        where: { is_active: true },
        orderBy: [{ level_index: 'asc' }, { sort_order: 'asc' }, { created_at: 'asc' }],
        include: { template: true },
      },
    },
  })
  if (!preset) return NextResponse.json({ error: 'Preset not found' }, { status: 404 })

  const assemblyName = String(body?.name || '').trim() || `${preset.name} - copy`
  const created = await prismaAny.projectAssembly.create({
    data: {
      customer_id: body?.customer_id ? String(body.customer_id) : null,
      name: assemblyName,
      house_type: body?.house_type ? String(body.house_type) : (preset.house_type || null),
      style: body?.style ? String(body.style) : (preset.style || null),
      level: body?.level ? String(body.level) : (preset.level || null),
      region_code: body?.region_code ? String(body.region_code) : (preset.region_code || 'ALL'),
      status: body?.status ? String(body.status) : 'draft',
      created_by: session.user.id,
    },
  })

  if (preset.blocks?.length) {
    await prismaAny.projectAssemblyBlock.createMany({
      data: preset.blocks.map((b: any) => ({
        assembly_id: created.id,
        component_type: String(b.component_type || ''),
        template_id:
          b.template_id && isTemplateTypeCompatibleWithMap(b.component_type, b?.template?.template_type, compatMap)
            ? b.template_id
            : null,
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

  const data = await prismaAny.projectAssembly.findUnique({
    where: { id: created.id },
    include: {
      blocks: {
        where: { is_active: true },
        orderBy: [{ level_index: 'asc' }, { sort_order: 'asc' }, { created_at: 'asc' }],
        include: { template: true },
      },
    },
  })
  return NextResponse.json({ data: jsonSafe(data) }, { status: 201 })
}
