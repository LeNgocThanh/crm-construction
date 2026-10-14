export type UserDisplayLike = {
  username?: string | null
  full_name?: string | null
  role?: string | null
  primary_access_role?: {
    key?: string | null
    name?: string | null
  } | null
}

export function getUserRoleLabel(user?: UserDisplayLike | null) {
  return String(user?.primary_access_role?.name || user?.primary_access_role?.key || user?.role || '').trim() || '-'
}

export function getUserDisplayName(user?: UserDisplayLike | null) {
  const fullName = String(user?.full_name || '').trim()
  const username = String(user?.username || '').trim()
  if (fullName && username && fullName !== username) return `${fullName} (${username})`
  return fullName || username || '-'
}

export function getUserDisplayLabel(user?: UserDisplayLike | null) {
  const title = getUserDisplayName(user)
  const roleLabel = getUserRoleLabel(user)
  if (!roleLabel || roleLabel === '-') return title
  return `${title} (${roleLabel})`
}
