import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/authz'
import { runSlaEscalationPass } from '@/lib/sla/service'

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const key = String(url.searchParams.get('key') || '').trim()
  const cronSecret = String(process.env.CRON_SECRET || 'crm-cron-2026')

  let allowed = false
  if (key && key === cronSecret) {
    allowed = true
  } else {
    const auth = await requireRoles(['admin', 'manager'])
    if (!auth.error) allowed = true
  }
  if (!allowed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const limit = Number(body?.limit || 400)
  const result = await runSlaEscalationPass({ limit })

  return NextResponse.json({ ok: true, data: result })
}
