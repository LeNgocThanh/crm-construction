import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hasPermission, requireInternalUser } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

function safe(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'bigint') return Number(value)
  if (Array.isArray(value)) return value.map(safe)
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) out[key] = safe(entry)
    return out
  }
  return value
}

function daysSince(date?: Date | null) {
  if (!date) return null
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000))
}

export async function GET(req: NextRequest) {
  const auth = await requireInternalUser()
  if (auth.error || !auth.ctx) return auth.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session: any = auth.ctx.session

  const userId = String(session.user.id || '')
  const canReadCustomers = hasPermission(auth.ctx, PERMISSIONS.customersRead)
  const canReadProjects = hasPermission(auth.ctx, PERMISSIONS.projectsRead)
  const canReadConversations = hasPermission(auth.ctx, PERMISSIONS.conversationsRead)
  const canManageCustomers = hasPermission(auth.ctx, PERMISSIONS.customersManage)
  const canManageProjects = hasPermission(auth.ctx, PERMISSIONS.projectsManage)
  const canUseAllScope = canManageCustomers || canManageProjects
  const sp = req.nextUrl.searchParams
  const requestedScope = String(sp.get('scope') || '').trim()
  const scope = canUseAllScope && requestedScope === 'all' ? 'all' : 'my'
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const customerWhere = !canReadCustomers
    ? ({ id: '__forbidden__' } as any)
    : scope === 'all'
      ? {}
      : { assigned_to: userId }
  const projectWhere = !canReadProjects
    ? ({ id: '__forbidden__' } as any)
    : scope === 'all'
    ? {}
    : ({
        OR: [
          { owner_id: userId },
          { default_owner_id: userId },
          { customer: { is: { assigned_to: userId } } },
        ],
      } as any)
  const careWhere = !canReadCustomers
    ? ({ id: '__forbidden__' } as any)
    : scope === 'all'
    ? { status: { in: ['open', 'overdue'] } }
    : ({
        status: { in: ['open', 'overdue'] },
        OR: [
          { care_owner_id: userId },
          { customer: { is: { assigned_to: userId } } },
        ],
      } as any)

  const [
    totalCustomers,
    verifiedCustomers,
    totalProjects,
    activeProjects,
    openActions,
    overdueActions,
    activeConversations,
    urgentConversations,
    dispatchesThisMonth,
    customerTypeCountsRaw,
    projectStatusCountsRaw,
    actionRows,
    projectRows,
    customerTimelineRows,
    projectTimelineRows,
    dispatchRows,
    conversationRows,
  ] = await Promise.all([
    canReadCustomers ? db.customer.count({ where: customerWhere as any }) : Promise.resolve(0),
    canReadCustomers ? db.customer.count({ where: { ...(customerWhere as any), type: 'verified' } as any }) : Promise.resolve(0),
    canReadProjects ? db.constructionProject.count({ where: projectWhere as any }) : Promise.resolve(0),
    canReadProjects ? db.constructionProject.count({
      where: {
        ...(projectWhere as any),
        status: { in: ['confirmed', 'in_progress', 'paused'] },
      } as any,
    }) : Promise.resolve(0),
    canReadCustomers ? db.customerCareActivity.count({ where: careWhere as any }) : Promise.resolve(0),
    canReadCustomers ? db.customerCareActivity.count({
      where: {
        ...(careWhere as any),
        due_at: { lt: new Date() },
      } as any,
    }) : Promise.resolve(0),
    canReadConversations ? db.conversation.count({ where: { status: 'active' } }) : Promise.resolve(0),
    canReadConversations ? db.conversation.count({ where: { status: 'active', OR: [{ is_urgent: true }, { needs_callback: true }] } as any }) : Promise.resolve(0),
    canReadCustomers ? db.customerEstimateDispatch.count({
      where: {
        sent_at: { gte: monthStart },
        customer: { is: customerWhere as any },
      } as any,
    }) : Promise.resolve(0),
    canReadCustomers ? db.customer.groupBy({
      by: ['type'],
      where: customerWhere as any,
      _count: { type: true },
    }) : Promise.resolve([]),
    canReadProjects ? db.constructionProject.groupBy({
      by: ['status'],
      where: projectWhere as any,
      _count: { status: true },
    }) : Promise.resolve([]),
    canReadCustomers ? db.customerCareActivity.findMany({
      where: careWhere as any,
      orderBy: [{ due_at: 'asc' }, { happened_at: 'desc' }],
      take: 10,
      include: {
        customer: { select: { id: true, full_name: true, phone_number: true } },
        owner: { select: { id: true, username: true } },
      },
    }) : Promise.resolve([]),
    canReadProjects ? db.constructionProject.findMany({
      where: projectWhere as any,
      orderBy: [{ delay_days: 'desc' }, { updated_at: 'desc' }],
      take: 10,
      include: {
        customer: { select: { id: true, full_name: true } },
        milestones: {
          where: { is_active: true },
          orderBy: [{ sort_order: 'asc' }, { due_date: 'asc' }],
          take: 1,
          include: { status_ref: { select: { status_name: true } } },
        },
        diary_entries: {
          orderBy: [{ entry_date: 'desc' }],
          take: 1,
          select: { entry_date: true },
        },
      },
    }) : Promise.resolve([]),
    canReadCustomers ? db.customerTimeline.findMany({
      where: { customer: { is: customerWhere as any } } as any,
      orderBy: { happened_at: 'desc' },
      take: 12,
      include: {
        customer: { select: { id: true, full_name: true, phone_number: true } },
        creator: { select: { id: true, username: true } },
      },
    }) : Promise.resolve([]),
    canReadProjects ? db.projectTimelineEvent.findMany({
      where: { project: { is: projectWhere as any } } as any,
      orderBy: { happened_at: 'desc' },
      take: 12,
      include: {
        project: { select: { id: true, project_name: true } },
        customer: { select: { id: true, full_name: true, phone_number: true } },
        actor: { select: { id: true, username: true } },
      },
    }) : Promise.resolve([]),
    canReadCustomers ? db.customerEstimateDispatch.findMany({
      where: {
        customer: { is: customerWhere as any },
      } as any,
      orderBy: { sent_at: 'desc' },
      take: 8,
      include: {
        customer: { select: { id: true, full_name: true, phone_number: true } },
        estimate: { select: { id: true, total_cost: true, status: true } },
        sender: { select: { id: true, username: true } },
      },
    }) : Promise.resolve([]),
    canReadConversations ? db.conversation.findMany({
      orderBy: { last_message_at: 'desc' },
      take: 8,
      select: {
        id: true,
        channel: true,
        display_name: true,
        status: true,
        last_message_at: true,
        is_urgent: true,
        needs_callback: true,
        customer_id: true,
      },
    }) : Promise.resolve([]),
  ])

  const customerTypeCounts = customerTypeCountsRaw.map((row) => ({
    type: row.type || 'unverified',
    count: row._count.type,
  }))

  const projectStatusCounts = projectStatusCountsRaw.map((row) => ({
    status: row.status || 'draft',
    count: row._count.status,
  }))

  const attentionProjects = projectRows.map((row) => {
    const latestDiary = row.diary_entries?.[0]?.entry_date || null
    const latestMilestone = row.milestones?.[0] || null
    const diaryGapDays = daysSince(latestDiary)
    const flags: string[] = []
    if (Number(row.delay_days || 0) > 0) flags.push(`Trễ ${row.delay_days} ngày`)
    if (['high', 'critical'].includes(String(row.risk_level || ''))) flags.push(`Rủi ro ${row.risk_level}`)
    if (diaryGapDays != null && diaryGapDays >= 3) flags.push(`${diaryGapDays} ngày chưa có nhật ký`)
    return {
      id: row.id,
      project_name: row.project_name || 'Dự án chưa đặt tên',
      status: row.status,
      risk_level: row.risk_level || null,
      delay_days: Number(row.delay_days || 0),
      customer: row.customer,
      latest_diary_at: latestDiary,
      latest_diary_gap_days: diaryGapDays,
      latest_milestone: latestMilestone
        ? {
            id: latestMilestone.id,
            milestone_name: latestMilestone.milestone_name,
            status_name: latestMilestone.status_ref?.status_name || latestMilestone.status_key || null,
          }
        : null,
      warning_flags: flags,
    }
  })

  const recentActivities = [
    ...customerTimelineRows.map((row) => ({
      id: `customer:${row.id}`,
      source: 'customer_timeline',
      happened_at: row.happened_at,
      title: row.title,
      description: row.description || null,
      customer: row.customer,
      project: null,
      actor_name: row.creator?.username || null,
      meta_label: row.type || null,
    })),
    ...projectTimelineRows.map((row) => ({
      id: `project:${row.id}`,
      source: 'project_timeline',
      happened_at: row.happened_at,
      title: row.title,
      description: row.description || null,
      customer: row.customer,
      project: row.project,
      actor_name: row.actor?.username || null,
      meta_label: row.event_key || null,
    })),
    ...dispatchRows.map((row) => ({
      id: `dispatch:${row.id}`,
      source: 'estimate_dispatch',
      happened_at: row.sent_at,
      title: 'Đã gửi dự toán/khái toán',
      description: `${row.channel} | ${row.delivery_status}${row.estimate?.total_cost ? ` | ${Number(row.estimate.total_cost).toLocaleString('vi-VN')} vnd` : ''}`,
      customer: row.customer,
      project: null,
      actor_name: row.sender?.username || null,
      meta_label: row.estimate_type || null,
    })),
  ]
    .sort((a, b) => new Date(String(b.happened_at)).getTime() - new Date(String(a.happened_at)).getTime())
    .slice(0, 18)

  const groupedActivityMap = new Map<string, {
    customer_id: string
    customer_name: string
    customer_phone: string | null
    latest_at: Date | string
    projects: Array<{ id: string; project_name: string }>
    items: typeof recentActivities
  }>()
  for (const activity of recentActivities) {
    const customerId = String(activity.customer?.id || '').trim()
    if (!customerId) continue
    const existed = groupedActivityMap.get(customerId) || {
      customer_id: customerId,
      customer_name: String(activity.customer?.full_name || activity.customer?.phone_number || 'Khách hàng chưa rõ'),
      customer_phone: activity.customer?.phone_number || null,
      latest_at: activity.happened_at,
      projects: [],
      items: [],
    }
    existed.items.push(activity)
    if (new Date(String(activity.happened_at)).getTime() > new Date(String(existed.latest_at)).getTime()) {
      existed.latest_at = activity.happened_at
    }
    if (activity.project?.id && !existed.projects.some((x) => x.id === activity.project?.id)) {
      existed.projects.push({ id: activity.project.id, project_name: String(activity.project.project_name || 'Dự án chưa rõ') })
    }
    groupedActivityMap.set(customerId, existed)
  }
  const recentActivityGroups = Array.from(groupedActivityMap.values())
    .sort((a, b) => new Date(String(b.latest_at)).getTime() - new Date(String(a.latest_at)).getTime())
    .slice(0, 8)

  const payload = {
    scope,
    can_switch_scope: canUseAllScope,
    overview: {
      total_customers: totalCustomers,
      verified_customers: verifiedCustomers,
      unverified_customers: Math.max(0, totalCustomers - verifiedCustomers),
      total_projects: totalProjects,
      active_projects: activeProjects,
      open_actions: openActions,
      overdue_actions: overdueActions,
      active_conversations: activeConversations,
      urgent_conversations: urgentConversations,
      estimate_dispatches_this_month: dispatchesThisMonth,
    },
    customer_type_counts: customerTypeCounts,
    project_status_counts: projectStatusCounts,
    pending_actions: actionRows,
    attention_projects: attentionProjects,
    recent_activities: recentActivities,
    recent_activity_groups: recentActivityGroups,
    recent_conversations: conversationRows,
  }

  return NextResponse.json(safe(payload))
}
