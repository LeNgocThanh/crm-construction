import { db } from '@/lib/db'
import { forbidden, hasPermission, requireInternalUser, type AuthzContext } from '@/lib/authz'
import { PERMISSIONS, type PermissionKey } from '@/lib/permissions'

export type ResourceType =
  | 'customer'
  | 'project'
  | 'conversation'
  | 'warehouse'
  | 'asset'
  | 'labor_worker'

export type ResourceAction =
  | 'read'
  | 'write'
  | 'delete'
  | 'assign'
  | 'approve'
  | 'manage'

export type ScopeKey =
  | 'all'
  | 'owner'
  | 'assignee'
  | 'default_owner'
  | 'customer_assignee'
  | 'group'
  | 'organization'
  | 'explicit_access'

export type ResourceAccessFacts = {
  ownerUserId?: string | null
  assigneeUserId?: string | null
  defaultOwnerUserId?: string | null
  customerId?: string | null
  customerAssigneeUserId?: string | null
  groupIds?: string[]
  organizationIds?: string[]
}

export type ExplicitResourceGrant = {
  id: string
  accessLevel: string | null
  canRead: boolean
  canWrite: boolean
  canApprove: boolean
  canManage: boolean
  expiresAt: Date | null
}

export type AccessDecision = {
  allowed: boolean
  permission: PermissionKey | null
  resourceType: ResourceType
  action: ResourceAction
  matchedScope: ScopeKey | null
  availableScopes: ScopeKey[]
  reason: string
  facts: ResourceAccessFacts | null
}

const RESOURCE_PERMISSION_MAP: Record<ResourceType, Partial<Record<ResourceAction, PermissionKey>>> = {
  customer: {
    read: PERMISSIONS.customersRead,
    write: PERMISSIONS.customersWrite,
    delete: PERMISSIONS.customersWrite,
    assign: PERMISSIONS.customersWrite,
    approve: PERMISSIONS.customersWrite,
    manage: PERMISSIONS.customersWrite,
  },
  project: {
    read: PERMISSIONS.projectsRead,
    write: PERMISSIONS.projectsWrite,
    delete: PERMISSIONS.projectsWrite,
    assign: PERMISSIONS.projectsWrite,
    approve: PERMISSIONS.projectsWrite,
    manage: PERMISSIONS.projectsWrite,
  },
  conversation: {
    read: PERMISSIONS.conversationsRead,
    write: PERMISSIONS.conversationsWrite,
    delete: PERMISSIONS.conversationsWrite,
    assign: PERMISSIONS.conversationsWrite,
    manage: PERMISSIONS.conversationsWrite,
  },
  warehouse: {
    read: PERMISSIONS.inventoryRead,
    write: PERMISSIONS.inventoryWrite,
    delete: PERMISSIONS.inventoryWrite,
    approve: PERMISSIONS.inventoryWrite,
    manage: PERMISSIONS.inventoryWrite,
  },
  asset: {
    read: PERMISSIONS.assetsRead,
    write: PERMISSIONS.assetsWrite,
    delete: PERMISSIONS.assetsWrite,
    assign: PERMISSIONS.assetsWrite,
    approve: PERMISSIONS.assetsWrite,
    manage: PERMISSIONS.assetsWrite,
  },
  labor_worker: {
    read: PERMISSIONS.laborRead,
    write: PERMISSIONS.laborWrite,
    delete: PERMISSIONS.laborWrite,
    assign: PERMISSIONS.laborWrite,
    approve: PERMISSIONS.laborWrite,
    manage: PERMISSIONS.laborWrite,
  },
}

const ROLE_SCOPE_POLICY: Record<string, Partial<Record<ResourceType, Partial<Record<ResourceAction, ScopeKey[]>>>>> = {
  admin: {},
  manager: {},
  sales: {
    customer: {
      read: ['all'],
      write: ['all'],
      delete: ['all'],
      assign: ['all'],
      approve: ['all'],
      manage: ['all'],
    },
    project: {
      read: ['all'],
      write: ['all'],
      delete: ['all'],
      assign: ['all'],
      approve: ['all'],
      manage: ['all'],
    },
    conversation: {
      read: ['all'],
      write: ['all'],
      assign: ['all'],
      manage: ['all'],
    },
  },
}

function normalizeId(value: unknown) {
  const text = String(value || '').trim()
  return text || null
}

export function getPermissionForResourceAction(resourceType: ResourceType, action: ResourceAction) {
  return RESOURCE_PERMISSION_MAP[resourceType]?.[action] || null
}

export function resolveScope(
  ctx: AuthzContext,
  resourceType: ResourceType,
  action: ResourceAction
): ScopeKey[] {
  const isManagerScope = ctx.roleKeys.includes('admin') || ctx.roleKeys.includes('manager')
  const base = isManagerScope
    ? ['all']
    : (
        ctx.roleKeys
          .flatMap((roleKey) => ROLE_SCOPE_POLICY[roleKey]?.[resourceType]?.[action] || [])
          .filter(Boolean) as ScopeKey[]
      )
  const normalizedBase = base.length ? base : ['all']
  return Array.from(new Set([...(normalizedBase as ScopeKey[]), 'explicit_access']))
}

