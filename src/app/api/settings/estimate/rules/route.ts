import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const activeOnly = sp.get('active_only') !== 'false'
  const scope = sp.get('scope')

  const where: any = {}
  if (activeOnly) where.is_active = true
  if (scope) where.scope = scope

  const prismaAny = db as any
  const data = await prismaAny.estimationRuleHeader.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { updated_at: 'desc' }],
    include: {
      conditions: { orderBy: { sort_order: 'asc' } },
      actions: { orderBy: { sort_order: 'asc' } },
    },
  })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const body = await req.json()
  const ruleCode = String(body.rule_code || '').trim()
  const ruleName = String(body.rule_name || '').trim()
  const scope = String(body.scope || '').trim()
  if (!ruleCode || !ruleName || !scope) {
    return NextResponse.json({ error: 'Thieu rule_code, rule_name hoac scope' }, { status: 400 })
  }

  const prismaAny = db as any
  const shouldActivate = body.is_active !== false
  const data = await prismaAny.$transaction(async (tx: any) => {
    const created = await tx.estimationRuleHeader.create({
      data: {
        rule_code: ruleCode,
        rule_name: ruleName,
        scope,
        priority: toInt(body.priority) || 0,
        version: Math.max(1, toInt(body.version) || 1),
        is_active: shouldActivate,
        effective_from: body.effective_from ? new Date(body.effective_from) : null,
        effective_to: body.effective_to ? new Date(body.effective_to) : null,
        description: body.description ? String(body.description) : null,
        created_by: session.user.id,
      },
    })

    // Rule standard: chi 1 version active cho moi rule_code
    if (shouldActivate) {
      await tx.estimationRuleHeader.updateMany({
        where: {
          rule_code: ruleCode,
          id: { not: created.id },
          is_active: true,
        },
        data: { is_active: false },
      })
    }

    return created
  })
  return NextResponse.json({ data }, { status: 201 })
}
