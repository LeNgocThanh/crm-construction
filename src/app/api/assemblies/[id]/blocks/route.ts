import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildCompatibleMapFromTaxonomies, isTemplateTypeCompatibleWithMap } from '@/lib/estimate/template-compat'
import { sanitizeAssemblyBlockDimensions } from '@/lib/estimate/block-semantics'

type Ctx = { params: { id: string } }

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

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assemblyId = String(ctx.params.id || '')
  const prismaAny = db as any
  const data = await prismaAny.projectAssemblyBlock.findMany({
    where: { assembly_id: assemblyId },
    orderBy: [{ is_active: 'desc' }, { level_index: 'asc' }, { sort_order: 'asc' }, { created_at: 'asc' }],
    include: { template: true },
  })
  return NextResponse.json({ data: jsonSafe(data) })
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assemblyId = String(ctx.params.id || '')
  const body = await req.json()
  const componentType = String(body?.component_type || '').trim()
  if (!componentType) return NextResponse.json({ error: 'Thieu component_type' }, { status: 400 })

  const prismaAny = db as any
  const compatTax = await prismaAny.estimationTaxonomy.findMany({
    where: { kind: 'assembly_component_template_map', is_active: true },
    select: { kind: true, value: true, is_active: true },
  })
  const compatMap = buildCompatibleMapFromTaxonomies(compatTax)
  const templateId = body?.template_id ? String(body.template_id) : null
  if (templateId) {
    const template = await prismaAny.estimationTemplateHeader.findUnique({
      where: { id: templateId },
      select: { id: true, template_type: true, is_active: true },
    })
    if (!template || !template.is_active) {
      return NextResponse.json({ error: 'Template khong ton tai hoac da tat' }, { status: 400 })
    }
    if (!isTemplateTypeCompatibleWithMap(componentType, template.template_type, compatMap)) {
      return NextResponse.json(
        { error: `Template type (${template.template_type}) khong phu hop voi component_type (${componentType})` },
        { status: 400 }
      )
    }
  }
  const data = await prismaAny.projectAssemblyBlock.create({
    data: {
      assembly_id: assemblyId,
      component_type: componentType,
      template_id: templateId,
      level_index: nat(body?.level_index),
      block_name: body?.block_name ? String(body.block_name) : null,
      dimensions_json: sanitizeAssemblyBlockDimensions(
        componentType,
        body?.dimensions_json && typeof body.dimensions_json === 'object' ? body.dimensions_json : null
      ),
      facts_override_json: body?.facts_override_json && typeof body.facts_override_json === 'object' ? body.facts_override_json : null,
      sort_order: nat(body?.sort_order),
      length_order: nat(body?.length_order),
      height_order: nat(body?.height_order),
      is_active: body?.is_active !== false,
    },
    include: { template: true },
  })

  return NextResponse.json({ data: jsonSafe(data) }, { status: 201 })
}
