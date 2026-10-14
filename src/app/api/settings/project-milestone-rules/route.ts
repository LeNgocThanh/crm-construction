import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const activeOnly = new URL(req.url).searchParams.get('active_only') !== 'false'
  const rows = await (db as any).projectMilestoneRule.findMany({
    where: activeOnly ? { is_active: true } : undefined,
    orderBy: [{ sort_order: 'asc' }, { rule_name: 'asc' }],
    include: {
      milestone_definition: { select: { id: true, definition_key: true, definition_name: true } },
    },
  })
  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const ruleCode = String(body?.rule_code || '').trim()
  const ruleName = String(body?.rule_name || '').trim()
  const checkType = String(body?.check_type || '').trim()
  const warningMessage = String(body?.warning_message || '').trim()
  const triggerStatus = String(body?.trigger_status_key || 'completed').trim() || 'completed'

  if (!ruleCode || !ruleName || !checkType || !warningMessage) {
    return NextResponse.json({ error: 'Thieu du lieu bat buoc' }, { status: 400 })
  }

  const created = await (db as any).projectMilestoneRule.create({
    data: {
      rule_code: ruleCode,
      rule_name: ruleName,
      milestone_definition_id: body?.milestone_definition_id ? String(body.milestone_definition_id) : null,
      milestone_key: body?.milestone_key ? String(body.milestone_key) : null,
      trigger_status_key: triggerStatus,
      check_type: checkType,
      check_params: body?.check_params ?? null,
      warning_message: warningMessage,
      sort_order: Number(body?.sort_order || 0),
      is_active: body?.is_active !== false,
    },
  })

  return NextResponse.json({ data: created }, { status: 201 })
}
