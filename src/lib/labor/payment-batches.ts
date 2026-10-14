import { db } from '@/lib/db'
import { createProjectTimelineEvent } from '@/lib/project-timeline'
import { createUserNotification } from '@/lib/user-notifications'

export async function createLaborPaymentBatchTimeline(params: {
  project_id: string
  customer_id?: string | null
  batch_id: string
  event_key: string
  title: string
  description?: string | null
  actor_user_id?: string | null
  metadata_json?: any
}) {
  return createProjectTimelineEvent({
    project_id: params.project_id,
    customer_id: params.customer_id || null,
    event_key: params.event_key,
    title: params.title,
    description: params.description || null,
    source_ref_type: 'labor_payment_batch',
    source_ref_id: params.batch_id,
    actor_user_id: params.actor_user_id || null,
    metadata_json: params.metadata_json ?? null,
  })
}

export async function notifyLaborPaymentBatchStatus(params: {
  project_id: string
  customer_id?: string | null
  batch_id: string
  batch_name: string
  batch_code: string
  project_name?: string | null
  total_amount?: number
  actor_user_id?: string | null
  actor_username?: string | null
  type: 'labor_payment_batch_approved' | 'labor_payment_batch_paid'
}) {
  const project = await db.constructionProject.findUnique({
    where: { id: params.project_id },
    select: {
      owner_id: true,
      default_owner_id: true,
    },
  })

  const batch = await (db as any).projectLaborPaymentBatch?.findUnique({
    where: { id: params.batch_id },
    select: {
      created_by: true,
    },
  })

  const targets = new Set<string>()
  if (project?.owner_id) targets.add(String(project.owner_id))
  if (project?.default_owner_id) targets.add(String(project.default_owner_id))
  if (batch?.created_by) targets.add(String(batch.created_by))
  if (params.actor_user_id) targets.delete(String(params.actor_user_id))

  const totalText = Number(params.total_amount || 0).toLocaleString('vi-VN')
  const title = params.type === 'labor_payment_batch_approved'
    ? `Đợt thanh toán công đã được duyệt`
    : `Đợt thanh toán công đã được đánh dấu đã chi`
  const message = params.type === 'labor_payment_batch_approved'
    ? `${params.batch_name} (${params.batch_code}) của dự án ${params.project_name || '-'} đã được duyệt. Giá trị hiện tại: ${totalText} vnd.`
    : `${params.batch_name} (${params.batch_code}) của dự án ${params.project_name || '-'} đã được xác nhận đã chi. Giá trị hiện tại: ${totalText} vnd.`

  for (const userId of targets) {
    await createUserNotification({
      user_id: userId,
      type: params.type,
      title,
      message,
      status: 'pending',
      source_type: 'labor_payment_batch',
      source_id: params.batch_id,
      related_user_id: params.actor_user_id || null,
      metadata_json: {
        project_id: params.project_id,
        customer_id: params.customer_id || null,
        batch_id: params.batch_id,
        batch_name: params.batch_name,
        batch_code: params.batch_code,
        total_amount: Math.round(Number(params.total_amount || 0)),
        actor_user_id: params.actor_user_id || null,
        actor_username: params.actor_username || null,
      },
    })
  }
}

