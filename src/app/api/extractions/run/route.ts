import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runExtractionProfiles } from '@/lib/analysis/extractor'
import type { AnalysisProfileKey } from '@/lib/analysis/profiles'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  const profiles = normalizeProfiles(body?.profiles)
  const mode = body?.mode === 'incremental' ? 'incremental' : 'full'

  try {
    const data = await runExtractionProfiles({
      profiles,
      auto_detect: body?.auto_detect !== false,
      text: body?.text,
      source_type: body?.source_type,
      customer_id: body?.customer_id || null,
      conversation_id: body?.conversation_id || null,
      contact_log_id: body?.contact_log_id || null,
      mode,
      save_runs: body?.save_runs !== false,
      requested_by: session.user.id,
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Boc tach that bai' }, { status: 400 })
  }
}

function normalizeProfiles(input: unknown): AnalysisProfileKey[] | undefined {
  if (!Array.isArray(input)) return undefined
  const out = input
    .map((x) => String(x || '').trim())
    .filter((x) => x === 'crm_basic' || x === 'estimate_v1' || x === 'estimate_preliminary') as AnalysisProfileKey[]
  if (!out.length) return undefined
  return Array.from(new Set(out))
}
