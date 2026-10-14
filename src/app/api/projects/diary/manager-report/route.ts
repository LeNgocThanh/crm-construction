import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

export async function GET(_: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const now = new Date()
  const threeDaysAgo = new Date(now)
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const projects = await (db as any).constructionProject.findMany({
    select: {
      id: true,
      project_name: true,
      status: true,
      updated_at: true,
      customer: { select: { full_name: true, phone_number: true } },
      diary_entries: {
        where: { entry_date: { gte: sevenDaysAgo } },
        orderBy: [{ entry_date: 'desc' }, { created_at: 'desc' }],
        take: 20,
        select: {
          id: true,
          entry_date: true,
          progress_percent_total: true,
          quality_status: true,
          safety_status: true,
          next_plan: true,
          material_in_summary: true,
          material_out_summary: true,
        },
      },
    },
    take: 300,
  })

  const rows = projects.map((p: any) => {
    const diaries = Array.isArray(p.diary_entries) ? p.diary_entries : []
    const latest = diaries[0] || null
    const hasRecentDiary = latest ? new Date(latest.entry_date) >= threeDaysAgo : false
    const progressVals = diaries
      .map((d: any) => (d.progress_percent_total != null ? Number(d.progress_percent_total) : null))
      .filter((x: any) => x != null)
    const progressStalled = progressVals.length >= 2 && progressVals.every((x: any) => x === progressVals[0])
    const repeatedSafetyIncident = diaries.filter((d: any) => String(d.safety_status || '').toLowerCase() === 'incident').length >= 2
    const repeatedQualityBlocked = diaries.filter((d: any) => String(d.quality_status || '').toLowerCase() === 'blocked').length >= 2
    return {
      id: p.id,
      project_name: p.project_name || null,
      customer_name: p.customer?.full_name || null,
      customer_phone: p.customer?.phone_number || null,
      status: p.status,
      latest_diary_at: latest?.entry_date || null,
      latest_progress_total: latest?.progress_percent_total ?? null,
      has_recent_diary: hasRecentDiary,
      progress_stalled: progressStalled,
      repeated_safety_incident: repeatedSafetyIncident,
      repeated_quality_blocked: repeatedQualityBlocked,
      missing_required_data: false,
    }
  })

  return NextResponse.json({ data: rows })
}
