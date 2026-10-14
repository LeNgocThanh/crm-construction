import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

function safeJson<T>(payload: T): T {
  return JSON.parse(
    JSON.stringify(payload, (_k, v) => (typeof v === 'bigint' ? Number(v) : v))
  ) as T
}

function safe(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'bigint') return Number(value)
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(safe)
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) out[key] = safe(entry)
    return out
  }
  return value
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.customersRead)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const sp = new URL(req.url).searchParams
  const search = String(sp.get('search') || '').trim()
  const status = String(sp.get('status') || '').trim()
  const ctype = String(sp.get('type') || '').trim()
  const phase = String(sp.get('pipeline_phase') || '').trim()
  const assigned = String(sp.get('assigned_to') || '').trim()
  const mineOnly = String(sp.get('mine') || '').trim() === '1'
  const onlyWithNextAction = String(sp.get('has_next_action') || '').trim() === '1'
  const overdueOnly = String(sp.get('overdue_only') || '').trim() === '1'
  const limit = Math.min(200, Math.max(1, Number(sp.get('limit') || 80)))

  const where: any = {}
  if (status) where.status = status
  if (ctype) where.type = ctype
  if (assigned) where.assigned_to = assigned
  if (mineOnly) where.assigned_to = session.user.id
  if (onlyWithNextAction || phase) {
    const careSome: any = { status: 'open' }
    if (phase) careSome.pipeline_phase = phase
    where.care_activities = { some: careSome }
  }
  if (search) {
    where.OR = [
      { full_name: { contains: search, mode: 'insensitive' } },
      { phone_number: { contains: search } },
      { telegram_username: { contains: search, mode: 'insensitive' } },
      { zalo_username: { contains: search, mode: 'insensitive' } },
      { messenger_username: { contains: search, mode: 'insensitive' } },
    ]
  }

  const customers = await db.customer.findMany({
    where,
    take: limit,
    orderBy: [{ updated_at: 'desc' }],
    select: {
      id: true,
      full_name: true,
      phone_number: true,
      status: true,
      type: true,
      source: true,
      assigned_to: true,
      next_action: true,
      address: true,
      updated_at: true,
      created_at: true,
      assignee: { select: { id: true, username: true } },
      timeline: {
        take: 1,
        orderBy: { happened_at: 'desc' },
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          happened_at: true,
        },
      },
      contact_logs: {
        take: 1,
        orderBy: { contact_date: 'desc' },
        select: {
          id: true,
          contact_date: true,
          source: true,
          next_action: true,
        },
      },
      care_activities: {
        where: phase ? { status: 'open', pipeline_phase: phase } : { status: 'open' },
        take: 1,
        orderBy: [{ due_at: 'asc' }, { happened_at: 'desc' }, { created_at: 'desc' }],
        select: {
          id: true,
          summary: true,
          detail: true,
          next_action_snapshot: true,
          status: true,
          priority: true,
          pipeline_phase: true,
          due_at: true,
          care_owner_id: true,
          created_at: true,
          happened_at: true,
        },
      },
    },
  })

  const now = Date.now()
  const rows = customers
    .map((c) => {
      const lastTimeline = c.timeline?.[0] || null
      const lastLog = c.contact_logs?.[0] || null
      const activeCare = c.care_activities?.[0] || null
      const nextActionText = activeCare?.next_action_snapshot || activeCare?.summary || null
      const nextActionDue = activeCare?.due_at || null
      const isOverdue = Boolean(nextActionDue && new Date(nextActionDue).getTime() < now)
      return {
        ...c,
        next_action: nextActionText,
        active_care_activity_id: activeCare?.id || null,
        active_care_status: activeCare?.status || null,
        active_care_priority: activeCare?.priority || null,
        active_care_pipeline_phase: activeCare?.pipeline_phase || null,
        active_care_due_at: activeCare?.due_at || null,
        active_care_owner_id: activeCare?.care_owner_id || null,
        active_care_created_at: activeCare?.created_at || null,
        active_care_happened_at: activeCare?.happened_at || null,
        last_timeline: lastTimeline,
        last_contact: lastLog,
        next_action_due: nextActionDue,
        is_overdue: isOverdue,
      }
    })
    .filter((r) => (overdueOnly ? r.is_overdue : true))
    .sort((a, b) => {
      const aDue = a.next_action_due ? new Date(a.next_action_due).getTime() : Number.MAX_SAFE_INTEGER
      const bDue = b.next_action_due ? new Date(b.next_action_due).getTime() : Number.MAX_SAFE_INTEGER
      if (aDue !== bDue) return aDue - bDue
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })

  return NextResponse.json(safeJson({ data: safe(rows), total: rows.length }))
}
