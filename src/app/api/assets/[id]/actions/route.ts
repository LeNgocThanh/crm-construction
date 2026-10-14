import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireResourceAccess } from '@/lib/access-control'

function toIsoOrNull(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireResourceAccess({ resourceType: 'asset', action: 'write', resourceId: params.id })
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const body = await req.json()
  const actionKey = String(body?.action_key || '').trim().toLowerCase()
  if (!actionKey) return NextResponse.json({ error: 'Thieu action_key' }, { status: 400 })

  const actionType = await db.assetActionType.findFirst({
    where: { action_key: actionKey, is_active: true },
  })
  if (!actionType) return NextResponse.json({ error: 'Action khong ton tai hoac da tat' }, { status: 400 })

  if (actionType.requires_note && !String(body?.description || '').trim()) {
    return NextResponse.json({ error: 'Action nay bat buoc nhap mo ta' }, { status: 400 })
  }
  if (actionType.requires_due_at && !body?.due_at) {
    return NextResponse.json({ error: 'Action nay bat buoc due_at' }, { status: 400 })
  }
  if (actionType.requires_customer && !body?.customer_id) {
    return NextResponse.json({ error: 'Action nay bat buoc customer_id' }, { status: 400 })
  }
  if (actionType.requires_project && !body?.project_id) {
    return NextResponse.json({ error: 'Action nay bat buoc project_id' }, { status: 400 })
  }
  const handoverFromUserId = body?.handover_from_user_id ? String(body.handover_from_user_id).trim() : ''
  const handoverToUserId = body?.handover_to_user_id ? String(body.handover_to_user_id).trim() : ''
  if (actionType.requires_handover_from && !handoverFromUserId) {
    return NextResponse.json({ error: 'Action nay bat buoc nguoi giao' }, { status: 400 })
  }
  if (actionType.requires_handover_to && !handoverToUserId) {
    return NextResponse.json({ error: 'Action nay bat buoc nguoi nhan' }, { status: 400 })
  }
  const asset = await db.asset.findUnique({ where: { id: params.id } })
  if (!asset) return NextResponse.json({ error: 'Khong tim thay asset' }, { status: 404 })

  const statusTo = body?.status_to ? String(body.status_to) : null
  const allowedStatusTo = Array.isArray(actionType.allowed_status_to_json)
    ? actionType.allowed_status_to_json.map((x: any) => String(x || '').trim()).filter(Boolean)
    : []
  if (actionType.requires_status_to && !statusTo) {
    return NextResponse.json({ error: 'Action nay bat buoc status_to' }, { status: 400 })
  }
  if (statusTo && allowedStatusTo.length > 0 && !allowedStatusTo.includes(statusTo)) {
    return NextResponse.json({ error: 'status_to khong nam trong danh sach cho phep cua action' }, { status: 400 })
  }
  const warrantyEndDate = body?.warranty_end_date ? new Date(body.warranty_end_date) : null
  const note = body?.description ? String(body.description) : null
  const customerId = body?.customer_id ? String(body.customer_id).trim() : null
  const projectId = body?.project_id ? String(body.project_id).trim() : null
  const warrantyFromDate = body?.warranty_from_date ? new Date(body.warranty_from_date) : null
  const warrantyProvider = body?.warranty_provider ? String(body.warranty_provider).trim() : null
  const quantity = body?.quantity != null && body?.quantity !== '' ? Number(body.quantity) : null
  const attachmentUrl = body?.attachment_url ? String(body.attachment_url).trim() : null
  const conditionNote = body?.condition_note ? String(body.condition_note).trim() : null
  const accessoriesHandover = Array.isArray(body?.accessories_handover)
    ? body.accessories_handover.map((x: any) => String(x || '').trim()).filter(Boolean)
    : (typeof body?.accessories_handover === 'string'
      ? String(body.accessories_handover).split(/\r?\n|,/g).map((x) => x.trim()).filter(Boolean)
      : [])
  const happenedAt = body?.happened_at ? new Date(body.happened_at) : new Date()

  let data: any
  try {
    data = await db.$transaction(async (tx) => {
      const nextHolderUserId = actionType.apply_owner_transfer ? (handoverToUserId || null) : undefined
      if (actionType.apply_owner_transfer && actionType.requires_handover_from) {
        const currentHolder = String(asset.current_holder_user_id || '').trim()
        if (currentHolder !== handoverFromUserId) {
          throw new Error('Nguoi giao khong trung voi nguoi dang giu tai san hien tai')
        }
      }

      const before = {
        holder_user_id: asset.current_holder_user_id || null,
        status: asset.status || null,
        current_customer_id: asset.current_customer_id || null,
        current_project_id: asset.current_project_id || null,
        warranty_start_date: toIsoOrNull(asset.warranty_start_date),
        warranty_end_date: toIsoOrNull(asset.warranty_end_date),
        warranty_provider: asset.warranty_provider || null,
      }

      const assetUpdateData: any = {
        ...(statusTo ? { status: statusTo } : {}),
        ...(warrantyEndDate ? { warranty_end_date: warrantyEndDate } : {}),
        ...(warrantyFromDate ? { warranty_start_date: warrantyFromDate } : {}),
        ...(warrantyProvider ? { warranty_provider: warrantyProvider } : {}),
        ...(customerId ? { current_customer_id: customerId } : {}),
        ...(projectId ? { current_project_id: projectId } : {}),
        ...(nextHolderUserId !== undefined ? { current_holder_user_id: nextHolderUserId } : {}),
      }
      const hasAssetUpdates = Object.keys(assetUpdateData).length > 0
      const updatedAsset = hasAssetUpdates
        ? await tx.asset.update({
          where: { id: params.id },
          data: assetUpdateData,
          select: {
            current_holder_user_id: true,
            status: true,
            current_customer_id: true,
            current_project_id: true,
            warranty_start_date: true,
            warranty_end_date: true,
            warranty_provider: true,
          },
        })
        : {
          current_holder_user_id: asset.current_holder_user_id,
          status: asset.status,
          current_customer_id: asset.current_customer_id,
          current_project_id: asset.current_project_id,
          warranty_start_date: asset.warranty_start_date,
          warranty_end_date: asset.warranty_end_date,
          warranty_provider: asset.warranty_provider,
        }

      const after = {
        holder_user_id: updatedAsset.current_holder_user_id || null,
        status: updatedAsset.status || null,
        current_customer_id: updatedAsset.current_customer_id || null,
        current_project_id: updatedAsset.current_project_id || null,
        warranty_start_date: toIsoOrNull(updatedAsset.warranty_start_date),
        warranty_end_date: toIsoOrNull(updatedAsset.warranty_end_date),
        warranty_provider: updatedAsset.warranty_provider || null,
      }

      const changes = {
        holder_changed: before.holder_user_id !== after.holder_user_id,
        status_changed: before.status !== after.status,
        customer_changed: before.current_customer_id !== after.current_customer_id,
        project_changed: before.current_project_id !== after.current_project_id,
        warranty_changed:
          before.warranty_start_date !== after.warranty_start_date ||
          before.warranty_end_date !== after.warranty_end_date ||
          before.warranty_provider !== after.warranty_provider,
      }

      const participantUserIds = Array.from(
        new Set(
          [
            String(session.user.id || '').trim(),
            handoverFromUserId,
            handoverToUserId,
            String(before.holder_user_id || '').trim(),
            String(after.holder_user_id || '').trim(),
          ].filter(Boolean),
        ),
      )
      const userRows = participantUserIds.length
        ? await tx.user.findMany({
          where: { id: { in: participantUserIds } },
          select: { id: true, username: true },
        })
        : []
      const userNameById = new Map(userRows.map((u) => [u.id, u.username || u.id]))
      const usernameOrId = (id: string | null | undefined) => {
        const key = String(id || '').trim()
        if (!key) return '-'
        return userNameById.get(key) || key
      }
      const participants = [
        { role: 'actor', user_id: String(session.user.id || '').trim() },
        ...(handoverFromUserId ? [{ role: 'handover_from', user_id: handoverFromUserId }] : []),
        ...(handoverToUserId ? [{ role: 'handover_to', user_id: handoverToUserId }] : []),
      ]
      const participantWithNames = participants.map((p) => ({
        role: p.role,
        user_id: p.user_id,
        username: userNameById.get(p.user_id) || p.user_id,
      }))

      const descriptionParts = [
        `${actionType.action_name || actionType.action_key} ${asset.asset_name}`,
        `holder: ${usernameOrId(before.holder_user_id)} -> ${usernameOrId(after.holder_user_id)}`,
        `status: ${before.status || '-'} -> ${after.status || '-'}`,
      ]
      if (quantity != null) descriptionParts.push(`qty: ${quantity}`)
      if (accessoriesHandover.length) descriptionParts.push(`phu_kien: ${accessoriesHandover.join(', ')}`)
      if (conditionNote) descriptionParts.push(`tinh_trang: ${conditionNote}`)
      if (customerId || projectId) descriptionParts.push(`ctx: c=${customerId || '-'}, p=${projectId || '-'}`)
      if (note) descriptionParts.push(`note: ${note}`)
      const autoDescription = descriptionParts.join(' | ')

      const ev = await tx.assetLifecycleEvent.create({
        data: {
          asset_id: params.id,
          event_key: actionType.action_key,
          title: String(body?.title || actionType.action_name || actionType.action_key),
          description: autoDescription,
          actor_user_id: String(session.user.id || ''),
          happened_at: happenedAt,
          metadata_json: {
            schema_version: 1,
            action: {
              id: actionType.id,
              key: actionType.action_key,
              name: actionType.action_name,
              category: actionType.category,
            },
            asset: {
              id: asset.id,
              code: asset.asset_code,
              name: asset.asset_name,
            },
            actor: {
              id: String(session.user.id || ''),
              username: userNameById.get(String(session.user.id || '').trim()) || String(session.user.name || ''),
            },
            context: {
              due_at: body?.due_at || null,
              customer_id: customerId || null,
              project_id: projectId || null,
              attachment_url: attachmentUrl,
            },
            handover_document: {
              generated_at: happenedAt.toISOString(),
              asset_name: asset.asset_name,
              asset_code: asset.asset_code,
              action_name: actionType.action_name,
              handover_from: handoverFromUserId ? {
                user_id: handoverFromUserId,
                username: userNameById.get(handoverFromUserId) || handoverFromUserId,
              } : null,
              handover_to: handoverToUserId ? {
                user_id: handoverToUserId,
                username: userNameById.get(handoverToUserId) || handoverToUserId,
              } : null,
              status_from: before.status,
              status_to: after.status,
              condition_note: conditionNote,
              accessories_handover: accessoriesHandover,
              quantity: quantity,
              note: note,
              attachment_url: attachmentUrl,
            },
            inputs: {
              handover_from_user_id: handoverFromUserId || null,
              handover_to_user_id: handoverToUserId || null,
              apply_owner_transfer: !!actionType.apply_owner_transfer,
              status_to: statusTo,
              quantity: quantity,
              condition_note: conditionNote,
              accessories_handover: accessoriesHandover,
              warranty_from_date: body?.warranty_from_date || null,
              warranty_end_date: body?.warranty_end_date || null,
              warranty_provider: warrantyProvider,
              note: note,
            },
            before,
            after,
            changes,
            participants: participantWithNames,
            search: {
              participant_user_ids: participantUserIds,
              participant_usernames: participantUserIds.map((id) => userNameById.get(id) || id),
              primary_user_id: handoverToUserId || handoverFromUserId || String(session.user.id || ''),
              primary_username:
                userNameById.get(handoverToUserId) ||
                userNameById.get(handoverFromUserId) ||
                userNameById.get(String(session.user.id || '').trim()) ||
                String(session.user.name || ''),
            },
            extra: body?.metadata_json ?? null,
          },
        },
      })
      return ev
    })
  } catch (err: any) {
    const msg = String(err?.message || 'Thuc hien action that bai')
    if (msg.includes('Nguoi giao khong trung')) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    throw err
  }

  return NextResponse.json({ data }, { status: 201 })
}
