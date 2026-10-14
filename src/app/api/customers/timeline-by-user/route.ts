import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { BASIC_USER_WITH_ROLE_SELECT, mapBasicUserWithRole } from '@/lib/user-profiles'

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
  const userId = String(sp.get('user_id') || '').trim()
  const mine = String(sp.get('mine') || '').trim() === '1'
  const type = String(sp.get('type') || '').trim()
  const customerId = String(sp.get('customer_id') || '').trim()
  const q = String(sp.get('search') || '').trim()
  const dateFromRaw = String(sp.get('date_from') || '').trim()
  const dateToRaw = String(sp.get('date_to') || '').trim()
  const limit = Math.min(500, Math.max(1, Number(sp.get('limit') || 200)))
  const includeOpenActions = String(sp.get('include_open_actions') || '1').trim() !== '0'

  const where: any = {}
  if (mine) where.created_by = session.user.id
  else if (userId) where.created_by = userId
  if (type) where.type = type
  if (customerId) where.customer_id = customerId
  if (dateFromRaw || dateToRaw) {
    where.happened_at = {}
    if (dateFromRaw) where.happened_at.gte = new Date(`${dateFromRaw}T00:00:00`)
    if (dateToRaw) where.happened_at.lte = new Date(`${dateToRaw}T23:59:59`)
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { customer: { full_name: { contains: q, mode: 'insensitive' } } },
      { customer: { phone_number: { contains: q } } },
    ]
  }

  const data = await db.customerTimeline.findMany({
    where,
    take: limit,
    orderBy: [{ happened_at: 'desc' }, { created_at: 'desc' }],
    include: {
      customer: {
        select: { id: true, full_name: true, phone_number: true, status: true },
      },
      creator: {
        select: BASIC_USER_WITH_ROLE_SELECT,
      },
    },
  })

  let actionRows: any[] = []
  if (includeOpenActions) {
    const actionWhere: any = {
      status: { in: ['pending', 'accepted', 'assigned'] },
    }
    if (mine) {
      actionWhere.OR = [
        { assigned_to: session.user.id },
        { recipients: { some: { user_id: session.user.id } } },
      ]
    } else if (userId) {
      actionWhere.OR = [
        { assigned_to: userId },
        { recipients: { some: { user_id: userId } } },
      ]
    }
    if (customerId) actionWhere.customer_id = customerId
    if (q) {
      actionWhere.AND = actionWhere.AND || []
      actionWhere.AND.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { detail: { contains: q, mode: 'insensitive' } },
          { customer: { full_name: { contains: q, mode: 'insensitive' } } },
          { customer: { phone_number: { contains: q } } },
        ],
      })
    }
    if (dateFromRaw || dateToRaw) {
      actionWhere.due_at = {}
      if (dateFromRaw) actionWhere.due_at.gte = new Date(`${dateFromRaw}T00:00:00`)
      if (dateToRaw) actionWhere.due_at.lte = new Date(`${dateToRaw}T23:59:59`)
    }
    const actions = await (db as any).workSuggestion.findMany({
      where: actionWhere,
      take: limit,
      orderBy: [{ due_at: 'asc' }, { created_at: 'desc' }],
      include: {
        customer: { select: { id: true, full_name: true, phone_number: true, status: true } },
      },
    })
    const now = Date.now()
    actionRows = actions.map((a: any) => {
      const dueTs = a?.due_at ? new Date(a.due_at).getTime() : null
      const isOverdue = Boolean(dueTs && dueTs < now)
      return {
        id: `action:${a.id}`,
        type: 'action_deadline',
        title: a.title || 'Action',
        description: a.detail || a.next_action_text || null,
        happened_at: a.created_at,
        created_at: a.created_at,
        due_at: a.due_at || null,
        deadline_status: isOverdue ? 'overdue' : 'open',
        action_status: a.status,
        action_priority: a.priority,
        customer: a.customer,
        creator: null,
        metadata: {
          source: 'work_suggestions',
          work_suggestion_id: a.id,
        },
      }
    })
  }

  const normalizedData = (data as any[]).map((row) => ({
    ...row,
    creator: row.creator ? mapBasicUserWithRole(row.creator) : null,
  }))

  const merged = [...normalizedData, ...actionRows]
    .sort((a: any, b: any) => new Date(b.happened_at).getTime() - new Date(a.happened_at).getTime())
    .slice(0, limit)

  return NextResponse.json({ data: safe(merged), total: merged.length })
}
