import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/authz'
import { mapUserPayload, USER_PROFILE_SELECT } from '@/lib/user-profiles'

export async function GET() {
  const auth = await requireAuth()
  if (auth.error || !auth.ctx) {
    return auth.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: auth.ctx.userId },
    select: USER_PROFILE_SELECT,
  })

  if (!user) return NextResponse.json({ error: 'Khong tim thay nguoi dung' }, { status: 404 })

  return NextResponse.json({ data: mapUserPayload(user) })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.error || !auth.ctx) {
    return auth.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const fullName = body?.full_name === undefined ? undefined : String(body.full_name || '').trim()
  const email = body?.email === undefined ? undefined : String(body.email || '').trim()
  const phone = body?.phone === undefined ? undefined : String(body.phone || '').trim()
  const avatarUrl = body?.avatar_url === undefined ? undefined : String(body.avatar_url || '').trim()

  if (email) {
    const existedEmail = await db.user.findFirst({
      where: {
        email,
        id: { not: auth.ctx.userId },
      },
      select: { id: true },
    })
    if (existedEmail) return NextResponse.json({ error: 'Email da ton tai' }, { status: 409 })
  }

  const user = await db.user.update({
    where: { id: auth.ctx.userId },
    data: {
      ...(fullName !== undefined ? { full_name: fullName || null } : {}),
      ...(email !== undefined ? { email: email || null } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(avatarUrl !== undefined ? { avatar_url: avatarUrl || null } : {}),
    },
    select: USER_PROFILE_SELECT,
  })

  return NextResponse.json({ data: mapUserPayload(user) })
}
