// src/app/api/customers/[id]/timeline/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.customersWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const { type, title, description, happened_at, metadata } = await req.json()
  if (!type || !title) return NextResponse.json({ error: 'Thiếu type hoặc title' }, { status: 400 })

  const event = await db.customerTimeline.create({
    data: {
      customer_id:  params.id,
      type, title,
      description:  description  || null,
      happened_at:  happened_at  ? new Date(happened_at) : new Date(),
      created_by:   session.user.id,
      metadata:     metadata     || undefined,
    },
    include: { creator: { select: { username: true } } },
  })

  // Auto update customer status nếu event là status_change
  if (type === 'status_change' && metadata?.new_status) {
    await db.customer.update({
      where: { id: params.id },
      data:  { status: metadata.new_status },
    })
  }

  return NextResponse.json({ data: event }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.customersManage)
  if (auth.error) return auth.error

  const { event_id } = await req.json()
  await db.customerTimeline.delete({ where: { id: event_id } })
  return NextResponse.json({ message: 'Đã xóa' })
}
