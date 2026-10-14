import { db } from '@/lib/db'

type EvaluateInput = {
  projectId: string
  milestoneDefinitionId?: string | null
  milestoneKey?: string | null
  statusKey: string
}

export async function evaluateMilestoneWarningsFromRules(input: EvaluateInput): Promise<string[]> {
  const statusKey = String(input.statusKey || '').trim()
  if (!statusKey) return []

  const definitionId = String(input.milestoneDefinitionId || '').trim()
  const milestoneKey = String(input.milestoneKey || '').trim()
  if (!definitionId && !milestoneKey) return []

  const rules = await (db as any).projectMilestoneRule.findMany({
    where: {
      is_active: true,
      trigger_status_key: statusKey,
      OR: [
        ...(definitionId ? [{ milestone_definition_id: definitionId }] : []),
        ...(milestoneKey ? [{ milestone_key: milestoneKey }] : []),
      ],
    },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  })

  const warnings: string[] = []
  for (const rule of rules) {
    const checkType = String(rule?.check_type || '').trim()
    if (!checkType) continue

    if (checkType === 'require_contract_document') {
      const docType = String((rule?.check_params as any)?.document_type || 'contract').trim() || 'contract'
      const docCount = await db.projectDocument.count({
        where: {
          project_id: input.projectId,
          is_active: true,
          document_type: docType,
        },
      })
      if (docCount <= 0) warnings.push(String(rule?.warning_message || 'Can bo sung tai lieu hop dong'))
      continue
    }

    if (checkType === 'require_project_start_date') {
      const project = await db.constructionProject.findUnique({
        where: { id: input.projectId },
        select: { start_date: true },
      })
      if (!project?.start_date) warnings.push(String(rule?.warning_message || 'Can bo sung ngay khoi cong'))
      continue
    }
  }

  return warnings
}
