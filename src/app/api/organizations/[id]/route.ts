import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireRoles } from '@/lib/authz'
import { db } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(['admin', 'manager'])
  if (auth.error) return auth.error

  const body = await req.json()
  const data: any = {}
  if (body.parent_id !== undefined) {
    const parentId = String(body.parent_id || '').trim() || null
    if (parentId && parentId === params.id) return NextResponse.json({ error: 'Khong the gan parent la chinh no' }, { status: 400 })
    data.parent_id = parentId
  }
  if (body.org_key !== undefined) {
    const key = String(body.org_key || '').trim().toLowerCase()
    if (!key || !/^[a-z0-9_]+$/.test(key)) return NextResponse.json({ error: 'org_key khong hop le' }, { status: 400 })
    data.org_key = key
  }
  if (body.org_name !== undefined) {
    const name = String(body.org_name || '').trim()
    if (!name) return NextResponse.json({ error: 'org_name khong hop le' }, { status: 400 })
    data.org_name = name
  }
  if (body.org_type !== undefined) data.org_type = String(body.org_type || '').trim() || null
  if (body.region_code !== undefined) data.region_code = String(body.region_code || '').trim() || null
  if (body.address !== undefined) data.address = String(body.address || '').trim() || null
  if (body.legal_name !== undefined) data.legal_name = String(body.legal_name || '').trim() || null
  if (body.tax_code !== undefined) data.tax_code = String(body.tax_code || '').trim() || null
  if (body.description !== undefined) data.description = String(body.description || '').trim() || null
  if (body.is_active !== undefined) data.is_active = Boolean(body.is_active)

  const result = await db.organization.update({ where: { id: params.id }, data })
  return NextResponse.json({ data: result })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(['admin', 'manager'])
  if (auth.error) return auth.error

  const deptCount = await db.department.count({ where: { organization_id: params.id } })
  const childOrgCount = await db.organization.count({ where: { parent_id: params.id } })
  if (deptCount > 0) {
    return NextResponse.json({ error: 'Organization dang co departments, hay tat is_active thay vi xoa' }, { status: 400 })
  }
  if (childOrgCount > 0) {
    return NextResponse.json({ error: 'Organization dang co cong ty con, hay tach parent hoac tat is_active' }, { status: 400 })
  }

  await db.organization.delete({ where: { id: params.id } })
  return NextResponse.json({ message: 'Da xoa organization' })
}
