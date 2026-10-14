import { db } from '@/lib/db'

type CreateNotificationInput = {
  user_id: string
  type: string
  title: string
  message?: string | null
  status?: string
  source_type?: string | null
  source_id?: string | null
  related_user_id?: string | null
  metadata_json?: any
}

export async function createUserNotification(input: CreateNotificationInput) {
  return (db as any).userNotification.create({
    data: {
      user_id: input.user_id,
      type: input.type,
      title: input.title,
      message: input.message || null,
      status: input.status || 'pending',
      source_type: input.source_type || null,
      source_id: input.source_id || null,
      related_user_id: input.related_user_id || null,
      metadata_json: input.metadata_json ?? null,
    },
  })
}

export async function markUserNotificationReadByKeys(userId: string, keys: string[]) {
  const ids = keys
    .map((k) => {
      if (!String(k).startsWith('unf:')) return ''
      return String(k).slice(4).trim()
    })
    .filter(Boolean)
  if (!ids.length) return 0
  const result = await (db as any).userNotification.updateMany({
    where: { id: { in: ids }, user_id: userId },
    data: { status: 'read', read_at: new Date() },
  })
  return Number(result?.count || 0)
}

