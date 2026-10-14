import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { sanitizeAssemblyBlockDimensions } from '@/lib/estimate/block-semantics'

type Ctx = { params: { id: string } }

function nat(v: unknown) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.trunc(n))
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assemblyId = String(ctx.params.id || '')
  const body = await req.json().catch(() => ({}))
  const fromLevel = nat(body?.from_level_index)
  const toLevel = nat(body?.to_level_index)
  const overwriteTarget = Boolean(body?.overwrite_target)

  if (fromLevel === toLevel) {
    return NextResponse.json({ error: 'Tang nguon va tang dich khong duoc trung' }, { status: 400 })
  }

  const prismaAny = db as any
  const sourceBlocks = await prismaAny.projectAssemblyBlock.findMany({
    where: {
      assembly_id: assemblyId,
      level_index: fromLevel,
      is_active: true,
    },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  })
  if (!sourceBlocks.length) {
    return NextResponse.json({ error: 'Tang nguon khong co block de clone' }, { status: 404 })
  }

  const result = await prismaAny.$transaction(async (tx: any) => {
    if (overwriteTarget) {
      await tx.projectAssemblyBlock.deleteMany({
        where: {
          assembly_id: assemblyId,
          level_index: toLevel,
        },
      })
    }

    const payload = sourceBlocks.map((b: any) => ({
      assembly_id: assemblyId,
      component_type: String(b.component_type || ''),
      template_id: b.template_id || null,
      level_index: toLevel,
      block_name: b.block_name ? `${String(b.block_name)} (copy)` : null,
      dimensions_json: sanitizeAssemblyBlockDimensions(String(b.component_type || ''), b.dimensions_json || null),
      facts_override_json: b.facts_override_json || null,
      sort_order: Number.isFinite(Number(b.sort_order)) ? Math.trunc(Number(b.sort_order)) : 0,
      length_order: Number.isFinite(Number(b.length_order)) ? Math.trunc(Number(b.length_order)) : 0,
      height_order: Number.isFinite(Number(b.height_order)) ? Math.trunc(Number(b.height_order)) : 0,
      is_active: true,
    }))

    const created = await tx.projectAssemblyBlock.createMany({ data: payload })
    return { created_count: Number(created?.count || 0) }
  })

  return NextResponse.json({
    ok: true,
    from_level_index: fromLevel,
    to_level_index: toLevel,
    overwrite_target: overwriteTarget,
    ...result,
  })
}
