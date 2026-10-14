import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { ACCOUNT_TYPES, type AccountTypeKey, type PermissionKey } from '@/lib/permissions'

export type AuthzContext = {
  session: Awaited<ReturnType<typeof getServerSession>>
  userId: string
  username: string
  role: string
  roleKeys: string[]
  accountTypeKeys: string[]
  primaryAccountTypeKey: string | null
  permissionKeys: PermissionKey[]
}

export async function getAuthzContext(): Promise<AuthzContext | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const userId = String(session.user.id)
  const prismaAny = db as any
  const [accountTypeMemberships, roleMemberships] = await Promise.all([
    prismaAny.userAccountTypeMembership.findMany({
      where: { user_id: userId },
      orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
      select: {
        is_primary: true,
        account_type: {
          select: {
            account_type_key: true,
            is_active: true,
          },
        },
      },
    }),
    prismaAny.userRoleMembership?.findMany
      ? prismaAny.userRoleMembership.findMany({
          where: { user_id: userId },
          orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
          select: {
            is_primary: true,
            role: {
              select: {
                role_key: true,
                is_active: true,
                role_permissions: {
                  select: {
                    permission: {
                      select: {
                        permission_key: true,
                        is_active: true,
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ])

  const activeKeys = accountTypeMemberships
    .filter((m: any) => Boolean(m.account_type?.is_active))
    .map((m: any) => String(m.account_type.account_type_key))

  const dbRoleKeys = roleMemberships
    .filter((m: any) => Boolean(m.role?.is_active))
    .map((m: any) => String(m.role.role_key))

  const roleKeys = Array.from(new Set<string>(dbRoleKeys.filter(Boolean) as string[]))

  const dbPermissionKeys: PermissionKey[] = Array.from(
    new Set(
      roleMemberships
        .filter((m: any) => Boolean(m.role?.is_active))
        .flatMap((m: any) => (Array.isArray(m.role?.role_permissions) ? m.role.role_permissions : []))
        .map((rp: any) => rp?.permission)
        .filter((p: any) => Boolean(p?.is_active) && Boolean(p?.permission_key))
        .map((p: any) => String(p.permission_key) as PermissionKey)
    )
  ) as PermissionKey[]

  return {
    session,
    userId,
    username: String(session.user.username || ''),
    role: String(dbRoleKeys[0] || ''),
    roleKeys,
    accountTypeKeys: activeKeys,
    primaryAccountTypeKey: activeKeys[0] || null,
    permissionKeys: dbPermissionKeys,
  }
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function forbidden(message = 'Khong co quyen') {
  return NextResponse.json({ error: message }, { status: 403 })
}

export async function requireAuth() {
  const ctx = await getAuthzContext()
  if (!ctx) return { error: unauthorized() as Response, ctx: null }
  return { error: null as Response | null, ctx }
}

export function hasRole(ctx: AuthzContext, roles: string[]) {
  return roles.some((role) => ctx.roleKeys.includes(role))
}

export function hasAccountType(ctx: AuthzContext, accountTypeKey: string) {
  return ctx.accountTypeKeys.includes(accountTypeKey)
}

export function hasAnyAccountType(ctx: AuthzContext, accountTypeKeys: string[]) {
  return accountTypeKeys.some((key) => ctx.accountTypeKeys.includes(key))
}

export function hasPermission(ctx: AuthzContext, permission: PermissionKey) {
  return ctx.permissionKeys.includes(permission)
}

export async function requireInternalUser() {
  const auth = await requireAuth()
  if (auth.error || !auth.ctx) return auth

  if (!hasAccountType(auth.ctx, ACCOUNT_TYPES.internalUser)) {
    return { error: forbidden('Chi tai khoan noi bo moi duoc dung API nay') as Response, ctx: null }
  }

  return auth
}

export async function requireRoles(roles: string[]) {
  const auth = await requireAuth()
  if (auth.error || !auth.ctx) return auth

  if (!hasRole(auth.ctx, roles)) {
    return { error: forbidden() as Response, ctx: null }
  }

  return auth
}

export async function requireAccountTypes(accountTypeKeys: AccountTypeKey[]) {
  const auth = await requireAuth()
  if (auth.error || !auth.ctx) return auth

  if (!hasAnyAccountType(auth.ctx, accountTypeKeys)) {
    return { error: forbidden() as Response, ctx: null }
  }

  return auth
}

export async function requirePermission(permission: PermissionKey) {
  const auth = await requireInternalUser()
  if (auth.error || !auth.ctx) return auth

  if (!hasPermission(auth.ctx, permission)) {
    return { error: forbidden() as Response, ctx: null }
  }

  return auth
}
