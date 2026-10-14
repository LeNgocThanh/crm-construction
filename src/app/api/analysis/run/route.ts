import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolveInputContext, runExtractionProfiles } from '@/lib/analysis/extractor'
import { detectEstimateIntent, type AnalysisProfileKey } from '@/lib/analysis/profiles'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const {
    profile_key,
    auto_detect = true,
    text,
    source_type = 'text',
    customer_id,
    conversation_id,
    contact_log_id,
  } = body || {}

  const context = await resolveInputContext({
    text,
    source_type,
    customer_id: customer_id || null,
    conversation_id: conversation_id || null,
    contact_log_id: contact_log_id || null,
  })

  if (!context.inputText.trim()) {
    return NextResponse.json({ error: 'Chua co noi dung de phan tich' }, { status: 400 })
  }

  const selectedProfile = pickProfileKey({
    inputText: context.inputText,
    profileKey: profile_key,
    autoDetect: Boolean(auto_detect),
  })

  try {
    const out = await runExtractionProfiles({
      profiles: [selectedProfile],
      auto_detect: false,
      text: context.inputText,
      source_type: context.sourceType,
      customer_id: context.customerId,
      conversation_id: context.conversationId,
      contact_log_id: context.contactLogId,
      mode: body?.mode === 'incremental' ? 'incremental' : 'full',
      save_runs: true,
      requested_by: session.user.id,
    })

    const first = out.results[0]
    if (!first) {
      return NextResponse.json({ error: 'Khong co ket qua phan tich' }, { status: 400 })
    }

    return NextResponse.json({
      data: {
        run_id: first.run_id,
        profile_key: first.profile_key,
        status: first.status,
        customer_id: out.customer_id,
        summary: first.summary,
        confidence: first.confidence,
        facts: first.facts,
        missing_fields: first.missing_fields,
        recommended_questions: first.recommended_questions,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Phan tich that bai' }, { status: 500 })
  }
}

function pickProfileKey(params: {
  inputText: string
  profileKey?: string
  autoDetect: boolean
}): AnalysisProfileKey {
  if (
    params.profileKey === 'estimate_preliminary'
    || params.profileKey === 'estimate_v1'
    || params.profileKey === 'crm_basic'
  ) {
    return params.profileKey
  }

  if (params.autoDetect && detectEstimateIntent(params.inputText)) {
    return 'estimate_v1'
  }

  return 'crm_basic'
}
