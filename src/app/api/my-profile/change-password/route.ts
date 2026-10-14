import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/authz'

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.error || !auth.ctx) {
    return auth.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const currentPassword = String(body?.current_password || '')
  const newPassword = String(body?.new_password || '')
  const confirmPassword = String(body?.confirm_password || '')

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: 'Vui long nhap day du thong tin mat khau' }, { status: 400 })
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'Mat khau moi phai co it nhat 6 ky tu' }, { status: 400 })
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'Xac nhan mat khau moi khong khop' }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { id: auth.ctx.userId },
    select: { id: true, password_hash: true },
  })

  if (!user) return NextResponse.json({ error: 'Khong tim thay nguoi dung' }, { status: 404 })

  const isValid = await bcrypt.compare(currentPassword, user.password_hash)
  if (!isValid) {
    return NextResponse.json({ error: 'Mat khau hien tai khong dung' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await db.user.update({
    where: { id: auth.ctx.userId },
    data: { password_hash: passwordHash },
  })

  return NextResponse.json({ ok: true, message: 'Da doi mat khau' })
}
