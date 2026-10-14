import { db } from '@/lib/db'
import { createWorkSuggestion } from '@/lib/work-suggestions'

type CareActivityInput = {
  customer_id: string
  activity_type: string
  summary: string
  detail?: string | null
  next_action_snapshot?: string | null
  source_ref_type?: string | null
  source_ref_id?: string | null
  channel?: string | null
  pipeline_phase?: string | null
  happened_at?: Date | null
  due_at?: Date | null
  created_by?: string | null
  care_owner_id?: string | null
  status?: string | null
  priority?: string | null
  completed_at?: Date | null
  completed_by?: string | null
  outcome?: string | null
  metadata_json?: any
}

export async function createCareActivity(input: CareActivityInput) {
  const created = await (db as any).customerCareActivity.create({
    data: {
      customer_id: input.customer_id,
      activity_type: input.activity_type,
      summary: input.summary,
      detail: input.detail || null,
      next_action_snapshot: input.next_action_snapshot || null,
      source_ref_type: input.source_ref_type || null,
      source_ref_id: input.source_ref_id || null,
      channel: input.channel || null,
      pipeline_phase: input.pipeline_phase || null,
      happened_at: input.happened_at || new Date(),
      due_at: input.due_at || null,
      created_by: input.created_by || null,
      care_owner_id: input.care_owner_id || null,
      status: input.status || 'open',
      priority: input.priority || 'normal',
      completed_at: input.completed_at || null,
      completed_by: input.completed_by || null,
      outcome: input.outcome || null,
      metadata_json: input.metadata_json ?? null,
    },
  })
  const nextText = String(input.next_action_snapshot || input.summary || '').trim()
  const shouldCreateSuggestion = (input.status || 'open') === 'open' && !!nextText
  if (shouldCreateSuggestion) {
    try {
      const customer = await db.customer.findUnique({
        where: { id: input.customer_id },
        select: { assigned_to: true },
      })
      await createWorkSuggestion({
        customer_id: input.customer_id,
        care_activity_id: created.id,
        source_ref_type: input.source_ref_type || 'care_activity',
        source_ref_id: input.source_ref_id || created.id,
        title: input.summary,
        detail: input.detail || null,
        next_action_text: nextText,
        due_at: input.due_at || null,
        priority: input.priority || 'normal',
        created_by: input.created_by || null,
        primary_user_id: input.care_owner_id || customer?.assigned_to || null,
      })
    } catch (err) {
      console.error('[WORK_SUGGESTION] create failed:', err)
    }
  }
  return created
}

export async function createCareActivitySafe(input: CareActivityInput) {
  try {
    await createCareActivity(input)
  } catch (err) {
    console.error('[CARE_ACTIVITY] create failed:', err)
  }
}