async function getUserGroupIds(userId: string) {
  const rows = await (db as any).userGroupMembership.findMany({
    where: { user_id: userId },
    select: { group_id: true },
  })
  return rows.map((x: any) => String(x.group_id || '').trim()).filter(Boolean)
}

async function getUserOrganizationIds(userId: string) {
  void userId
  return [] as string[]
}

function normalizeResourceType(resourceType: ResourceType) {
  return String(resourceType || '').trim().toLowerCase()
}

function isGrantActive(grant: ExplicitResourceGrant | null) {
  if (!grant) return false
  if (!grant.expiresAt) return true
  return new Date(grant.expiresAt).getTime() >= Date.now()
}

function grantAllowsAction(grant: ExplicitResourceGrant | null, action: ResourceAction) {
  if (!isGrantActive(grant)) return false
  if (!grant) return false
  if (grant.canManage) return true
  if (action === 'read') return grant.canRead || grant.canWrite || grant.canApprove || grant.canManage
  if (action === 'write' || action === 'assign' || action === 'delete') return grant.canWrite || grant.canManage
  if (action === 'approve') return grant.canApprove || grant.canManage
  if (action === 'manage') return grant.canManage
  return false
}

export async function loadExplicitResourceGrant(input: {
  userId: string
  resourceType: ResourceType
  resourceId: string
}): Promise<ExplicitResourceGrant | null> {
  const row = await (db as any).resourceAccessGrant?.findFirst?.({
    where: {
      user_id: input.userId,
      resource_type: normalizeResourceType(input.resourceType),
      resource_id: input.resourceId,
      is_active: true,
      OR: [
        { expires_at: null },
        { expires_at: { gte: new Date() } },
      ],
    },
    select: {
      id: true,
      access_level: true,
      can_read: true,
      can_write: true,
      can_approve: true,
      can_manage: true,
      expires_at: true,
    },
  })
  if (!row) return null
  return {
    id: String(row.id),
    accessLevel: row.access_level ? String(row.access_level) : null,
    canRead: Boolean(row.can_read),
    canWrite: Boolean(row.can_write),
    canApprove: Boolean(row.can_approve),
    canManage: Boolean(row.can_manage),
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
  }
}

export async function loadResourceAccessFacts(
  resourceType: ResourceType,
  resourceId: string
): Promise<ResourceAccessFacts | null> {
  if (resourceType === 'customer') {
    const row = await db.customer.findUnique({
      where: { id: resourceId },
      select: { id: true, assigned_to: true },
    })
    if (!row) return null
    return {
      assigneeUserId: normalizeId(row.assigned_to),
    }
  }

  if (resourceType === 'project') {
    const row = await db.constructionProject.findUnique({
      where: { id: resourceId },
      select: {
        id: true,
        owner_id: true,
        default_owner_id: true,
        customer_id: true,
        customer: { select: { assigned_to: true } },
      },
    })
    if (!row) return null
    return {
      ownerUserId: normalizeId(row.owner_id),
      defaultOwnerUserId: normalizeId(row.default_owner_id),
      customerId: normalizeId(row.customer_id),
      customerAssigneeUserId: normalizeId(row.customer?.assigned_to),
    }
  }

  if (resourceType === 'conversation') {
    const row = await (db as any).conversation.findUnique({
      where: { id: resourceId },
      select: { id: true, customer_id: true },
    })
    if (!row) return null
    let customerAssigneeUserId: string | null = null
    if (row.customer_id) {
      const customer = await db.customer.findUnique({
        where: { id: String(row.customer_id) },
        select: { assigned_to: true },
      })
      customerAssigneeUserId = normalizeId(customer?.assigned_to)
    }
    return {
      customerId: normalizeId(row.customer_id),
      customerAssigneeUserId,
    }
  }

  return {}
}

