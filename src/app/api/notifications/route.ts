// src/app/api/notifications/route.ts - V2.1: per-user read tracking
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hasPermission, requireInternalUser } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

function buildUserNotificationDisplay(n: any) {
  const metadata = n?.metadata_json && typeof n.metadata_json === 'object' ? n.metadata_json : {}
  const sourceType = String(n?.source_type || '')
  const notifType = String(n?.type || '')
  const projectId = String(metadata?.project_id || '').trim()
  const sourceId = String(n?.source_id || '').trim()
  const issueCode = String(metadata?.issue_code || '').trim()
  const projectName = String(metadata?.project_name || '').trim()
  const rawMessage = String(n?.message || '').trim()
  const dueAt = String(metadata?.due_at || '').trim()

  let sourceLabel = 'Nhắc nhở'
  let href = metadata?.customer_id ? `/customers/${metadata.customer_id}` : '/customers'
  let headline = String(n?.title || '').trim() || sourceLabel
  let body = rawMessage || String(n?.title || '').trim() || 'Có cập nhật mới'

  if (sourceType === 'project_site_issue') {
    sourceLabel = notifType === 'project_site_issue_assigned' ? 'Phân công xử lý lỗi' : 'Lỗi hiện trường'
    if (notifType === 'project_site_issue_subcontractor_changed') {
      sourceLabel = 'Cập nhật thầu phụ xử lý'
    }
    if (projectId && sourceId) href = `/projects/${projectId}/site-issues/${sourceId}`
    else if (projectId) href = `/projects/${projectId}/site-issues`
    if (notifType === 'project_site_issue_assigned') {
      headline = `Bạn được phân công xử lý ${issueCode || 'một lỗi hiện trường'}`
      body = rawMessage || 'Có lỗi hiện trường mới được giao cho bạn'
      if (dueAt) body += ` | Hạn: ${new Date(dueAt).toLocaleDateString('vi-VN')}`
    } else if (notifType === 'project_site_issue_subcontractor_changed') {
      const subcontractorName = String(metadata?.subcontractor_name || '').trim()
      const previousSubcontractorName = String(metadata?.previous_subcontractor_name || '').trim()
      headline = `${issueCode || 'Lỗi hiện trường'} đã cập nhật thầu phụ xử lý`
      body = subcontractorName
        ? `Đơn vị xử lý: ${subcontractorName}${previousSubcontractorName ? ` | Trước đó: ${previousSubcontractorName}` : ''}`
        : 'Lỗi hiện trường đã gỡ gắn thầu phụ xử lý'
    } else if (notifType === 'project_site_issue_created') {
      headline = `${issueCode || 'Lỗi hiện trường mới'} cần xử lý`
      body = rawMessage || 'Có lỗi hiện trường mới vừa được tạo'
    } else if (notifType === 'project_site_issue_verified') {
      headline = `${issueCode || 'Lỗi hiện trường'} đã được nghiệm thu đạt`
      body = rawMessage || 'Lỗi hiện trường đã được nghiệm thu đạt'
    } else if (notifType === 'project_site_issue_fixed_submitted') {
      headline = `${issueCode || 'Lỗi hiện trường'} đã báo khắc phục`
      body = rawMessage || 'Người phụ trách đã báo khắc phục, cần kiểm tra/xác nhận lại'
    } else if (notifType === 'project_site_issue_reopened') {
      headline = `${issueCode || 'Lỗi hiện trường'} nghiệm thu không đạt`
      body = rawMessage || 'Lỗi hiện trường cần mở lại để tiếp tục xử lý'
    } else if (notifType === 'project_site_issue_cancelled') {
      headline = `${issueCode || 'Lỗi hiện trường'} đã bị hủy`
      body = rawMessage || 'Lỗi hiện trường đã được hủy khỏi luồng xử lý'
    } else if (notifType === 'project_site_issue_commented') {
      headline = `${issueCode || 'Lỗi hiện trường'} có ghi chú mới`
      body = rawMessage || 'Có ghi chú mới trong quá trình xử lý lỗi'
    }
  }

  return {
    source_label: sourceLabel,
    headline,
    body,
    href,
    project_name: projectName || null,
    issue_code: issueCode || null,
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireInternalUser()
    if (auth.error || !auth.ctx) return auth.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const session: any = auth.ctx.session
    const canReadCustomers = hasPermission(auth.ctx, PERMISSIONS.customersRead)
    const canManageCustomers = hasPermission(auth.ctx, PERMISSIONS.customersManage)

    const now = new Date()
    const { searchParams } = new URL(req.url)
    const notifStatus = String(searchParams.get('status') || '').trim().toLowerCase()
    const page = Math.max(1, Number(searchParams.get('page') || 1) || 1)
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || 20) || 20))
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000)

    const [reminderLogs, hotLeads, workSuggestions, userNotifs, readKeys] = await Promise.all([
      canReadCustomers ? db.contactLog.findMany({
        where: {
          next_action: { not: null },
          contact_date: { gte: daysAgo(7), lte: daysAgo(2) },
          ...(canManageCustomers ? {} : { sales_id: session.user.id }),
        },
        include: {
          customer: { select: { id: true, phone_number: true, full_name: true, potential_score: true } },
          sales: { select: { username: true } },
        },
        orderBy: { contact_date: 'asc' },
        take: 20,
      }) : Promise.resolve([]),
      canReadCustomers ? db.customer.findMany({
        where: { status: 'Mới', potential_score: { gte: 7 } },
        orderBy: { potential_score: 'desc' },
        take: 5,
      }) : Promise.resolve([]),
      (db as any).workSuggestionRecipient.findMany({
        where: {
          user_id: session.user.id,
          response_status: { in: ['pending', 'assigned', 'accepted'] },
          suggestion: {
            status: { in: ['pending', 'assigned', 'accepted'] },
          },
        },
        include: {
          suggestion: {
            include: {
              customer: { select: { id: true, full_name: true, phone_number: true, potential_score: true } },
            },
          },
        },
        orderBy: { created_at: 'desc' },
        take: 30,
      }),
      (db as any).userNotification.findMany({
        where: {
          user_id: session.user.id,
          ...(notifStatus ? { status: notifStatus } : {}),
        },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
      db.notificationRead.findMany({
        where: { user_id: session.user.id },
        select: { notif_key: true },
      }),
    ])

    const readSet = new Set(readKeys.map((record) => record.notif_key))

    const notifications = [
      ...userNotifs.map((n: any) => ({
        id: `unf:${n.id}`,
        type: n.type || 'info',
        customer_id: (n.metadata_json && (n.metadata_json.customer_id as string)) || null,
        customer: null,
        next_action: n.message || n.title,
        ...buildUserNotificationDisplay(n),
        days_ago: Math.floor((now.getTime() - new Date(n.created_at).getTime()) / 86400000),
        lead_score: null,
        ai_sentiment: null,
        is_read: n.status === 'read' || n.status === 'done' || n.status === 'accepted' || n.status === 'rejected' || readSet.has(`unf:${n.id}`),
        notif_status: n.status,
        source_type: n.source_type || null,
        source_id: n.source_id || null,
      })),
      ...reminderLogs.map((log) => ({
        id: `log:${log.id}`,
        type: log.ai_sentiment === 'Gay gắt' ? 'urgent' : 'reminder',
        customer_id: log.customer?.id,
        customer: {
          id: log.customer?.id,
          full_name: log.customer?.full_name,
          phone_number: log.customer?.phone_number,
          lead_score: log.customer?.potential_score,
        },
        next_action: log.next_action,
        days_ago: Math.floor((now.getTime() - new Date(log.contact_date).getTime()) / 86400000),
        lead_score: log.customer?.potential_score || null,
        ai_sentiment: log.ai_sentiment,
        is_read: readSet.has(`log:${log.id}`),
      })),
      ...hotLeads.map((customer) => ({
        id: `lead:${customer.id}`,
        type: 'hot_lead',
        customer_id: customer.id,
        customer: {
          id: customer.id,
          full_name: customer.full_name,
          phone_number: customer.phone_number,
          lead_score: customer.potential_score,
        },
        next_action: 'Lead score cao, chưa được tư vấn',
        days_ago: null,
        lead_score: customer.potential_score,
        ai_sentiment: null,
        is_read: readSet.has(`lead:${customer.id}`),
      })),
      ...workSuggestions.map((row: any) => ({
        id: `work:${row.id}`,
        type: row.suggestion?.due_at && new Date(row.suggestion.due_at).getTime() < now.getTime()
          ? 'urgent'
          : 'work',
        customer_id: row.suggestion?.customer?.id || null,
        customer: {
          id: row.suggestion?.customer?.id || null,
          full_name: row.suggestion?.customer?.full_name || null,
          phone_number: row.suggestion?.customer?.phone_number || null,
          lead_score: row.suggestion?.customer?.potential_score || null,
        },
        next_action: row.suggestion?.next_action_text || row.suggestion?.title || 'Cong viec can xu ly',
        days_ago: row.suggestion?.due_at
          ? Math.floor((now.getTime() - new Date(row.suggestion.due_at).getTime()) / 86400000)
          : null,
        lead_score: null,
        ai_sentiment: null,
        is_read: readSet.has(`work:${row.id}`),
      })),
    ]

    notifications.sort((a, b) => {
      if (!a.is_read && b.is_read) return -1
      if (a.is_read && !b.is_read) return 1
      const order: Record<string, number> = { urgent: 0, hot_lead: 1, reminder: 2 }
      return (order[a.type] || 2) - (order[b.type] || 2)
    })

    const unread = notifications.filter((notification) => !notification.is_read).length
    const total = notifications.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * pageSize
    const data = notifications.slice(start, start + pageSize)

    return NextResponse.json({
      data,
      total,
      unread,
      page: safePage,
      pageSize,
      totalPages,
    })
  } catch (error) {
    console.error('GET /api/notifications failed', error)
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireInternalUser()
    if (auth.error || !auth.ctx) return auth.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const session: any = auth.ctx.session
    const canReadCustomers = hasPermission(auth.ctx, PERMISSIONS.customersRead)
    const canManageCustomers = hasPermission(auth.ctx, PERMISSIONS.customersManage)

    const { keys, mark_all } = await req.json()

    if (mark_all) {
      const now = new Date()
      const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000)
      const [logs, leads, works, unfs] = await Promise.all([
        canReadCustomers ? db.contactLog.findMany({
          where: {
            next_action: { not: null },
            contact_date: { gte: daysAgo(7), lte: daysAgo(2) },
            ...(canManageCustomers ? {} : { sales_id: session.user.id }),
          },
          select: { id: true },
        }) : Promise.resolve([]),
        canReadCustomers ? db.customer.findMany({
          where: { status: 'Mới', potential_score: { gte: 7 } },
          select: { id: true },
        }) : Promise.resolve([]),
        (db as any).workSuggestionRecipient.findMany({
          where: {
            user_id: session.user.id,
            response_status: { in: ['pending', 'assigned', 'accepted'] },
            suggestion: {
              status: { in: ['pending', 'assigned', 'accepted'] },
            },
          },
          select: { id: true },
        }),
        (db as any).userNotification.findMany({
          where: { user_id: session.user.id, status: { in: ['pending', 'assigned'] } },
          select: { id: true },
        }),
      ])

      const allKeys = [
        ...logs.map((log) => `log:${log.id}`),
        ...leads.map((customer) => `lead:${customer.id}`),
        ...works.map((w: any) => `work:${w.id}`),
        ...unfs.map((n: any) => `unf:${n.id}`),
      ]

      for (const key of allKeys) {
        await db.notificationRead.upsert({
          where: { user_id_notif_key: { user_id: session.user.id, notif_key: key } },
          create: { user_id: session.user.id, notif_key: key },
          update: {},
        })
      }
      await (db as any).userNotification.updateMany({
        where: { user_id: session.user.id, status: { in: ['pending', 'assigned'] } },
        data: { status: 'read', read_at: new Date() },
      })

      return NextResponse.json({ marked: allKeys.length })
    }

    const notifKeys: string[] = keys || []
    for (const key of notifKeys) {
      await db.notificationRead.upsert({
        where: { user_id_notif_key: { user_id: session.user.id, notif_key: key } },
        create: { user_id: session.user.id, notif_key: key },
        update: {},
      })
    }
    const unfIds = notifKeys
      .map((k) => String(k))
      .filter((k) => k.startsWith('unf:'))
      .map((k) => k.slice(4))
      .filter(Boolean)
    if (unfIds.length) {
      await (db as any).userNotification.updateMany({
        where: { id: { in: unfIds }, user_id: session.user.id },
        data: { status: 'read', read_at: new Date() },
      })
    }

    return NextResponse.json({ marked: notifKeys.length })
  } catch (error) {
    console.error('POST /api/notifications failed', error)
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
  }
}
