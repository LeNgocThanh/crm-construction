import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deletePoint } from '@/lib/rag/qdrant'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const entry = await db.ragEntry.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!entry) return NextResponse.json({ error: 'Khong tim thay' }, { status: 404 })

  try {
    await deletePoint(params.id)
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || 'delete_point_failed') }, { status: 500 })
  }

  await db.ragEntry.update({
    where: { id: params.id },
    data: { qdrant_id: null },
  })
  return NextResponse.json({ ok: true })
}
