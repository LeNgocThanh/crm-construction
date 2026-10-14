import { db } from '@/lib/db'

export type ActionTimelineEventKey =
  | 'created'
  | 'assigned'
  | 'reassigned'
  | 'updated'
  | 'accepted'
  | 'rejected'
  | 'done'
  | 'cancelled'
  | 'due_changed'
  | 'priority_changed'

type LogActionEventInput = {
  work_suggestion_id: string
  customer_id?: string | null
  event_key: ActionTimelineEventKey | string
  title: string
  description?: string | null
  metadata_json?: any
  actor_user_id?: string | null
}

export async function logActionEvent(input: LogActionEventInput) {
  const workSuggestionId = String(input.work_suggestion_id || '').trim()
  if (!workSuggestionId) {
    throw new Error('work_suggestion_id is required')
  }
  const eventKey = String(input.event_key || '').trim()
  if (!eventKey) {
    throw new Error('event_key is required')
  }
  const title = String(input.title || '').trim()
  if (!title) {
    throw new Error('title is required')
  }

  return (db as any).actionTimelineEvent.create({
    data: {
      work_suggestion_id: workSuggestionId,
      customer_id: input.customer_id ? String(input.customer_id).trim() : null,
      event_key: eventKey,
      title,
      description: input.description ? String(input.description) : null,
      metadata_json: input.metadata_json ?? null,
      actor_user_id: input.actor_user_id ? String(input.actor_user_id).trim() : null,
    },
  })
}

export async function logActionEventSafe(input: LogActionEventInput) {
  try {
    return await logActionEvent(input)
  } catch (err) {
    console.error('[ACTION_TIMELINE] log failed:', err)
    return null
  }
}

