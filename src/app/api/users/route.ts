import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { mapUserPayload, USER_PROFILE_SELECT, derivePrimaryRoleKey } from '@/lib/user-profiles'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.usersRead)
  if (auth.error) return auth.error

  const sp = new URL(req.url).searchParams
  const search = String(sp.get('search') || '').trim()

  const where: any = {}
  if (search) {
    where.OR = [
      { username: { contains: search, mode: 'insensitive' } },
      { full_name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { employee_code: { contains: search, mode: 'insensitive' } },
    ]
  }

  const users = await db.user.findMany({
    where,
    select: USER_PROFILE_SELECT,
    orderBy: { created_at: 'asc' },
  })

  return NextResponse.json({ data: users.map(mapUserPayload) })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.usersManage)
  if (auth.error) return auth.error

  const body = await req.json()
  const { username, password, full_name, email, phone, avatar_url, employee_code, job_title, group_ids, primary_group_id, account_type_ids, primary_account_type_id } = body
  const roleIds: string[] = Array.isArray(body.role_ids)
    ? (Array.from(new Set(body.role_ids.map((x: any) => String(x || '').trim()).filter(Boolean))) as string[])
    : []
  const primaryRoleId = typeof body.primary_role_id === 'string' ? body.primary_role_id.trim() : ''
  if (primaryRoleId && !roleIds.includes(primaryRoleId)) roleIds.unshift(primaryRoleId)
  if (!username || !password) return NextResponse.json({ error: 'Thieu username hoac password' }, { status: 400 })
  if (!roleIds.length) return NextResponse.json({ error: 'Can gan it nhat 1 access role' }, { status: 400 })

  const existing = await db.user.findUnique({ where: { username } })
  if (existing) return NextResponse.json({ error: 'Username da ton tai' }, { status: 409 })
  if (email) {
    const existedEmail = await db.user.findFirst({
      where: { email: String(email).trim() },
      select: { id: true },
    })
    if (existedEmail) return NextResponse.json({ error: 'Email da ton tai' }, { status: 409 })
  }

  const hash = await bcrypt.hash(password, 10)
  const groupIds = Array.isArray(group_ids) ? Array.from(new Set(group_ids.map((x: any) => String(x || '').trim()).filter(Boolean))) : []
  const primaryGroupId = typeof primary_group_id === 'string' ? primary_group_id.trim() : ''
  if (primaryGroupId && !groupIds.includes(primaryGroupId)) groupIds.unshift(primaryGroupId)

  const accountTypeIds = Array.isArray(account_type_ids) ? Array.from(new Set(account_type_ids.map((x: any) => String(x || '').trim()).filter(Boolean))) : []
  const primaryAccountTypeId = typeof primary_account_type_id === 'string' ? primary_account_type_id.trim() : ''
  if (primaryAccountTypeId && !accountTypeIds.includes(primaryAccountTypeId)) accountTypeIds.unshift(primaryAccountTypeId)

  const user = await db.$transaction(async (tx) => {
    const txAny = tx as any

    const created = await tx.user.create({
      data: {
        username,
        password_hash: hash,
        full_name: full_name ? String(full_name).trim() : null,
        email: email ? String(email).trim() : null,
        phone: phone || null,
        avatar_url: avatar_url ? String(avatar_url).trim() : null,
        employee_code: employee_code ? String(employee_code).trim() : null,
        job_title: job_title ? String(job_title).trim() : null,
        role: 'sales',
      },
      select: { id: true },
    })

    if (groupIds.length) {
      await tx.userGroupMembership.createMany({
        data: groupIds.map((gid: string) => ({
          user_id: created.id,
          group_id: gid,
          is_primary: gid === primaryGroupId,
        })),
        skipDuplicates: true,
      })
    }

    if (accountTypeIds.length) {
      await txAny.userAccountTypeMembership.createMany({
        data: accountTypeIds.map((accountTypeId: string) => ({
          user_id: created.id,
          account_type_id: accountTypeId,
          is_primary: accountTypeId === primaryAccountTypeId,
        })),
        skipDuplicates: true,
      })
    }

    if (roleIds.length) {
      await txAny.userRoleMembership.createMany({
        data: roleIds.map((roleId: string) => ({
          user_id: created.id,
          role_id: roleId,
          is_primary: roleId === primaryRoleId,
        })),
        skipDuplicates: true,
      })
    }

    return tx.user.findUnique({
      where: { id: created.id },
      select: USER_PROFILE_SELECT,
    })
  })

  if (user) {
    const primaryRoleKey = derivePrimaryRoleKey(user)
    if (primaryRoleKey) {
      await db.user.update({
        where: { id: user.id },
        data: { role: primaryRoleKey },
      })
    }
  }

  return NextResponse.json({ data: mapUserPayload(user) }, { status: 201 })
}
