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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const sp = new URL(req.url).searchParams
  const activeOnly = String(sp.get('active_only') || 'true') !== 'false'
  const scope = String(sp.get('scope') || '').trim()
  const type = String(sp.get('type') || '').trim()
  if (scope && !isValidProjectDocumentScope(scope)) {
    return NextResponse.json({ error: 'scope_khong_hop_le' }, { status: 400 })
  }
  if (type && !isValidProjectDocumentType(type)) {
    return NextResponse.json({ error: 'type_khong_hop_le' }, { status: 400 })
  }

  const where: any = { project_id: params.id }
  if (activeOnly) where.is_active = true
  if (scope) where.document_scope = scope
  if (type) where.document_type = type

  const rows = await db.projectDocument.findMany({
    where,
    orderBy: [{ uploaded_at: 'desc' }, { created_at: 'desc' }],
    include: {
      uploader: { select: { id: true, username: true } },
      file_record: { select: { id: true, file_name: true, file_url: true, mime_type: true, file_size_bytes: true, purpose: true } },
    },
  })
  return NextResponse.json({ data: rows.map(serDoc) })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const body = await req.json().catch(() => ({}))
  const title = String(body?.title || '').trim()
  const fileRecordId = body?.file_record_id ? String(body.file_record_id).trim() : ''
  const fileRecord = fileRecordId
    ? await (db as any).fileRecord.findFirst({ where: { id: fileRecordId, is_active: true } })
    : null
  const fileUrl = String(body?.file_url || fileRecord?.file_url || '').trim()
  if (!title || !fileUrl) return NextResponse.json({ error: 'Thieu title hoac file_url' }, { status: 400 })

  const scope = body?.document_scope ? String(body.document_scope) : 'internal'
  const type = body?.document_type ? String(body.document_type) : 'other'
  const access = body?.access_level ? String(body.access_level) : 'team_only'
  if (!isValidProjectDocumentScope(scope)) return NextResponse.json({ error: 'document_scope_khong_hop_le' }, { status: 400 })
  if (!isValidProjectDocumentType(type)) return NextResponse.json({ error: 'document_type_khong_hop_le' }, { status: 400 })
  if (!isValidProjectDocumentAccessLevel(access)) return NextResponse.json({ error: 'access_level_khong_hop_le' }, { status: 400 })

  const created = await db.projectDocument.create({
    data: {
      project_id: params.id,
      file_record_id: fileRecord?.id || null,
      title,
      file_url: fileUrl,
      file_name: body?.file_name ? String(body.file_name) : (fileRecord?.file_name || null),
      mime_type: body?.mime_type ? String(body.mime_type) : (fileRecord?.mime_type || null),
      file_size_bytes: body?.file_size_bytes != null ? BigInt(Math.round(Number(body.file_size_bytes) || 0)) : (fileRecord?.file_size_bytes ?? null),
      document_scope: scope,
      document_type: type,
      access_level: access,
      source_ref_type: body?.source_ref_type ? String(body.source_ref_type) : null,
      source_ref_id: body?.source_ref_id ? String(body.source_ref_id) : null,
      note: body?.note ? String(body.note) : null,
      uploaded_by: String(session.user.id || '') || null,
    },
    include: {
      uploader: { select: { id: true, username: true } },
      file_record: { select: { id: true, file_name: true, file_url: true, mime_type: true, file_size_bytes: true, purpose: true } },
    },
  })

  const project = await db.constructionProject.findUnique({
    where: { id: params.id },
    select: { customer_id: true, project_name: true },
  })
  await createProjectTimelineEvent({
    project_id: params.id,
    customer_id: project?.customer_id || null,
    event_key: 'project_document_created',
    title: 'Them tai lieu du an',
    description: `${created.title}`,
    source_ref_type: 'project_document',
    source_ref_id: created.id,
    actor_user_id: String(session.user.id || '') || null,
    metadata_json: {
      document_scope: created.document_scope,
      document_type: created.document_type,
      access_level: created.access_level,
    },
  })
  if (created.document_scope === 'investor_visible' && project?.customer_id) {
    await db.customerTimeline.create({
      data: {
        customer_id: project.customer_id,
        type: 'project_document_shared',
        title: 'Cap nhat tai lieu gui chu dau tu',
        description: `${created.title}`,
        happened_at: new Date(),
        created_by: String(session.user.id || ''),
        metadata: { project_id: params.id, document_id: created.id, document_type: created.document_type },
      },
    })
  }

  return NextResponse.json({ data: serDoc(created) }, { status: 201 })
}
