import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { db } from '@/lib/db'

function toDate(v: string | null, fallback: Date) {
  if (!v) return fallback
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? fallback : d
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(PERMISSIONS.projectsRead)
  if (auth.error) return auth.error
  const session: any = auth.ctx!.session

  const projectId = String(params.id || '').trim()
  if (!projectId) return NextResponse.json({ error: 'project_id_required' }, { status: 400 })

  const sp = new URL(req.url).searchParams
  const period = String(sp.get('period') || 'week').trim() // week | month | custom
  const now = new Date()
  const defaultFrom = new Date(now)
  defaultFrom.setDate(defaultFrom.getDate() - (period === 'month' ? 30 : 7))
  const from = toDate(sp.get('from'), defaultFrom)
  const to = toDate(sp.get('to'), now)
  to.setHours(23, 59, 59, 999)

  const rows = await (db as any).projectDiaryEntry.findMany({
    where: { project_id: projectId, entry_date: { gte: from, lte: to } },
    orderBy: [{ entry_date: 'asc' }, { created_at: 'asc' }],
    include: {
      creator: { select: { id: true, username: true } },
      media: { orderBy: { sort_order: 'asc' } },
      events: { orderBy: { created_at: 'asc' } },
    },
  })
  const milestones = await (db as any).projectMilestone.findMany({
    where: { project_id: projectId, is_active: true },
    orderBy: [{ sort_order: 'asc' }, { due_date: 'asc' }],
    select: { id: true, milestone_name: true, status_key: true, due_date: true, completed_at: true },
  })

  const entriesCount = rows.length
  const daysWithEntry = new Set(rows.map((r: any) => new Date(r.entry_date).toISOString().slice(0, 10))).size
  const avgDayProgress = entriesCount ? rows.reduce((s: number, r: any) => s + Number(r.progress_percent_day || 0), 0) / entriesCount : 0
  const latest = rows.length ? rows[rows.length - 1] : null
  const latestTotalProgress = latest?.progress_percent_total != null ? Number(latest.progress_percent_total) : null

  let qualityIssueCount = 0
  let safetyIssueCount = 0
  let eventIssueCount = 0
  const mediaByCategory: Record<string, number> = {}
  const daily: any[] = []
  const issueTop: { title: string; severity: string; date: string }[] = []
  const highlightsByDay: Record<string, any[]> = {}
  const timelineProgress: { date: string; progress_total: number | null; progress_day: number | null }[] = []

  for (const r of rows) {
    const qualityStatus = String(r.quality_status || 'ok').toLowerCase()
    const safetyStatus = String(r.safety_status || 'ok').toLowerCase()
    if (qualityStatus === 'blocked') {
      qualityIssueCount += 1
      issueTop.push({
        title: `Chất lượng bị chặn: ${String(r.title || 'Nhật ký')}`,
        severity: 'blocked',
        date: new Date(r.entry_date).toISOString().slice(0, 10),
      })
    }
    if (safetyStatus === 'incident') {
      safetyIssueCount += 1
      issueTop.push({
        title: `Sự cố an toàn: ${String(r.title || 'Nhật ký')}`,
        severity: 'incident',
        date: new Date(r.entry_date).toISOString().slice(0, 10),
      })
    }

    for (const m of r.media || []) {
      const cat = String(m?.metadata_json?.category || 'other')
      mediaByCategory[cat] = (mediaByCategory[cat] || 0) + 1
      const day = new Date(r.entry_date).toISOString().slice(0, 10)
      if (!highlightsByDay[day]) highlightsByDay[day] = []
      if (highlightsByDay[day].length < 6) {
        highlightsByDay[day].push({
          id: m.id,
          file_url: m.file_url,
          file_type: m.file_type,
          caption: m.caption,
          is_before_after: !!m.is_before_after,
          pair_key: m.pair_key || null,
          category: m?.metadata_json?.category || 'other',
        })
      }
    }

    const evs = Array.isArray(r.events) ? r.events : []
    for (const e of evs) {
      const sev = String(e?.severity || '').toLowerCase()
      if (sev === 'high' || sev === 'critical') {
        eventIssueCount += 1
        issueTop.push({
          title: String(e?.title || 'Sự kiện'),
          severity: sev,
          date: new Date(r.entry_date).toISOString().slice(0, 10),
        })
      }
    }

    daily.push({
      id: r.id,
      date: new Date(r.entry_date).toISOString().slice(0, 10),
      title: r.title,
      shift_type: r.shift_type,
      progress_percent_day: r.progress_percent_day,
      progress_percent_total: r.progress_percent_total,
      quality_status: r.quality_status,
      safety_status: r.safety_status,
      creator: r.creator?.username || null,
      media_count: Array.isArray(r.media) ? r.media.length : 0,
      events_count: evs.length,
      summary: r.summary || null,
      next_plan: r.next_plan || null,
      issue_resolution: r?.metadata_json?.issue_resolution || null,
      issue_eta: r?.metadata_json?.issue_eta || null,
    })
    timelineProgress.push({
      date: new Date(r.entry_date).toISOString().slice(0, 10),
      progress_total: r.progress_percent_total != null ? Number(r.progress_percent_total) : null,
      progress_day: r.progress_percent_day != null ? Number(r.progress_percent_day) : null,
    })
  }
  const milestonesCompleted = milestones.filter((m: any) => String(m.status_key || '').toLowerCase() === 'completed').slice(-8)
  const milestonesUpcoming = milestones.filter((m: any) => String(m.status_key || '').toLowerCase() !== 'completed').slice(0, 8)

  return NextResponse.json({
    data: {
      project_id: projectId,
      from: from.toISOString(),
      to: to.toISOString(),
      period,
      summary: {
        entries_count: entriesCount,
        days_with_entry: daysWithEntry,
        avg_day_progress: Number(avgDayProgress.toFixed(2)),
        latest_total_progress: latestTotalProgress,
        quality_issue_count: qualityIssueCount,
        safety_issue_count: safetyIssueCount,
        event_issue_count: eventIssueCount,
      },
      media_by_category: mediaByCategory,
      highlights_by_day: highlightsByDay,
      issue_top: issueTop.slice(0, 20),
      timeline_progress: timelineProgress,
      milestones: {
        completed: milestonesCompleted,
        upcoming: milestonesUpcoming,
      },
      daily,
    },
  })
}
