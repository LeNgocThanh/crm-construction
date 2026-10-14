import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createCareActivitySafe } from '@/lib/customer-care'
import { createRequirementSnapshotSafe } from '@/lib/project-requirement-snapshots'
import { createUserNotification } from '@/lib/user-notifications'
import { createProjectTimelineEvent } from '@/lib/project-timeline'
import { requirePermission } from '@/lib/authz'
import { requireCustomerAccess } from '@/lib/access-control'
import { PERMISSIONS } from '@/lib/permissions'

function safeJson<T>(payload: T): T {
  return JSON.parse(
    JSON.stringify(payload, (_k, v) => (typeof v === 'bigint' ? Number(v) : v))
  ) as T
}

function safe(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(safe)
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) out[k] = safe(v)
    return out
  }
  return obj
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireCustomerAccess('read', params.id)
  if (auth.error) return auth.error

  const [customer, currentRequirementSnapshot] = await Promise.all([
    db.customer.findUnique({
      where: { id: params.id },
      include: {
        contact_logs: {
          orderBy: { contact_date: 'desc' },
          include: { sales: { select: { username: true } } },
        },
        projects: {
          orderBy: { created_at: 'desc' },
          include: { confirmer: { select: { username: true } } },
        },
        timeline: {
          orderBy: { happened_at: 'desc' },
          include: { creator: { select: { username: true } } },
        },
        care_activities: {
          where: { status: 'open' },
          take: 1,
          orderBy: [{ due_at: 'asc' }, { happened_at: 'desc' }, { created_at: 'desc' }],
        },
      },
    }),
    (db as any).projectRequirementSnapshot.findFirst({
      where: { customer_id: params.id, is_current: true },
      orderBy: [{ version_no: 'desc' }],
    }),
  ])

  if (!customer) return NextResponse.json({ error: 'Khong tim thay' }, { status: 404 })

  const result: any = safe(customer)
  const activeCare = customer.care_activities?.[0] || null
  result.active_care_activity_id = activeCare?.id || null
  result.active_care_due_at = activeCare?.due_at || null
  result.active_care_priority = activeCare?.priority || null
  result.active_care_status = activeCare?.status || null
  result.active_care_pipeline_phase = activeCare?.pipeline_phase || null
  result.next_action = activeCare?.next_action_snapshot || activeCare?.summary || null
  result.logs = safe(customer.contact_logs) || []

  const normalized = currentRequirementSnapshot?.normalized_json && typeof currentRequirementSnapshot.normalized_json === 'object'
    ? currentRequirementSnapshot.normalized_json
    : null

  // customer.address = residential address; construction address comes from snapshot table
  result.construction_address = normalized && (normalized as any).address ? String((normalized as any).address) : null
  result.requirement_snapshot_current = safe(currentRequirementSnapshot)

  return NextResponse.json(safeJson({ data: result }))
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireCustomerAccess('write', params.id)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const body = await req.json()
  if (body.facebook !== undefined && body.messenger_username === undefined) {
    body.messenger_username = body.facebook
  }

  const allowed = [
    'full_name', 'phone_number', 'status', 'address',
    'type',
    'house_type', 'floors', 'floor_area', 'budget_min', 'budget_max',
    'potential_score', 'potential_level', 'next_action',
    'source', 'referrer_name', 'referrer_phone', 'assigned_to',
    'telegram_id', 'telegram_username', 'zalo_id', 'zalo_username',
    'messenger_id', 'messenger_username',
  ]

  const data: any = {}
  const constructionAddressProvided = body.construction_address !== undefined
  const constructionAddressValue = constructionAddressProvided
    ? (typeof body.construction_address === 'string' ? body.construction_address.trim() || null : null)
    : undefined

  for (const k of allowed) {
    if (body[k] !== undefined) {
      if ((k === 'budget_min' || k === 'budget_max') && body[k]) data[k] = BigInt(body[k])
      else if (typeof body[k] === 'string') data[k] = body[k].trim() || null
      else data[k] = body[k]
    }
  }
  if (data.type !== undefined) {
    const v = String(data.type || '').trim().toLowerCase()
    if (!['unverified', 'verified'].includes(v)) {
      return NextResponse.json({ error: 'type khong hop le (unverified | verified)' }, { status: 400 })
    }
    data.type = v
  }

  const prev = await db.customer.findUnique({
    where: { id: params.id },
    select: { id: true, next_action: true, type: true, assigned_to: true },
  })
  if (!prev) return NextResponse.json({ error: 'Khong tim thay' }, { status: 404 })

  const customer = await db.customer.update({ where: { id: params.id }, data })

  if (body.type !== undefined) {
    const prevType = String((prev as any)?.type || '').trim() || 'unverified'
    const nextType = String((customer as any)?.type || '').trim() || 'unverified'
    if (prevType !== nextType) {
      await createCareActivitySafe({
        customer_id: params.id,
        activity_type: 'customer_type_changed',
        summary: 'Cap nhat loai xac thuc khach hang',
        detail: `type cu: ${prevType} -> moi: ${nextType}`,
        source_ref_type: 'customer_update',
        source_ref_id: params.id,
        channel: 'other',
        created_by: session.user.id,
        metadata_json: {
          source: 'api/customers/[id]',
          from_type: prevType,
          to_type: nextType,
        },
      })
    }
  }

  if (constructionAddressProvided) {
    const prevCurrent = await (db as any).projectRequirementSnapshot.findFirst({
      where: { customer_id: params.id, is_current: true },
      orderBy: [{ version_no: 'desc' }],
      select: { normalized_json: true },
    })
    const prevNormalized = prevCurrent?.normalized_json && typeof prevCurrent.normalized_json === 'object'
      ? prevCurrent.normalized_json
      : {}

    await createRequirementSnapshotSafe({
      customer_id: params.id,
      source_type: 'manual',
      source_ref_id: params.id,
      extracted_json: null,
      normalized_json: {
        ...(prevNormalized as any),
        address: constructionAddressValue,
      },
      note: 'Cap nhat dia chi xay dung tu trang chi tiet khach hang',
      created_by: session.user.id,
    })
  }

  if (body.next_action !== undefined) {
    const prevNext = String(prev.next_action || '').trim()
    const nextValue = String(customer.next_action || '').trim()
    if (prevNext !== nextValue) {
      await createCareActivitySafe({
        customer_id: params.id,
        activity_type: 'next_action_update',
        summary: 'Cap nhat next_action tu trang chi tiet khach hang',
        detail: `next_action cu: ${prevNext || '(trong)'} -> moi: ${nextValue || '(trong)'}`,
        next_action_snapshot: customer.next_action || null,
        source_ref_type: 'customer_update',
        source_ref_id: params.id,
        channel: 'other',
        created_by: session.user.id,
        metadata_json: {
          source: 'api/customers/[id]',
          updated_fields: Object.keys(data || {}),
        },
      })
    }
  }

  if (body.assigned_to !== undefined) {
    const prevAssigned = String((prev as any)?.assigned_to || '').trim() || null
    const nextAssigned = String((customer as any)?.assigned_to || '').trim() || null
    if (prevAssigned !== nextAssigned) {
      const users = await db.user.findMany({
        where: { id: { in: [prevAssigned, nextAssigned].filter(Boolean) as string[] } },
        select: { id: true, username: true },
      })
      const userMap = new Map(users.map((u) => [u.id, u.username]))
      const prevName = prevAssigned ? (userMap.get(prevAssigned) || prevAssigned) : '(chua gan)'
      const nextName = nextAssigned ? (userMap.get(nextAssigned) || nextAssigned) : '(bo gan)'

      await db.customerTimeline.create({
        data: {
          customer_id: params.id,
          type: 'owner_changed',
          title: 'Cap nhat nguoi phu trach khach hang',
          description: `chuyen phu trach: ${prevName} -> ${nextName}`,
          happened_at: new Date(),
          created_by: session.user.id,
          metadata: {
            from_user_id: prevAssigned,
            to_user_id: nextAssigned,
            source: 'api/customers/[id]',
          },
        },
      })

      const actorId = String(session.user.id || '')
      const customerLabel = String((customer as any)?.full_name || (customer as any)?.phone_number || params.id)
      const syncProjectOwners = body?.sync_project_owners !== false
      let syncedProjectCount = 0
      if (syncProjectOwners) {
        const openProjects = await db.constructionProject.findMany({
          where: {
            customer_id: params.id,
            status: { notIn: ['completed', 'cancelled'] },
          },
          select: { id: true, project_name: true, owner_id: true, status: true },
        })
        for (const p of openProjects) {
          const prevOwnerId = String(p.owner_id || '').trim() || null
          if (prevOwnerId === nextAssigned) {
            await db.constructionProject.update({
              where: { id: p.id },
              data: { default_owner_id: nextAssigned || null },
            })
            continue
          }
          await db.constructionProject.update({
            where: { id: p.id },
            data: {
              owner_id: nextAssigned || null,
              default_owner_id: nextAssigned || null,
            },
          })
          await createProjectTimelineEvent({
            project_id: p.id,
            customer_id: params.id,
            event_key: 'project_owner_changed',
            title: 'Doi nguoi phu trach du an',
            description: `${p.project_name || p.id}: ${prevName} -> ${nextName}`,
            source_ref_type: 'customer_assignee_sync',
            source_ref_id: params.id,
            actor_user_id: actorId || null,
            metadata_json: {
              from_owner_id: prevOwnerId,
              to_owner_id: nextAssigned,
              sync_source: 'customer_assignee_sync',
              customer_id: params.id,
            },
          })
          syncedProjectCount += 1
        }
      }
      if (nextAssigned && nextAssigned !== actorId) {
        await createUserNotification({
          user_id: nextAssigned,
          type: 'customer_owner_assigned',
          title: `Duoc giao phu trach khach hang: ${customerLabel}`,
          message: `Ban duoc gan phu trach thay cho ${prevName}${syncProjectOwners ? ` | dong bo ${syncedProjectCount} du an mo` : ''}`,
          source_type: 'customer',
          source_id: params.id,
          related_user_id: actorId,
          metadata_json: {
            customer_id: params.id,
            from_user_id: prevAssigned,
            to_user_id: nextAssigned,
            event: 'customer_assignee_changed',
            sync_project_owners: syncProjectOwners,
            synced_project_count: syncedProjectCount,
          },
        })
      }
      if (prevAssigned && prevAssigned !== actorId) {
        await createUserNotification({
          user_id: prevAssigned,
          type: 'customer_owner_reassigned',
          title: `Khach hang da duoc chuyen phu trach: ${customerLabel}`,
          message: `Nguoi phu trach moi: ${nextName}${syncProjectOwners ? ` | dong bo ${syncedProjectCount} du an mo` : ''}`,
          source_type: 'customer',
          source_id: params.id,
          related_user_id: actorId,
          metadata_json: {
            customer_id: params.id,
            from_user_id: prevAssigned,
            to_user_id: nextAssigned,
            event: 'customer_assignee_changed',
            sync_project_owners: syncProjectOwners,
            synced_project_count: syncedProjectCount,
          },
        })
      }

      const managerUsers = await db.user.findMany({
        where: {
          is_active: true,
          role_memberships: {
            some: {
              role: {
                is_active: true,
                role_key: { in: ['admin', 'manager'] },
              },
            },
          },
        },
        select: { id: true },
      })
      const managerTargets = new Set(managerUsers.map((x) => String(x.id || '').trim()).filter(Boolean))
      managerTargets.delete(actorId)
      if (nextAssigned) managerTargets.delete(nextAssigned)
      if (prevAssigned) managerTargets.delete(prevAssigned)
      for (const uid of managerTargets) {
        await createUserNotification({
          user_id: uid,
          type: 'customer_owner_changed_manager_watch',
          title: `Cap nhat phu trach khach hang: ${customerLabel}`,
          message: `${prevName} -> ${nextName}${syncProjectOwners ? ` | dong bo ${syncedProjectCount} du an mo` : ''}`,
          source_type: 'customer',
          source_id: params.id,
          related_user_id: actorId,
          metadata_json: {
            customer_id: params.id,
            from_user_id: prevAssigned,
            to_user_id: nextAssigned,
            event: 'customer_assignee_changed',
            sync_project_owners: syncProjectOwners,
            synced_project_count: syncedProjectCount,
          },
        })
      }
    }
  }

  return NextResponse.json(safeJson({ data: safe(customer) }))
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCustomerAccess('delete', params.id)
  if (access.error) return access.error
  const auth = await requirePermission(PERMISSIONS.customersManage)
  if (auth.error) return auth.error

  await db.customer.delete({ where: { id: params.id } })
  return NextResponse.json({ message: 'Da xoa' })
}

