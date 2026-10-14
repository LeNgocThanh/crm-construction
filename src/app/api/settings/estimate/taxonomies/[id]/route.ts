import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function isAllowedKind(v: string) {
  return /^[a-z0-9_]+$/i.test(v)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const data: any = {}

  if (body.kind !== undefined) {
    const kind = String(body.kind || '').trim()
    if (!isAllowedKind(kind)) {
      return NextResponse.json({ error: 'kind không hợp lệ' }, { status: 400 })
    }
    data.kind = kind
  }
  if (body.value !== undefined) data.value = String(body.value || '').trim()
  if (body.name !== undefined || body.label !== undefined) {
    data.name = String(body.name ?? body.label ?? '').trim()
  }
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null
  if (body.sort_order !== undefined) data.sort_order = Number(body.sort_order) || 0
  if (body.is_active !== undefined) data.is_active = Boolean(body.is_active)

  const updated = await db.estimationTaxonomy.update({
    where: { id: params.id },
    data,
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  await db.estimationTaxonomy.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
