import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function GET() {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const rows = await (db as any).projectMilestoneTemplate.findMany({
    where: { is_active: true },
    orderBy: [{ sort_order: 'asc' }, { template_name: 'asc' }],
    include: {
      items: {
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
        include: {
          milestone_definition: { select: { id: true, definition_key: true, definition_name: true } },
        },
      },
    },
  })
  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json().catch(() => ({}))
  const templateCode = String(body?.template_code || '').trim()
  const templateName = String(body?.template_name || '').trim()
  if (!templateCode || !templateName) {
    return NextResponse.json({ error: 'Thieu template_code/template_name' }, { status: 400 })
  }

  const created = await (db as any).projectMilestoneTemplate.create({
    data: {
      template_code: templateCode,
      template_name: templateName,
      description: body?.description ? String(body.description) : null,
      house_type: body?.house_type ? String(body.house_type) : null,
      sort_order: Number(body?.sort_order || 0),
      is_active: body?.is_active !== false,
    },
  })

  return NextResponse.json({ data: created }, { status: 201 })
}

