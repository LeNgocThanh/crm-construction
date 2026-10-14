import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { ANALYSIS_PROFILE_SEEDS, AnalysisOutput, AnalysisProfileKey } from './profiles'

export async function ensureAnalysisProfiles() {
  for (const profile of ANALYSIS_PROFILE_SEEDS) {
    await db.analysisProfile.upsert({
      where: { key: profile.key },
      update: {
        name: profile.name,
        description: profile.description,
        required_fields: profile.required_fields,
        is_active: true,
      },
      create: {
        key: profile.key,
        name: profile.name,
        description: profile.description,
        required_fields: profile.required_fields,
        is_active: true,
      },
    })
  }
}

export async function saveAnalysisRun(params: {
  profileKey: AnalysisProfileKey
  sourceType: string
  inputText: string
  output: AnalysisOutput
  requestedBy?: string | null
  customerId?: string | null
  conversationId?: string | null
  contactLogId?: string | null
}) {
  const run = await db.analysisRun.create({
    data: {
      profile_key: params.profileKey,
      source_type: params.sourceType,
      status: params.output.missing_fields.length ? 'needs_data' : 'completed',
      input_text: params.inputText,
      summary: params.output.summary || null,
      confidence: params.output.confidence ?? null,
      missing_fields: params.output.missing_fields,
      result: {
        recommended_questions: params.output.recommended_questions,
      },
      requested_by: params.requestedBy || null,
      customer_id: params.customerId || null,
      conversation_id: params.conversationId || null,
      contact_log_id: params.contactLogId || null,
    },
  })

  if (params.output.facts.length) {
    await db.analysisFact.createMany({
      data: params.output.facts.map((fact) => ({
        run_id: run.id,
        customer_id: params.customerId || null,
        fact_key: fact.key,
        fact_value: normalizeJsonValue(fact.value),
        normalized_text: normalizeText(fact.value),
        confidence: fact.confidence ?? null,
        source_type: params.sourceType,
      })),
    })
  }

  return run
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function normalizeJsonValue(value: unknown) {
  if (value === undefined || value === null) return Prisma.JsonNull
  return value as Prisma.InputJsonValue
}
