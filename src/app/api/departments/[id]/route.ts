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
  if (body.organization_id !== undefined) data.organization_id = String(body.organization_id || '').trim()
  if (body.parent_id !== undefined) data.parent_id = String(body.parent_id || '').trim() || null
  if (body.dept_key !== undefined) {
    const key = String(body.dept_key || '').trim().toLowerCase()
    if (!key || !/^[a-z0-9_]+$/.test(key)) return NextResponse.json({ error: 'dept_key khong hop le' }, { status: 400 })
    data.dept_key = key
  }
  if (body.dept_name !== undefined) {
    const name = String(body.dept_name || '').trim()
    if (!name) return NextResponse.json({ error: 'dept_name khong hop le' }, { status: 400 })
    data.dept_name = name
  }
  if (body.description !== undefined) data.description = String(body.description || '').trim() || null
  if (body.sort_order !== undefined) data.sort_order = Number(body.sort_order || 0) || 0
  if (body.is_active !== undefined) data.is_active = Boolean(body.is_active)

  const result = await db.department.update({ where: { id: params.id }, data })
  return NextResponse.json({ data: result })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(['admin', 'manager'])
  if (auth.error) return auth.error

  const childCount = await db.department.count({ where: { parent_id: params.id } })
  if (childCount > 0) return NextResponse.json({ error: 'Department dang co bo phan con, hay chuyen parent hoac tat is_active' }, { status: 400 })

  await db.department.delete({ where: { id: params.id } })
  return NextResponse.json({ message: 'Da xoa department' })
}

