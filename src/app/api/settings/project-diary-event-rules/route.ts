import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error
  const activeOnly = new URL(req.url).searchParams.get('active_only') !== 'false'
  const rows = await (db as any).projectDiaryEventRule.findMany({
    where: activeOnly ? { is_active: true } : undefined,
    orderBy: [{ sort_order: 'asc' }, { rule_name: 'asc' }],
    include: { event_type: { select: { id: true, event_key: true, event_name: true } } },
  })
  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const created = await (db as any).projectDiaryEventRule.create({
    data: {
      rule_code: String(body?.rule_code || '').trim(),
      rule_name: String(body?.rule_name || '').trim(),
      event_type_id: body?.event_type_id ? String(body.event_type_id) : null,
      event_key: body?.event_key ? String(body.event_key) : null,
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
