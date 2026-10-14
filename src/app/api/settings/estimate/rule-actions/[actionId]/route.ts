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

export async function PATCH(req: NextRequest, { params }: { params: { actionId: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const prismaAny = db as any
  const data = await prismaAny.estimationRuleAction.update({
    where: { id: params.actionId },
    data: {
      ...(body.action_type !== undefined ? { action_type: String(body.action_type || '').trim() } : {}),
      ...(body.target_key !== undefined ? { target_key: body.target_key ? String(body.target_key) : null } : {}),
      ...(body.value_text !== undefined ? { value_text: body.value_text ? String(body.value_text) : null } : {}),
      ...(body.value_number !== undefined ? { value_number: toNumber(body.value_number) } : {}),
      ...(body.value_json !== undefined ? { value_json: body.value_json ?? null } : {}),
      ...(body.formula_expr !== undefined ? { formula_expr: body.formula_expr ? String(body.formula_expr) : null } : {}),
      ...(body.sort_order !== undefined ? { sort_order: toInt(body.sort_order) || 0 } : {}),
    },
  })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: { actionId: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const prismaAny = db as any
  await prismaAny.estimationRuleAction.delete({ where: { id: params.actionId } })
  return NextResponse.json({ ok: true })
}