export async function canAccessResource(input: {
  ctx: AuthzContext
  resourceType: ResourceType
  action: ResourceAction
  resourceId?: string | null
}): Promise<AccessDecision> {
  const permission = getPermissionForResourceAction(input.resourceType, input.action)
  if (!permission) {
    return {
      allowed: false,
      permission: null,
      resourceType: input.resourceType,
      action: input.action,
      matchedScope: null,
      availableScopes: [],
      reason: 'resource_action_not_mapped',
      facts: null,
    }
  }

  if (!hasPermission(input.ctx, permission)) {
    return {
      allowed: false,
      permission,
      resourceType: input.resourceType,
      action: input.action,
      matchedScope: null,
      availableScopes: [],
      reason: 'missing_permission',
      facts: null,
    }
  }

  const availableScopes = resolveScope(input.ctx, input.resourceType, input.action)
  if (!input.resourceId) {
    return {
      allowed: true,
      permission,
      resourceType: input.resourceType,
      action: input.action,
      matchedScope: availableScopes[0] || 'all',
      availableScopes,
      reason: 'collection_access',
      facts: null,
    }
  }

  const facts = await loadResourceAccessFacts(input.resourceType, input.resourceId)
  if (facts === null) {
    return {
      allowed: false,
      permission,
      resourceType: input.resourceType,
      action: input.action,
      matchedScope: null,
      availableScopes,
      reason: 'resource_not_found',
      facts: null,
    }
  }

  const explicitGrant = await loadExplicitResourceGrant({
    userId: input.ctx.userId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
  })

  if (availableScopes.includes('all')) {
    return {
      allowed: true,
      permission,
      resourceType: input.resourceType,
      action: input.action,
      matchedScope: 'all',
      availableScopes,
      reason: 'scope_all',
      facts,
    }
  }

  const userId = input.ctx.userId
  if (availableScopes.includes('owner') && facts.ownerUserId && facts.ownerUserId === userId) {
    return { allowed: true, permission, resourceType: input.resourceType, action: input.action, matchedScope: 'owner', availableScopes, reason: 'scope_owner', facts }
  }
  if (availableScopes.includes('assignee') && facts.assigneeUserId && facts.assigneeUserId === userId) {
    return { allowed: true, permission, resourceType: input.resourceType, action: input.action, matchedScope: 'assignee', availableScopes, reason: 'scope_assignee', facts }
  }
  if (availableScopes.includes('default_owner') && facts.defaultOwnerUserId && facts.defaultOwnerUserId === userId) {
    return { allowed: true, permission, resourceType: input.resourceType, action: input.action, matchedScope: 'default_owner', availableScopes, reason: 'scope_default_owner', facts }
  }
  if (availableScopes.includes('customer_assignee') && facts.customerAssigneeUserId && facts.customerAssigneeUserId === userId) {
    return { allowed: true, permission, resourceType: input.resourceType, action: input.action, matchedScope: 'customer_assignee', availableScopes, reason: 'scope_customer_assignee', facts }
  }
  if (availableScopes.includes('group')) {
    const userGroups = await getUserGroupIds(userId)
    const resourceGroups = Array.isArray(facts.groupIds) ? facts.groupIds : []
    if (userGroups.some((id: string) => resourceGroups.includes(id))) {
      return { allowed: true, permission, resourceType: input.resourceType, action: input.action, matchedScope: 'group', availableScopes, reason: 'scope_group', facts }
    }
  }
  if (availableScopes.includes('organization')) {
    const userOrganizations = await getUserOrganizationIds(userId)
    const resourceOrganizations = Array.isArray(facts.organizationIds) ? facts.organizationIds : []
    if (userOrganizations.some((id: string) => resourceOrganizations.includes(id))) {
      return { allowed: true, permission, resourceType: input.resourceType, action: input.action, matchedScope: 'organization', availableScopes, reason: 'scope_organization', facts }
    }
  }
  if (grantAllowsAction(explicitGrant, input.action)) {
    return {
      allowed: true,
      permission,
      resourceType: input.resourceType,
      action: input.action,
      matchedScope: 'explicit_access',
      availableScopes,
      reason: 'scope_explicit_access',
      facts,
    }
  }

  return {
    allowed: false,
    permission,
    resourceType: input.resourceType,
    action: input.action,
    matchedScope: null,
    availableScopes,
    reason: 'scope_denied',
    facts,
  }
}

export async function requireResourceAccess(input: {
  resourceType: ResourceType
  action: ResourceAction
  resourceId?: string | null
}) {
  const auth = await requireInternalUser()
  if (auth.error || !auth.ctx) return { error: auth.error, ctx: null, decision: null }

  const decision = await canAccessResource({
    ctx: auth.ctx,
    resourceType: input.resourceType,
    action: input.action,
    resourceId: input.resourceId,
  })

  if (!decision.allowed) {
    return {
      error: forbidden(`Khong co quyen ${input.action} ${input.resourceType}`) as Response,
      ctx: auth.ctx,
      decision,
    }
  }

  return { error: null as Response | null, ctx: auth.ctx, decision }
}

export async function requireCustomerAccess(action: ResourceAction, customerId?: string | null) {
  return requireResourceAccess({ resourceType: 'customer', action, resourceId: customerId })
}

export async function requireProjectAccess(action: ResourceAction, projectId?: string | null) {
  return requireResourceAccess({ resourceType: 'project', action, resourceId: projectId })
}

export async function requireConversationAccess(action: ResourceAction, conversationId?: string | null) {
  return requireResourceAccess({ resourceType: 'conversation', action, resourceId: conversationId })
}
