import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/labor/server'
import { getLaborWorkerBalanceSummary } from '@/lib/labor/worker-balance'

function parseDate(value: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if ('error' in auth) return auth.error

  const sp = new URL(req.url).searchParams
  const projectId = String(sp.get('project_id') || '').trim()
  const workerId = String(sp.get('worker_id') || '').trim()
  const workerCategory = String(sp.get('worker_category') || '').trim()
  const from = parseDate(String(sp.get('from') || '').trim())
  const to = parseDate(String(sp.get('to') || '').trim())

  const data = await getLaborWorkerBalanceSummary({
    projectId: projectId || null,
    workerId: workerId || null,
    workerCategory: workerCategory || null,
    from,
    to,
  })

  return NextResponse.json({ data })
}
