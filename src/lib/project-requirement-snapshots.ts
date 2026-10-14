import { db } from '@/lib/db'

type CreateRequirementSnapshotInput = {
  customer_id: string
  source_type: string
  source_ref_id?: string | null
  extracted_json?: any
  normalized_json?: any
  confidence_score?: number | null
  note?: string | null
  created_by?: string | null
}

export async function createRequirementSnapshot(input: CreateRequirementSnapshotInput) {
  return db.$transaction(async (tx) => {
    const latest = await (tx as any).projectRequirementSnapshot.findFirst({
      where: { customer_id: input.customer_id },
      orderBy: [{ version_no: 'desc' }],
      select: { version_no: true },
    })

    const nextVersion = (latest?.version_no || 0) + 1

    await (tx as any).projectRequirementSnapshot.updateMany({
      where: { customer_id: input.customer_id, is_current: true },
      data: { is_current: false },
    })

    return (tx as any).projectRequirementSnapshot.create({
      data: {
        customer_id: input.customer_id,
        source_type: input.source_type,
        source_ref_id: input.source_ref_id || null,
        version_no: nextVersion,
        is_current: true,
        status: 'new',
        extracted_json: input.extracted_json ?? null,
        normalized_json: input.normalized_json ?? null,
        confidence_score: input.confidence_score ?? null,
        note: input.note || null,
        created_by: input.created_by || null,
      },
    })
  })
}

export async function createRequirementSnapshotSafe(input: CreateRequirementSnapshotInput) {
  try {
    await createRequirementSnapshot(input)
  } catch (err) {
    console.error('[REQUIREMENT_SNAPSHOT] create failed:', err)
  }
}

