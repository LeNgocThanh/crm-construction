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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const actionType = String(body.action_type || '').trim()
  if (!actionType) {
    return NextResponse.json({ error: 'Thieu action_type' }, { status: 400 })
  }

  const prismaAny = db as any
  const data = await prismaAny.estimationRuleAction.create({
    data: {
      rule_id: params.id,
      action_type: actionType,
      target_key: body.target_key ? String(body.target_key) : null,
      value_text: body.value_text ? String(body.value_text) : null,
      value_number: toNumber(body.value_number),
      value_json: body.value_json ?? null,
      formula_expr: body.formula_expr ? String(body.formula_expr) : null,
      sort_order: toInt(body.sort_order) || 0,
    },
  })
  return NextResponse.json({ data }, { status: 201 })
}
