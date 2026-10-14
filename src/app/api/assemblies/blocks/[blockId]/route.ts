import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildCompatibleMapFromTaxonomies, isTemplateTypeCompatibleWithMap } from '@/lib/estimate/template-compat'
import { sanitizeAssemblyBlockDimensions } from '@/lib/estimate/block-semantics'

type Ctx = { params: { blockId: string } }

function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
  ) as T
}
function nat(v: unknown) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.trunc(n))
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const blockId = String(ctx.params.blockId || '')
  const body = await req.json()
  const patch: any = {}
  if (body?.component_type !== undefined) patch.component_type = String(body.component_type || '').trim()
  if (body?.template_id !== undefined) patch.template_id = body.template_id ? String(body.template_id) : null
  if (body?.level_index !== undefined) patch.level_index = nat(body.level_index)
  if (body?.block_name !== undefined) patch.block_name = body.block_name ? String(body.block_name) : null
  if (body?.dimensions_json !== undefined) patch.dimensions_json = body.dimensions_json && typeof body.dimensions_json === 'object' ? body.dimensions_json : null
  if (body?.facts_override_json !== undefined) patch.facts_override_json = body.facts_override_json && typeof body.facts_override_json === 'object' ? body.facts_override_json : null
  if (body?.sort_order !== undefined) patch.sort_order = nat(body.sort_order)
  if (body?.length_order !== undefined) patch.length_order = nat(body.length_order)
  if (body?.height_order !== undefined) patch.height_order = nat(body.height_order)
  if (body?.is_active !== undefined) patch.is_active = Boolean(body.is_active)
  if (patch.component_type !== undefined && !patch.component_type) {
    return NextResponse.json({ error: 'component_type khong duoc rong' }, { status: 400 })
  }

  const prismaAny = db as any
  const compatTax = await prismaAny.estimationTaxonomy.findMany({
    where: { kind: 'assembly_component_template_map', is_active: true },
    select: { kind: true, value: true, is_active: true },
  })
  const compatMap = buildCompatibleMapFromTaxonomies(compatTax)
  let nextComponentType = patch.component_type
  let nextTemplateId = patch.template_id
  let currentDimensionsJson: unknown = null
  if (nextComponentType === undefined || nextTemplateId === undefined) {
    const current = await prismaAny.projectAssemblyBlock.findUnique({
      where: { id: blockId },
      select: { component_type: true, template_id: true, dimensions_json: true },
    })
    if (!current) return NextResponse.json({ error: 'Block not found' }, { status: 404 })
    if (nextComponentType === undefined) nextComponentType = current.component_type
    if (nextTemplateId === undefined) nextTemplateId = current.template_id
    currentDimensionsJson = current.dimensions_json
  }
  if (nextTemplateId) {
    const template = await prismaAny.estimationTemplateHeader.findUnique({
      where: { id: String(nextTemplateId) },
      select: { id: true, template_type: true, is_active: true },
    })
    if (!template || !template.is_active) {
      return NextResponse.json({ error: 'Template khong ton tai hoac da tat' }, { status: 400 })
    }
    if (!isTemplateTypeCompatibleWithMap(nextComponentType, template.template_type, compatMap)) {
      return NextResponse.json(
        { error: `Template type (${template.template_type}) khong phu hop voi component_type (${nextComponentType})` },
        { status: 400 }
      )
    }
  }
  if (patch.dimensions_json !== undefined) {
    patch.dimensions_json = sanitizeAssemblyBlockDimensions(nextComponentType, patch.dimensions_json)
  } else if (patch.component_type !== undefined) {
    patch.dimensions_json = sanitizeAssemblyBlockDimensions(nextComponentType, currentDimensionsJson)
  }
  const data = await prismaAny.projectAssemblyBlock.update({
    where: { id: blockId },
    data: patch,
    include: { template: true },
  })

  return NextResponse.json({ data: jsonSafe(data) })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const blockId = String(ctx.params.blockId || '')
  const prismaAny = db as any
  await prismaAny.projectAssemblyBlock.delete({ where: { id: blockId } })
  return NextResponse.json({ ok: true })
}
