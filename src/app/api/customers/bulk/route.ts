// src/app/api/customers/bulk/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.customersWrite)
  if (auth.error) return auth.error

  const { action, ids, value } = await req.json()
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Thieu ids' }, { status: 400 })
  }
  if (ids.length > 100) {
    return NextResponse.json({ error: 'Toi da 100 ban ghi' }, { status: 400 })
  }

  if (action === 'update_status') {
    await db.customer.updateMany({ where: { id: { in: ids } }, data: { status: value } })
    return NextResponse.json({ message: `Da cap nhat ${ids.length} khach hang`, affected: ids.length })
  }

  if (action === 'update_score') {
    await db.customer.updateMany({
      where: { id: { in: ids } },
      data: { potential_score: parseInt(value) },
    })
    return NextResponse.json({ message: `Da cap nhat ${ids.length} khach hang`, affected: ids.length })
  }

  if (action === 'delete') {
    const manageAuth = await requirePermission(PERMISSIONS.customersManage)
    if (manageAuth.error) return manageAuth.error

    await db.customer.deleteMany({ where: { id: { in: ids } } })
    return NextResponse.json({ message: `Da xoa ${ids.length} khach hang`, affected: ids.length })
  }

  return NextResponse.json({ error: 'Action khong hop le' }, { status: 400 })
}
