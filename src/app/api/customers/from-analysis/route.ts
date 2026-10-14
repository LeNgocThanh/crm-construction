// src/app/api/customers/from-analysis/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createCareActivitySafe } from '@/lib/customer-care'
import { createRequirementSnapshotSafe } from '@/lib/project-requirement-snapshots'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.customersWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const body = await req.json()
  const {
    customer_id, conversation_id, channel,
    external_user_id, display_name,
    full_name, phone_number, address,
    house_type, floors, floor_area,
    budget_min, budget_max,
    potential_score, potential_level, next_action,
  } = body

  const now = new Date()
  const conversation = conversation_id
    ? await db.conversation.findUnique({
        where: { id: String(conversation_id) },
        select: { id: true, created_at: true, channel: true },
      }).catch(() => null)
    : null

  const socialFields: any = {}
  if (channel === 'telegram') {
    socialFields.telegram_id = external_user_id || null
    socialFields.telegram_username = display_name || null
  } else if (channel === 'zalo') {
    socialFields.zalo_id = external_user_id || null
    socialFields.zalo_username = display_name || null
  } else if (channel === 'messenger') {
    socialFields.messenger_id = external_user_id || null
    socialFields.messenger_username = display_name || null
  }

  let customer: any

  if (customer_id) {
    const existing = await db.customer.findUnique({ where: { id: customer_id } })
    if (!existing) return NextResponse.json({ error: 'Không tìm thấy customer' }, { status: 404 })

    const updateData: any = {}
    if (!existing.full_name       && full_name)       updateData.full_name       = full_name
    if (!existing.phone_number    && phone_number)    updateData.phone_number    = phone_number
    if (!existing.house_type      && house_type)      updateData.house_type      = house_type
    if (!existing.floors          && floors)          updateData.floors          = floors
    if (!existing.floor_area      && floor_area)      updateData.floor_area      = floor_area
    if (!existing.budget_min      && budget_min)      updateData.budget_min      = BigInt(budget_min)
    if (!existing.budget_max      && budget_max)      updateData.budget_max      = BigInt(budget_max)
    if (!existing.potential_score && potential_score) updateData.potential_score = potential_score
    if (!existing.potential_level && potential_level) updateData.potential_level = potential_level
    if (!existing.next_action     && next_action)     updateData.next_action     = next_action
    if (!existing.source)                             updateData.source          = channel
    for (const [k, v] of Object.entries(socialFields)) {
      if (!(existing as any)[k]) updateData[k] = v
    }

    customer = await db.customer.update({ where: { id: customer_id }, data: updateData })
    if (updateData.next_action) {
      await createCareActivitySafe({
        customer_id: customer.id,
        activity_type: 'next_action_update',
        summary: 'Cap nhat next_action tu analysis merge',
        detail: `next_action moi: ${String(updateData.next_action)}`,
        next_action_snapshot: String(updateData.next_action),
        source_ref_type: 'analysis',
        source_ref_id: conversation_id ? String(conversation_id) : customer.id,
        channel: channel ? String(channel) : null,
        created_by: session.user.id,
        metadata_json: {
          source: 'api/customers/from-analysis',
        },
      })
    }

  } else {
    customer = await db.customer.create({
      data: {
        full_name: full_name || null,
        phone_number: phone_number || null,
        house_type: house_type || null,
        floors: floors || null,
        floor_area: floor_area || null,
        budget_min: budget_min ? BigInt(budget_min) : null,
        budget_max: budget_max ? BigInt(budget_max) : null,
        potential_score: potential_score || null,
        potential_level: potential_level || null,
        next_action: next_action || null,
        source: channel || null,
        type: 'unverified',
        status: 'Mới',
        ...socialFields,
      },
    })

    if (next_action) {
      await createCareActivitySafe({
        customer_id: customer.id,
        activity_type: 'next_action_update',
        summary: 'Khoi tao next_action tu analysis',
        detail: `next_action khoi tao: ${String(next_action)}`,
        next_action_snapshot: String(next_action),
        source_ref_type: 'analysis',
        source_ref_id: conversation_id ? String(conversation_id) : customer.id,
        channel: channel ? String(channel) : null,
        created_by: session.user.id,
        metadata_json: {
          source: 'api/customers/from-analysis',
          action: 'create_customer',
        },
      })
    }

    await db.customerTimeline.create({
      data: {
        customer_id: customer.id,
        type: 'customer_created_from_chat',
        title: `Khởi tạo khách hàng từ ${channel === 'telegram' ? 'Telegram' : channel === 'zalo' ? 'Zalo' : channel === 'messenger' ? 'Messenger' : 'Chat'}`,
        description: conversation_id
          ? `Hội thoại đầu tiên: ${String(conversation_id)}`
          : 'Tạo customer từ dữ liệu phân tích chat',
        happened_at: conversation?.created_at || now,
        created_by: session.user.id,
        metadata: {
          source_channel: channel || null,
          conversation_id: conversation_id || null,
          first_chat_at: conversation?.created_at ? conversation.created_at.toISOString() : now.toISOString(),
          external_user_id: external_user_id || null,
          display_name: display_name || null,
          created_from: 'api/customers/from-analysis',
        },
      },
    })
  }

  if (conversation_id) {
    await db.conversation.update({
      where: { id: conversation_id },
      data: { customer_id: customer.id },
    })
  }

  await createRequirementSnapshotSafe({
    customer_id: customer.id,
    source_type: 'analysis',
    source_ref_id: conversation_id ? String(conversation_id) : customer.id,
    extracted_json: {
      full_name: full_name || null,
      phone_number: phone_number || null,
      address: address || null,
      house_type: house_type || null,
      floors: floors || null,
      floor_area: floor_area || null,
      budget_min: budget_min || null,
      budget_max: budget_max || null,
      potential_score: potential_score || null,
      potential_level: potential_level || null,
      next_action: next_action || null,
      channel: channel || null,
      external_user_id: external_user_id || null,
      display_name: display_name || null,
    },
    normalized_json: {
      address: address || null,
      house_type: house_type || null,
      floors: floors || null,
      floor_area: floor_area || null,
      budget_min: budget_min || null,
      budget_max: budget_max || null,
      potential_score: potential_score || null,
      potential_level: potential_level || null,
      next_action: next_action || null,
      source_channel: channel || null,
    },
    note: customer_id ? 'Auto snapshot from analysis merge into existing customer' : 'Auto snapshot from analysis create customer',
    created_by: session.user.id,
  })

  return NextResponse.json({
    data: customer,
    action: customer_id ? 'updated' : 'created',
  }, { status: customer_id ? 200 : 201 })
}
