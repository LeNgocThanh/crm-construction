// src/app/api/customers/export/route.ts — V2.0 Prisma
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

function escapeCSV(val: any): string {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n'))
    return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.customersRead)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const where: any = {}
  if (status) where.status = status
  if (!auth.ctx!.permissionKeys.includes(PERMISSIONS.customersManage)) {
    const logs = await db.contactLog.findMany({
      where: { sales_id: session.user.id },
      select: { customer_id: true },
      distinct: ['customer_id'],
    })
    where.id = { in: logs.map(l => l.customer_id) }
  }

  const customers = await db.customer.findMany({
    where,
    orderBy: { created_at: 'desc' },
  })

  const headers = ['SĐT', 'Họ tên', 'Trạng thái', 'Lead Score', 'Tổng liên hệ', 'Ngày tạo']
  const rows = customers.map(c => [
    c.phone_number,
    c.full_name      || '',
    c.status,
    c.potential_score ?? '',
    c.total_contacts,
    c.created_at.toISOString().split('T')[0],
  ].map(escapeCSV).join(','))

  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n')
  const date = new Date().toISOString().split('T')[0]

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="customers_${date}.csv"`,
    },
  })
}
