import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'
import { createProjectTimelineEvent } from '@/lib/project-timeline'
import {
  isValidProjectDocumentAccessLevel,
  isValidProjectDocumentScope,
  isValidProjectDocumentType,
} from '@/lib/projects/document-taxonomy'

function serDoc(x: any) {
  return {
    ...x,
    file_size_bytes: x?.file_size_bytes != null ? Number(x.file_size_bytes) : null,
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; docId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const existing = await db.projectDocument.findFirst({
    where: { id: params.docId, project_id: params.id },
  })
  if (!existing) return NextResponse.json({ error: 'Khong tim thay tai lieu' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const patch: any = {}
  if (body?.title !== undefined) patch.title = body.title ? String(body.title) : existing.title
  if (body?.file_record_id !== undefined) {
    const nextId = body.file_record_id ? String(body.file_record_id).trim() : ''
    if (!nextId) {
      patch.file_record_id = null
    } else {
      const fr = await (db as any).fileRecord.findFirst({ where: { id: nextId, is_active: true } })
      if (!fr) return NextResponse.json({ error: 'file_record_khong_hop_le' }, { status: 400 })
      patch.file_record_id = fr.id
      if (body?.file_url === undefined) patch.file_url = fr.file_url
      if (body?.file_name === undefined) patch.file_name = fr.file_name || null
      if (body?.mime_type === undefined) patch.mime_type = fr.mime_type || null
      if (body?.file_size_bytes === undefined) patch.file_size_bytes = fr.file_size_bytes ?? null
    }
  }
  if (body?.file_url !== undefined) patch.file_url = body.file_url ? String(body.file_url) : existing.file_url
  if (body?.file_name !== undefined) patch.file_name = body.file_name ? String(body.file_name) : null
  if (body?.mime_type !== undefined) patch.mime_type = body.mime_type ? String(body.mime_type) : null
  if (body?.file_size_bytes !== undefined) {
    patch.file_size_bytes = body.file_size_bytes != null ? BigInt(Math.round(Number(body.file_size_bytes) || 0)) : null
  }
  if (body?.document_scope !== undefined) {
    const next = body.document_scope ? String(body.document_scope) : existing.document_scope
    if (!isValidProjectDocumentScope(next)) return NextResponse.json({ error: 'document_scope_khong_hop_le' }, { status: 400 })
    patch.document_scope = next
  }
  if (body?.document_type !== undefined) {
    const next = body.document_type ? String(body.document_type) : existing.document_type
    if (!isValidProjectDocumentType(next)) return NextResponse.json({ error: 'document_type_khong_hop_le' }, { status: 400 })
    patch.document_type = next
  }
  if (body?.access_level !== undefined) {
    const next = body.access_level ? String(body.access_level) : existing.access_level
    if (!isValidProjectDocumentAccessLevel(next)) return NextResponse.json({ error: 'access_level_khong_hop_le' }, { status: 400 })
    patch.access_level = next
  }
  if (body?.source_ref_type !== undefined) patch.source_ref_type = body.source_ref_type ? String(body.source_ref_type) : null
  if (body?.source_ref_id !== undefined) patch.source_ref_id = body.source_ref_id ? String(body.source_ref_id) : null
  if (body?.note !== undefined) patch.note = body.note ? String(body.note) : null
  if (body?.is_active !== undefined) patch.is_active = Boolean(body.is_active)

  const updated = await db.projectDocument.update({
    where: { id: params.docId },
    data: patch,
    include: {
      uploader: { select: { id: true, username: true } },
      file_record: { select: { id: true, file_name: true, file_url: true, mime_type: true, file_size_bytes: true, purpose: true } },
    },
  })
  const project = await db.constructionProject.findUnique({
    where: { id: params.id },
    select: { customer_id: true },
  })
  await createProjectTimelineEvent({
    project_id: params.id,
    customer_id: project?.customer_id || null,
    event_key: 'project_document_updated',
    title: 'Cap nhat tai lieu du an',
    description: `${updated.title}`,
    source_ref_type: 'project_document',
    source_ref_id: updated.id,
    actor_user_id: String(session.user.id || '') || null,
    metadata_json: {
      document_scope: updated.document_scope,
      document_type: updated.document_type,
      access_level: updated.access_level,
    },
  })
  return NextResponse.json({ data: serDoc(updated) })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string; docId: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsManage)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const existing = await db.projectDocument.findFirst({
    where: { id: params.docId, project_id: params.id },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: 'Khong tim thay tai lieu' }, { status: 404 })

  await db.projectDocument.delete({ where: { id: params.docId } })
  const project = await db.constructionProject.findUnique({
    where: { id: params.id },
    select: { customer_id: true },
  })
  await createProjectTimelineEvent({
    project_id: params.id,
    customer_id: project?.customer_id || null,
    event_key: 'project_document_deleted',
    title: 'Xoa tai lieu du an',
    description: `${params.docId}`,
    source_ref_type: 'project_document',
    source_ref_id: params.docId,
    actor_user_id: String(session.user.id || '') || null,
  })
  return NextResponse.json({ ok: true })
}
