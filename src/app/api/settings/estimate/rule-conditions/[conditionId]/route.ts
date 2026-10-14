import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export async function PATCH(req: NextRequest, { params }: { params: { conditionId: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const prismaAny = db as any
  const data = await prismaAny.estimationRuleCondition.update({
    where: { id: params.conditionId },
    data: {
      ...(body.fact_key !== undefined ? { fact_key: String(body.fact_key || '').trim() } : {}),
      ...(body.operator !== undefined ? { operator: String(body.operator || '').trim() } : {}),
      ...(body.value_text !== undefined ? { value_text: body.value_text ? String(body.value_text) : null } : {}),
      ...(body.value_number !== undefined ? { value_number: toNumber(body.value_number) } : {}),
      ...(body.value_json !== undefined ? { value_json: body.value_json ?? null } : {}),
      ...(body.sort_order !== undefined ? { sort_order: toInt(body.sort_order) || 0 } : {}),
    },
  })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: { conditionId: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const prismaAny = db as any
  await prismaAny.estimationRuleCondition.delete({ where: { id: params.conditionId } })
  return NextResponse.json({ ok: true })
}
