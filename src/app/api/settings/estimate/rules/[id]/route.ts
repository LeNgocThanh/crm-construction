import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const prismaAny = db as any
  const current = await prismaAny.estimationRuleHeader.findUnique({ where: { id: params.id } })
  if (!current) {
    return NextResponse.json({ error: 'Rule khong ton tai' }, { status: 404 })
  }

  const nextRuleCode = body.rule_code !== undefined ? String(body.rule_code || '').trim() : current.rule_code
  const shouldActivate = body.is_active !== undefined ? Boolean(body.is_active) : current.is_active

  const data = await prismaAny.$transaction(async (tx: any) => {
    const updated = await tx.estimationRuleHeader.update({
      where: { id: params.id },
      data: {
        ...(body.rule_code !== undefined ? { rule_code: nextRuleCode } : {}),
        ...(body.rule_name !== undefined ? { rule_name: String(body.rule_name || '').trim() } : {}),
        ...(body.scope !== undefined ? { scope: String(body.scope || '').trim() } : {}),
        ...(body.priority !== undefined ? { priority: toInt(body.priority) || 0 } : {}),
        ...(body.version !== undefined ? { version: Math.max(1, toInt(body.version) || 1) } : {}),
        ...(body.is_active !== undefined ? { is_active: shouldActivate } : {}),
        ...(body.effective_from !== undefined ? { effective_from: body.effective_from ? new Date(body.effective_from) : null } : {}),
        ...(body.effective_to !== undefined ? { effective_to: body.effective_to ? new Date(body.effective_to) : null } : {}),
        ...(body.description !== undefined ? { description: body.description ? String(body.description) : null } : {}),
      },
    })

    // Rule standard: chi 1 version active cho moi rule_code
    if (shouldActivate) {
      await tx.estimationRuleHeader.updateMany({
        where: {
          rule_code: nextRuleCode,
          id: { not: updated.id },
          is_active: true,
        },
        data: { is_active: false },
      })
    }
    return updated
  })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const prismaAny = db as any
  await prismaAny.estimationRuleHeader.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
