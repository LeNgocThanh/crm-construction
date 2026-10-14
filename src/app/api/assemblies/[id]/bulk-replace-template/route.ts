import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildCompatibleMapFromTaxonomies, isTemplateTypeCompatibleWithMap } from '@/lib/estimate/template-compat'

type Ctx = { params: { id: string } }

function natOrNull(v: unknown) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.trunc(n))
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assemblyId = String(ctx.params.id || '')
  const body = await req.json().catch(() => ({}))
  const componentType = String(body?.component_type || '').trim()
  const toTemplateId = String(body?.to_template_id || '').trim()
  const fromTemplateIdRaw = String(body?.from_template_id || '').trim()
  const fromTemplateId = fromTemplateIdRaw || null
  const levelIndex = natOrNull(body?.level_index)
  const dryRun = Boolean(body?.dry_run)

  if (!componentType) {
    return NextResponse.json({ error: 'Thieu component_type' }, { status: 400 })
  }
  if (!toTemplateId) {
    return NextResponse.json({ error: 'Thieu to_template_id' }, { status: 400 })
  }

  const prismaAny = db as any
  const [toTemplate, compatTax] = await Promise.all([
    prismaAny.estimationTemplateHeader.findUnique({
      where: { id: toTemplateId },
      select: { id: true, template_type: true, is_active: true, template_name: true },
    }),
    prismaAny.estimationTaxonomy.findMany({
      where: { kind: 'assembly_component_template_map', is_active: true },
      select: { kind: true, value: true, is_active: true },
    }),
  ])

  if (!toTemplate || !toTemplate.is_active) {
    return NextResponse.json({ error: 'Template moi khong ton tai hoac da tat' }, { status: 400 })
  }
  const compatMap = buildCompatibleMapFromTaxonomies(compatTax)
  if (!isTemplateTypeCompatibleWithMap(componentType, toTemplate.template_type, compatMap)) {
    return NextResponse.json(
      { error: `Template moi (${toTemplate.template_type}) khong phu hop voi component_type (${componentType})` },
      { status: 400 }
    )
  }

  const where: any = {
    assembly_id: assemblyId,
    is_active: true,
    component_type: componentType,
  }
  if (levelIndex != null) where.level_index = levelIndex
  if (fromTemplateId) where.template_id = fromTemplateId

  const matchedRows = await prismaAny.projectAssemblyBlock.findMany({
    where,
    select: { id: true, template_id: true },
  })

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      matched_count: matchedRows.length,
      updated_count: 0,
      updated_block_ids: [],
    })
  }

  if (!matchedRows.length) {
    return NextResponse.json({
      ok: true,
      dry_run: false,
      matched_count: 0,
      updated_count: 0,
      updated_block_ids: [],
    })
  }

  const ids = matchedRows.map((x: any) => String(x.id))
  const result = await prismaAny.projectAssemblyBlock.updateMany({
    where: { id: { in: ids } },
    data: { template_id: toTemplateId },
  })

  return NextResponse.json({
    ok: true,
    dry_run: false,
    matched_count: matchedRows.length,
    updated_count: Number(result?.count || 0),
    updated_block_ids: ids,
  })
}

