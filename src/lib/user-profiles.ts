export const USER_ROLE_MEMBERSHIP_SELECT = {
  orderBy: [{ is_primary: 'desc' as const }, { created_at: 'asc' as const }],
  select: {
    is_primary: true,
    role: {
      select: {
        id: true,
        role_key: true,
        role_name: true,
        is_active: true,
      },
    },
  },
}

export const USER_PROFILE_SELECT = {
  id: true,
  username: true,
  full_name: true,
  email: true,
  phone: true,
  avatar_url: true,
  employee_code: true,
  job_title: true,
  is_active: true,
  last_login_at: true,
  created_at: true,
  updated_at: true,
  group_memberships: {
    orderBy: [{ is_primary: 'desc' as const }, { created_at: 'asc' as const }],
    select: {
      is_primary: true,
      role_in_group: true,
      group: { select: { id: true, group_key: true, group_name: true, is_active: true } },
    },
  },
  account_type_memberships: {
    orderBy: [{ is_primary: 'desc' as const }, { created_at: 'asc' as const }],
    select: {
      is_primary: true,
      account_type: { select: { id: true, account_type_key: true, account_type_name: true, is_active: true } },
    },
  },
  role_memberships: USER_ROLE_MEMBERSHIP_SELECT,
}

export function derivePrimaryRoleKey(user: any) {
  return String(
    (user?.role_memberships || [])
      .map((membership: any) => String(membership?.role?.role_key || '').trim())
      .find(Boolean) || ''
  ).trim()
}

export function mapUserPayload(user: any) {
  const groups = (user.group_memberships || []).map((m: any) => ({
    id: m.group.id,
    key: m.group.group_key,
    name: m.group.group_name,
    is_active: m.group.is_active,
    is_primary: m.is_primary,
    role_in_group: m.role_in_group || null,
  }))

  const account_types = (user.account_type_memberships || []).map((m: any) => ({
    id: m.account_type.id,
    key: m.account_type.account_type_key,
    name: m.account_type.account_type_name,
    is_active: m.account_type.is_active,
    is_primary: m.is_primary,
  }))

  const access_roles = (user.role_memberships || []).map((m: any) => ({
    id: m.role.id,
    key: m.role.role_key,
    name: m.role.role_name,
    is_active: m.role.is_active,
    is_primary: m.is_primary,
  }))

  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name || null,
    email: user.email || null,
    phone: user.phone || null,
    avatar_url: user.avatar_url || null,
    employee_code: user.employee_code || null,
    job_title: user.job_title || null,
    role: derivePrimaryRoleKey(user) || null,
    is_active: user.is_active,
    last_login_at: user.last_login_at || null,
    created_at: user.created_at,
    updated_at: user.updated_at,
    groups,
    primary_group: groups.find((g: any) => g.is_primary) || null,
    account_types,
    primary_account_type: account_types.find((a: any) => a.is_primary) || null,
    access_roles,
    primary_access_role: access_roles.find((r: any) => r.is_primary) || null,
  }
}

export const BASIC_USER_WITH_ROLE_SELECT = {
  id: true,
  username: true,
  full_name: true,
  email: true,
  phone: true,
  is_active: true,
  role_memberships: USER_ROLE_MEMBERSHIP_SELECT,
}

export function mapBasicUserWithRole(user: any) {
  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name || null,
    email: user.email || null,
    phone: user.phone || null,
    is_active: user.is_active,
    role: derivePrimaryRoleKey(user) || null,
  }
}
