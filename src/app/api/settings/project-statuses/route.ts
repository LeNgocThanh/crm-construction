import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error
  const activeOnly = new URL(req.url).searchParams.get('active_only') !== 'false'
  const rows = await (db as any).projectStatus.findMany({
    where: activeOnly ? { is_active: true } : undefined,
    orderBy: [{ sort_order: 'asc' }, { status_name: 'asc' }],
  })
  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error
  const body = await req.json().catch(() => ({}))
  const key = String(body?.status_key || '').trim()
  const name = String(body?.status_name || '').trim()
  if (!key || !name) return NextResponse.json({ error: 'Thieu status_key/status_name' }, { status: 400 })
  const created = await (db as any).projectStatus.create({
    data: {
      status_key: key,
      status_name: name,
      description: body?.description ? String(body.description) : null,
      sort_order: Number(body?.sort_order || 0),
      is_terminal: Boolean(body?.is_terminal),
      color_hex: body?.color_hex ? String(body.color_hex) : null,
      is_active: body?.is_active !== false,
    },
  })
  return NextResponse.json({ data: created }, { status: 201 })
}
