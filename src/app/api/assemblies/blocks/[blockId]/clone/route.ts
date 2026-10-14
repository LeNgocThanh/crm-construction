import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { sanitizeAssemblyBlockDimensions } from '@/lib/estimate/block-semantics'

type Ctx = { params: { blockId: string } }

function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
  ) as T
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const blockId = String(ctx.params.blockId || '')
  const prismaAny = db as any
  const source = await prismaAny.projectAssemblyBlock.findUnique({
    where: { id: blockId },
  })
  if (!source) return NextResponse.json({ error: 'Block not found' }, { status: 404 })

  const data = await prismaAny.projectAssemblyBlock.create({
    data: {
      assembly_id: source.assembly_id,
      component_type: source.component_type,
      template_id: source.template_id || null,
      level_index: Number.isFinite(Number(source.level_index)) ? Math.trunc(Number(source.level_index)) : 0,
      block_name: source.block_name ? `${String(source.block_name)} (copy)` : null,
      dimensions_json: sanitizeAssemblyBlockDimensions(source.component_type, source.dimensions_json || null),
      facts_override_json: source.facts_override_json || null,
      sort_order: Number.isFinite(Number(source.sort_order)) ? Math.trunc(Number(source.sort_order)) : 0,
      length_order: Number.isFinite(Number(source.length_order)) ? Math.trunc(Number(source.length_order)) : 0,
      height_order: Number.isFinite(Number(source.height_order)) ? Math.trunc(Number(source.height_order)) : 0,
      is_active: true,
    },
    include: { template: true },
  })

  return NextResponse.json({ data: jsonSafe(data) }, { status: 201 })
}
