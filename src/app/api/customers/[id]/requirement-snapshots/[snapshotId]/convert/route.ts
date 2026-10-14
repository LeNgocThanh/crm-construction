import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createCareActivitySafe } from '@/lib/customer-care'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

function asObj(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>
  return {}
}

function toInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : parseInt(String(value).replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

function toFloat(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).replace(',', '.').replace(/[^\d.-]/g, '')
  const n = typeof value === 'number' ? value : parseFloat(normalized)
  return Number.isFinite(n) ? n : null
}

function toBigIntValue(value: unknown): bigint | null {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).replace(/[^\d-]/g, '')
  if (!normalized) return null
  try {
    return BigInt(normalized)
  } catch {
    return null
  }
}

function computeExtractionQuality(confidence: unknown): number | null {
  const n = typeof confidence === 'number' ? confidence : Number(confidence)
  if (!Number.isFinite(n)) return null
  if (n <= 1) return Math.max(0, Math.min(100, Math.round(n * 100)))
  return Math.max(0, Math.min(100, Math.round(n)))
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; snapshotId: string } }
) {
  const auth = await requirePermission(PERMISSIONS.customersWrite)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const body = await req.json().catch(() => ({}))

  const snapshot = await (db as any).projectRequirementSnapshot.findUnique({
    where: { id: params.snapshotId },
  })
  if (!snapshot || snapshot.customer_id !== params.id) {
    return NextResponse.json({ error: 'Khong tim thay requirement snapshot' }, { status: 404 })
  }

  if (snapshot.converted_project_id && !body.force) {
    const existingProject = await db.constructionProject.findUnique({
      where: { id: snapshot.converted_project_id },
    })
    return NextResponse.json({
      data: {
        already_converted: true,
        snapshot,
        project: existingProject,
      },
    })
  }

  const n = asObj(snapshot.normalized_json)
  const e = asObj(snapshot.extracted_json)

  const payload = {
    project_name: body.project_name ? String(body.project_name).trim() : null,
    address: body.address ? String(body.address).trim() : (n.address || e.address || null),
    house_type: body.house_type ? String(body.house_type).trim() : (n.house_type || e.house_type || null),
    floors: body.floors !== undefined ? toInt(body.floors) : toInt(n.floors ?? e.floors),
    floor_area: body.floor_area !== undefined ? toFloat(body.floor_area) : toFloat(n.floor_area ?? e.floor_area),
    estimated_budget: body.estimated_budget !== undefined
      ? toBigIntValue(body.estimated_budget)
      : toBigIntValue(n.estimated_budget ?? n.budget_min ?? e.estimated_budget ?? e.budget_min),
    notes: body.notes ? String(body.notes) : (snapshot.note || null),
    stage: body.stage ? String(body.stage).trim() : null,
    start_date: body.start_date ? new Date(body.start_date) : null,
    expected_end_date: body.expected_end_date ? new Date(body.expected_end_date) : null,
  }

  const requestedStatus = String(body.status || 'draft').trim()
  const status = requestedStatus || 'draft'

  if (status === 'confirmed') {
    const manageAuth = await requirePermission(PERMISSIONS.customersManage)
    if (manageAuth.error) {
      return NextResponse.json({ error: 'Khong co quyen convert sang confirmed' }, { status: 403 })
    }
  }

  const result = await db.$transaction(async (tx) => {
    const project = await tx.constructionProject.create({
      data: {
        customer_id: params.id,
        project_name: payload.project_name,
        address: payload.address,
        house_type: payload.house_type,
        floors: payload.floors,
        floor_area: payload.floor_area,
        estimated_budget: payload.estimated_budget,
        notes: payload.notes,
        status,
        stage: payload.stage,
        start_date: payload.start_date,
        expected_end_date: payload.expected_end_date,
        source: 'ai_merge',
        extraction_quality: computeExtractionQuality(snapshot.confidence_score),
        ...(status === 'confirmed'
          ? { confirmed_at: new Date(), confirmed_by: session.user.id }
          : {}),
      },
    })

    const updatedSnapshot = await (tx as any).projectRequirementSnapshot.update({
      where: { id: params.snapshotId },
      data: {
        status: 'converted',
        converted_project_id: project.id,
        approved_by: snapshot.approved_by || session.user.id,
        approved_at: snapshot.approved_at || new Date(),
      },
    })

    await tx.customerTimeline.create({
      data: {
        customer_id: params.id,
        type: 'project_created',
        title: 'Tao du an tu requirement snapshot',
        description: `Snapshot v${snapshot.version_no} -> Project ${project.id}`,
        happened_at: new Date(),
        created_by: session.user.id,
        metadata: {
          snapshot_id: snapshot.id,
          snapshot_version: snapshot.version_no,
          converted_project_id: project.id,
          source_type: snapshot.source_type,
        },
      },
    })

    return { project, snapshot: updatedSnapshot }
  })

  await createCareActivitySafe({
    customer_id: params.id,
    activity_type: 'note',
    summary: `Convert snapshot v${snapshot.version_no} thanh du an`,
    detail: `Project: ${result.project.id}`,
    source_ref_type: 'project_requirement_snapshot',
    source_ref_id: snapshot.id,
    channel: 'other',
    created_by: session.user.id,
    metadata_json: {
      snapshot_id: snapshot.id,
      snapshot_version: snapshot.version_no,
      converted_project_id: result.project.id,
      source_type: snapshot.source_type,
    },
  })

  return NextResponse.json({
    data: {
      project: result.project,
      snapshot: result.snapshot,
    },
  }, { status: 201 })
}
