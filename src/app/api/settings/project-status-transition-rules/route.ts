import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error
  const activeOnly = new URL(req.url).searchParams.get('active_only') !== 'false'
  const rows = await (db as any).projectStatusTransitionRule.findMany({
    where: activeOnly ? { is_active: true } : undefined,
    orderBy: [{ sort_order: 'asc' }, { rule_name: 'asc' }],
  })
  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const created = await (db as any).projectStatusTransitionRule.create({
    data: {
      rule_code: String(body?.rule_code || '').trim(),
      rule_name: String(body?.rule_name || '').trim(),
      from_status_key: String(body?.from_status_key || '').trim(),
      to_status_key: String(body?.to_status_key || '').trim(),
      rule_mode: String(body?.rule_mode || 'warning'),
      check_type: String(body?.check_type || '').trim(),
      check_params: body?.check_params ?? null,
      message: String(body?.message || '').trim(),
      sort_order: Number(body?.sort_order || 0),
      is_active: body?.is_active !== false,
    },
  })
  return NextResponse.json({ data: created }, { status: 201 })
}
