import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const data: any = {}
  if (body.group_key !== undefined) {
    const key = String(body.group_key || '').trim().toLowerCase()
    if (!key) return NextResponse.json({ error: 'group_key khong hop le' }, { status: 400 })
    if (!/^[a-z0-9_]+$/.test(key)) return NextResponse.json({ error: 'group_key chi gom a-z, 0-9, _' }, { status: 400 })
    data.group_key = key
  }
  if (body.group_name !== undefined) {
    const name = String(body.group_name || '').trim()
    if (!name) return NextResponse.json({ error: 'group_name khong hop le' }, { status: 400 })
    data.group_name = name
  }
  if (body.description !== undefined) data.description = String(body.description || '').trim() || null
  if (body.is_active !== undefined) data.is_active = Boolean(body.is_active)

  const result = await db.group.update({ where: { id: params.id }, data })
  return NextResponse.json({ data: result })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const used = await db.userGroupMembership.count({ where: { group_id: params.id } })
  if (used > 0) {
    return NextResponse.json({ error: 'Group dang duoc gan user, hay tat is_active thay vi xoa' }, { status: 400 })
  }

  await db.group.delete({ where: { id: params.id } })
  return NextResponse.json({ message: 'Da xoa group' })
}
