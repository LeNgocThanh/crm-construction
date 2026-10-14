import { db } from '@/lib/db'

type BridgeInput = {
  customer_id?: string | null
  work_suggestion_id: string
  event_key: string
  title: string
  description?: string | null
  actor_user_id?: string | null
  happened_at?: Date | null
  metadata_json?: any
}

const PUSHABLE_EVENT_KEYS = new Set(['created', 'updated', 'done', 'cancelled'])

export async function pushCustomerTimelineFromActionEvent(input: BridgeInput) {
  const customerId = String(input.customer_id || '').trim()
  if (!customerId) return null
  const eventKey = String(input.event_key || '').trim().toLowerCase()
  if (!PUSHABLE_EVENT_KEYS.has(eventKey)) return null

  return db.customerTimeline.create({
    data: {
      customer_id: customerId,
      type: 'action_event',
      title: input.title,
      description: input.description || null,
      happened_at: input.happened_at || new Date(),
      created_by: input.actor_user_id ? String(input.actor_user_id).trim() : null,
      metadata: {
        source: 'action_timeline_bridge',
        work_suggestion_id: input.work_suggestion_id,
        event_key: eventKey,
        ...(input.metadata_json ?? {}),
      },
    },
  })
}

export async function pushCustomerTimelineFromActionEventSafe(input: BridgeInput) {
  try {
    return await pushCustomerTimelineFromActionEvent(input)
  } catch (err) {
    console.error('[ACTION_CUSTOMER_BRIDGE] push failed:', err)
    return null
  }
}

