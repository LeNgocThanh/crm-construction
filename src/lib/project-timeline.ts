import { db } from '@/lib/db'

type Input = {
  project_id: string
  customer_id?: string | null
  milestone_id?: string | null
  event_key: string
  title: string
  description?: string | null
  source_ref_type?: string | null
  source_ref_id?: string | null
  actor_user_id?: string | null
  happened_at?: Date
  metadata_json?: any
}

export async function createProjectTimelineEvent(input: Input) {
  return db.projectTimelineEvent.create({
    data: {
      project_id: input.project_id,
      customer_id: input.customer_id || null,
      milestone_id: input.milestone_id || null,
      event_key: input.event_key,
      title: input.title,
      description: input.description || null,
      source_ref_type: input.source_ref_type || null,
      source_ref_id: input.source_ref_id || null,
      actor_user_id: input.actor_user_id || null,
      happened_at: input.happened_at || new Date(),
      metadata_json: input.metadata_json || null,
    },
  })
}
