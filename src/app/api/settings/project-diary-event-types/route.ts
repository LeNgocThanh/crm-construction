import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error
  const activeOnly = new URL(req.url).searchParams.get('active_only') !== 'false'
  const rows = await (db as any).projectDiaryEventType.findMany({
    where: activeOnly ? { is_active: true } : undefined,
    orderBy: [{ sort_order: 'asc' }, { event_name: 'asc' }],
  })
  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const eventKey = String(body?.event_key || '').trim()
  const eventName = String(body?.event_name || '').trim()
  if (!eventKey || !eventName) return NextResponse.json({ error: 'Thieu event_key/event_name' }, { status: 400 })
  const created = await (db as any).projectDiaryEventType.create({
    data: {
      event_key: eventKey,
      event_name: eventName,
      category: body?.category ? String(body.category) : null,
      description: body?.description ? String(body.description) : null,
      schema_json: body?.schema_json ?? null,
      default_severity: body?.default_severity ? String(body.default_severity) : null,
      default_investor_visible: body?.default_investor_visible !== false,
      sort_order: Number(body?.sort_order || 0),
      is_active: body?.is_active !== false,
    },
  })
  return NextResponse.json({ data: created }, { status: 201 })
}
