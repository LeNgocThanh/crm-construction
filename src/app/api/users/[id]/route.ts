import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { requireAuth, requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { mapUserPayload, USER_PROFILE_SELECT, derivePrimaryRoleKey } from '@/lib/user-profiles'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth.error) return auth.error
  if (!auth.ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isSelf = auth.ctx.userId === params.id
  const manageAuth = await requirePermission(PERMISSIONS.usersManage)
  const canManageUsers = Boolean(manageAuth.ctx)
  if (!isSelf && !canManageUsers) return NextResponse.json({ error: 'Khong co quyen' }, { status: 403 })

  const body = await req.json()
  const data: any = {}
  if (body.full_name !== undefined && canManageUsers) data.full_name = body.full_name ? String(body.full_name).trim() : null
  if (body.email !== undefined && canManageUsers) data.email = body.email ? String(body.email).trim() : null
  if (body.phone !== undefined) data.phone = body.phone
  if (body.avatar_url !== undefined && canManageUsers) data.avatar_url = body.avatar_url ? String(body.avatar_url).trim() : null
  if (body.employee_code !== undefined && canManageUsers) data.employee_code = body.employee_code ? String(body.employee_code).trim() : null
  if (body.job_title !== undefined && canManageUsers) data.job_title = body.job_title ? String(body.job_title).trim() : null
  if (body.is_active !== undefined && canManageUsers) data.is_active = body.is_active
  if (body.password) data.password_hash = await bcrypt.hash(body.password, 10)

  const groupIds: string[] | null = Array.isArray(body.group_ids)
    ? Array.from(new Set(body.group_ids.map((x: any) => String(x || '').trim()).filter(Boolean)))
    : null
  const primaryGroupId = typeof body.primary_group_id === 'string' ? body.primary_group_id.trim() : ''
  if (groupIds && primaryGroupId && !groupIds.includes(primaryGroupId)) groupIds.unshift(primaryGroupId)

  const accountTypeIds: string[] | null = Array.isArray(body.account_type_ids)
    ? Array.from(new Set(body.account_type_ids.map((x: any) => String(x || '').trim()).filter(Boolean)))
    : null
  const primaryAccountTypeId = typeof body.primary_account_type_id === 'string' ? body.primary_account_type_id.trim() : ''
  if (accountTypeIds && primaryAccountTypeId && !accountTypeIds.includes(primaryAccountTypeId)) accountTypeIds.unshift(primaryAccountTypeId)

  const roleIds: string[] | null = Array.isArray(body.role_ids)
    ? Array.from(new Set(body.role_ids.map((x: any) => String(x || '').trim()).filter(Boolean)))
    : null
  const primaryRoleId = typeof body.primary_role_id === 'string' ? body.primary_role_id.trim() : ''
  if (roleIds && primaryRoleId && !roleIds.includes(primaryRoleId)) roleIds.unshift(primaryRoleId)
  if (canManageUsers && roleIds && roleIds.length === 0 && body.role_ids !== undefined) {
    return NextResponse.json({ error: 'Can giu it nhat 1 access role' }, { status: 400 })
  }

  if (canManageUsers && data.email) {
    const existedEmail = await db.user.findFirst({
      where: {
        email: data.email,
        id: { not: params.id },
      },
      select: { id: true },
    })
    if (existedEmail) return NextResponse.json({ error: 'Email da ton tai' }, { status: 409 })
  }

  const user = await db.$transaction(async (tx) => {
    if (groupIds && canManageUsers) {
      await tx.userGroupMembership.deleteMany({ where: { user_id: params.id } })
      if (groupIds.length) {
        await tx.userGroupMembership.createMany({
          data: groupIds.map((gid: string) => ({
            user_id: params.id,
            group_id: gid,
            is_primary: gid === primaryGroupId,
          })),
          skipDuplicates: true,
        })
      }
    }

    if (accountTypeIds && canManageUsers) {
      const txAny = tx as any
      await txAny.userAccountTypeMembership.deleteMany({ where: { user_id: params.id } })
      if (accountTypeIds.length) {
        await txAny.userAccountTypeMembership.createMany({
          data: accountTypeIds.map((accountTypeId: string) => ({
            user_id: params.id,
            account_type_id: accountTypeId,
            is_primary: accountTypeId === primaryAccountTypeId,
          })),
          skipDuplicates: true,
        })
      }
    }

    if (roleIds && canManageUsers) {
      const txAny = tx as any
      await txAny.userRoleMembership.deleteMany({ where: { user_id: params.id } })
      if (roleIds.length) {
        await txAny.userRoleMembership.createMany({
          data: roleIds.map((roleId: string) => ({
            user_id: params.id,
            role_id: roleId,
            is_primary: roleId === primaryRoleId,
          })),
          skipDuplicates: true,
        })
      }
    }

    return tx.user.update({
      where: { id: params.id },
      data,
      select: USER_PROFILE_SELECT,
    })
  })

  if (canManageUsers) {
    const primaryRoleKey = derivePrimaryRoleKey(user)
    await db.user.update({
      where: { id: params.id },
      data: { role: primaryRoleKey || 'sales' },
    })
  }

  return NextResponse.json({ data: mapUserPayload(user) })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.usersManage)
  if (auth.error) return auth.error
  if (!auth.ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.ctx.userId === params.id) return NextResponse.json({ error: 'Khong tu xoa chinh minh' }, { status: 400 })

  await db.user.update({ where: { id: params.id }, data: { is_active: false } })
  return NextResponse.json({ message: 'Da vo hieu hoa user' })
}
