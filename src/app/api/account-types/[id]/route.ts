import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const data: any = {}
  if (body.account_type_key !== undefined) {
    const key = String(body.account_type_key || '').trim().toLowerCase()
    if (!key) return NextResponse.json({ error: 'account_type_key khong hop le' }, { status: 400 })
    if (!/^[a-z0-9_]+$/.test(key)) return NextResponse.json({ error: 'account_type_key chi gom a-z, 0-9, _' }, { status: 400 })
    data.account_type_key = key
  }
  if (body.account_type_name !== undefined) {
    const name = String(body.account_type_name || '').trim()
    if (!name) return NextResponse.json({ error: 'account_type_name khong hop le' }, { status: 400 })
    data.account_type_name = name
  }
  if (body.description !== undefined) data.description = String(body.description || '').trim() || null
  if (body.is_active !== undefined) data.is_active = Boolean(body.is_active)

  const prismaAny = db as any
  const result = await prismaAny.accountType.update({ where: { id: params.id }, data })
  return NextResponse.json({ data: result })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.settingsManage)
  if (auth.error) return auth.error

  const prismaAny = db as any
  const used = await prismaAny.userAccountTypeMembership.count({ where: { account_type_id: params.id } })
  if (used > 0) {
    return NextResponse.json({ error: 'Loai tai khoan dang duoc gan user, hay tat is_active thay vi xoa' }, { status: 400 })
  }

  await prismaAny.accountType.delete({ where: { id: params.id } })
  return NextResponse.json({ message: 'Da xoa loai tai khoan' })
}
