import { db } from '@/lib/db'
import { createUserNotification } from '@/lib/user-notifications'

type CreateSuggestionInput = {
  customer_id: string
  care_activity_id?: string | null
  source_ref_type?: string | null
  source_ref_id?: string | null
  title: string
  detail?: string | null
  next_action_text?: string | null
  due_at?: Date | null
  priority?: string | null
  created_by?: string | null
  primary_user_id?: string | null
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)))
}

async function resolveSecondaryRecipients(primaryUserId: string | null): Promise<string[]> {
  if (!primaryUserId) {
    const managers = await db.user.findMany({
      where: {
        is_active: true,
        role_memberships: {
          some: {
            role: {
              is_active: true,
              role_key: { in: ['admin', 'manager'] },
            },
          },
        },
      },
      select: { id: true },
      take: 10,
    })
    return managers.map((x) => x.id)
  }

  const memberships = await (db as any).userGroupMembership.findMany({
    where: { user_id: primaryUserId },
    select: { group_id: true },
    take: 10,
  })
  const groupIds = memberships.map((m: any) => String(m.group_id))
  if (!groupIds.length) return []

  const members = await (db as any).userGroupMembership.findMany({
    where: { group_id: { in: groupIds } },
    select: { user_id: true },
    take: 100,
  })
  return uniq(members.map((m: any) => String(m.user_id))).filter((x) => x !== primaryUserId)
}

export async function createWorkSuggestion(input: CreateSuggestionInput) {
  const keySourceRefType = String(input.source_ref_type || 'care_activity').trim()
  const keySourceRefId = String(
    input.source_ref_id || input.care_activity_id || `${input.customer_id}:${(input.next_action_text || input.title || '').slice(0, 80)}`
  ).trim()

  const existing = await (db as any).workSuggestion.findFirst({
    where: {
      customer_id: input.customer_id,
      source_ref_type: keySourceRefType,
      source_ref_id: keySourceRefId,
      status: { in: ['pending', 'accepted', 'assigned'] },
    },
    select: { id: true },
  })
  if (existing) return existing

  const primary = input.primary_user_id || null
  const secondary = await resolveSecondaryRecipients(primary)
  const allRecipients = uniq([primary || '', ...secondary])

  const created = await (db as any).workSuggestion.create({
    data: {
      customer_id: input.customer_id,
      care_activity_id: input.care_activity_id || null,
      source_ref_type: keySourceRefType,
      source_ref_id: keySourceRefId,
      title: input.title,
      detail: input.detail || null,
      next_action_text: input.next_action_text || null,
      due_at: input.due_at || null,
      priority: String(input.priority || 'normal'),
      status: 'pending',
      created_by: input.created_by || null,
      assigned_to: primary,
      recipients: {
        create: allRecipients.map((uid) => ({
          user_id: uid,
          role: uid === primary ? 'primary' : 'secondary',
          response_status: 'pending',
        })),
      },
    },
    select: { id: true },
  })
  for (const uid of allRecipients) {
    await createUserNotification({
      user_id: uid,
      type: uid === primary ? 'work_assigned' : 'work_new',
      title: input.title,
      message: input.next_action_text || input.detail || null,
      status: 'pending',
      source_type: 'work_suggestion',
      source_id: created.id,
      metadata_json: {
        customer_id: input.customer_id,
        due_at: input.due_at ? input.due_at.toISOString() : null,
        priority: input.priority || 'normal',
        recipient_role: uid === primary ? 'primary' : 'secondary',
      },
    })
  }
  return created
}
