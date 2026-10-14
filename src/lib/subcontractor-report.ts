import { db } from '@/lib/db'

export type SubcontractorReportRow = {
  id: string
  supplier_code: string
  supplier_name: string
  is_active: boolean
  active_plan_count: number
  open_issue_count: number
  overdue_issue_count: number
  high_severity_issue_count: number
  project_count: number
  projects: Array<{ id: string; project_name: string }>
  latest_open_issues: Array<{
    id: string
    issue_code: string
    title: string
    severity: string
    status: string
    due_at?: string | null
    project_id: string
    project_name: string
  }>
  last_issue_at?: string | null
}

export type SubcontractorReportSummary = {
  subcontractor_count: number
  active_subcontractor_count: number
  active_plan_count: number
  open_issue_count: number
  overdue_issue_count: number
  high_severity_issue_count: number
}

export type SubcontractorReportFilters = {
  q?: string
  status_filter?: 'all' | 'active' | 'inactive'
  issue_filter?: 'all' | 'open' | 'overdue' | 'high'
  sort_by?: 'name_asc' | 'overdue_desc' | 'open_desc' | 'project_desc'
}

function sortRows(rows: SubcontractorReportRow[], sortBy: string) {
  const list = [...rows]
  if (sortBy === 'overdue_desc') {
    return list.sort((a, b) => {
      if (b.overdue_issue_count !== a.overdue_issue_count) return b.overdue_issue_count - a.overdue_issue_count
      if (b.open_issue_count !== a.open_issue_count) return b.open_issue_count - a.open_issue_count
      return a.supplier_name.localeCompare(b.supplier_name, 'vi')
    })
  }
  if (sortBy === 'open_desc') {
    return list.sort((a, b) => {
      if (b.open_issue_count !== a.open_issue_count) return b.open_issue_count - a.open_issue_count
      if (b.overdue_issue_count !== a.overdue_issue_count) return b.overdue_issue_count - a.overdue_issue_count
      return a.supplier_name.localeCompare(b.supplier_name, 'vi')
    })
  }
  if (sortBy === 'project_desc') {
    return list.sort((a, b) => {
      if (b.project_count !== a.project_count) return b.project_count - a.project_count
      return a.supplier_name.localeCompare(b.supplier_name, 'vi')
    })
  }
  return list.sort((a, b) => a.supplier_name.localeCompare(b.supplier_name, 'vi'))
}

export async function getSubcontractorReport(filters: SubcontractorReportFilters = {}) {
  const rows = await (db as any).supplier.findMany({
    where: {
      profile: { is: { supplier_type: 'contractor' } },
    },
    orderBy: [{ is_active: 'desc' }, { supplier_name: 'asc' }],
    select: {
      id: true,
      supplier_code: true,
      supplier_name: true,
      is_active: true,
      subcontracted_resource_plans: {
        where: {
          is_active: true,
        },
        select: {
          id: true,
          status: true,
          project_id: true,
          project: { select: { id: true, project_name: true } },
        },
      },
      subcontracted_site_issues: {
        where: {
          status: { notIn: ['cancelled', 'verified'] },
        },
        select: {
          id: true,
          issue_code: true,
          title: true,
          severity: true,
          status: true,
          due_at: true,
          updated_at: true,
          project_id: true,
          project: { select: { id: true, project_name: true } },
        },
      },
    },
  })

  const now = Date.now()
  const data: SubcontractorReportRow[] = rows.map((row: any) => {
    const activePlans = Array.isArray(row.subcontracted_resource_plans) ? row.subcontracted_resource_plans : []
    const openIssues = Array.isArray(row.subcontracted_site_issues) ? row.subcontracted_site_issues : []
    const projectMap = new Map<string, { id: string; project_name: string }>()

    for (const item of activePlans) {
      if (item?.project?.id) projectMap.set(String(item.project.id), { id: String(item.project.id), project_name: String(item.project.project_name || '') })
    }
    for (const item of openIssues) {
      if (item?.project?.id) projectMap.set(String(item.project.id), { id: String(item.project.id), project_name: String(item.project.project_name || '') })
    }

    const overdueIssues = openIssues.filter((item: any) => item?.due_at && new Date(item.due_at).getTime() < now)
    const highSeverityIssues = openIssues.filter((item: any) => ['high', 'critical'].includes(String(item?.severity || '')))
    const lastIssueAt = openIssues.reduce((acc: number, item: any) => {
      const time = item?.updated_at ? new Date(item.updated_at).getTime() : 0
      return time > acc ? time : acc
    }, 0)

    return {
      id: row.id,
      supplier_code: row.supplier_code,
      supplier_name: row.supplier_name,
      is_active: !!row.is_active,
      active_plan_count: activePlans.length,
      open_issue_count: openIssues.length,
      overdue_issue_count: overdueIssues.length,
      high_severity_issue_count: highSeverityIssues.length,
      project_count: projectMap.size,
      projects: Array.from(projectMap.values()),
      latest_open_issues: openIssues
        .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5)
        .map((item: any) => ({
          id: item.id,
          issue_code: item.issue_code,
          title: item.title,
          severity: item.severity,
          status: item.status,
          due_at: item.due_at,
          project_id: item.project_id,
          project_name: item.project?.project_name || '',
        })),
      last_issue_at: lastIssueAt ? new Date(lastIssueAt).toISOString() : null,
    }
  })

  const q = String(filters.q || '').trim().toLowerCase()
  const statusFilter = String(filters.status_filter || 'all')
  const issueFilter = String(filters.issue_filter || 'all')
  const sortBy = String(filters.sort_by || 'overdue_desc')

  const filtered = data.filter((row) => {
    if (statusFilter === 'active' && !row.is_active) return false
    if (statusFilter === 'inactive' && row.is_active) return false
    if (issueFilter === 'open' && row.open_issue_count <= 0) return false
    if (issueFilter === 'overdue' && row.overdue_issue_count <= 0) return false
    if (issueFilter === 'high' && row.high_severity_issue_count <= 0) return false
    if (!q) return true
    return [row.supplier_name, row.supplier_code, ...row.projects.map((x) => x.project_name)].join(' ').toLowerCase().includes(q)
  })

  const sorted = sortRows(filtered, sortBy)
  const summary: SubcontractorReportSummary = {
    subcontractor_count: sorted.length,
    active_subcontractor_count: sorted.filter((item) => item.is_active).length,
    active_plan_count: sorted.reduce((sum, item) => sum + item.active_plan_count, 0),
    open_issue_count: sorted.reduce((sum, item) => sum + item.open_issue_count, 0),
    overdue_issue_count: sorted.reduce((sum, item) => sum + item.overdue_issue_count, 0),
    high_severity_issue_count: sorted.reduce((sum, item) => sum + item.high_severity_issue_count, 0),
  }

  return { data: sorted, summary }
}
