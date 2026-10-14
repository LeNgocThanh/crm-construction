import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildAssemblyEstimateFacts, resolveTemplateIdsByCode } from '@/lib/estimate/assembly-facts'

type Ctx = { params: { id: string } }

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assemblyId = String(ctx.params.id || '')
  const prismaAny = db as any

  const assembly = await prismaAny.projectAssembly.findUnique({
    where: { id: assemblyId },
    include: {
      blocks: {
        where: { is_active: true },
        orderBy: [{ level_index: 'asc' }, { sort_order: 'asc' }, { created_at: 'asc' }],
        include: { template: true },
      },
    },
  })
  if (!assembly) return NextResponse.json({ error: 'Assembly not found' }, { status: 404 })

  const [presetTaxonomies, templateRows] = await Promise.all([
    prismaAny.estimationTaxonomy.findMany({
      where: {
        is_active: true,
        kind: { in: ['opening_preset', 'roof_preset', 'stair_preset', 'interior_preset', 'assembly_template_bundle_map'] },
      },
      select: { kind: true, value: true, name: true, description: true, is_active: true, sort_order: true },
    }),
    prismaAny.estimationTemplateHeader.findMany({
      where: { is_active: true },
      select: { id: true, template_code: true, version: true, is_active: true },
    }),
  ])

  const sharedFacts = buildAssemblyEstimateFacts({
    assembly,
    presetTaxonomies,
    bundleTaxonomies: presetTaxonomies,
    templateIdsByCode: resolveTemplateIdsByCode(templateRows),
  })

  return NextResponse.json({
    data: {
      assembly_id: assembly.id,
      assembly_name: assembly.name,
      inferred_input: sharedFacts.inferred_input,
      assembly_summary: sharedFacts.assembly_summary,
      block_rows: sharedFacts.block_rows,
      bundle_matches: sharedFacts.bundle_matches,
      extra_facts: sharedFacts.extra_facts,
      forced_template_ids_from_blocks: sharedFacts.forced_template_ids_from_blocks,
      forced_template_codes_from_bundles: sharedFacts.forced_template_codes_from_bundles,
      forced_template_ids_from_bundles: sharedFacts.forced_template_ids_from_bundles,
    },
  })
}
