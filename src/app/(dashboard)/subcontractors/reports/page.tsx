'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type ReportRow = {
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

type ReportSummary = {
  subcontractor_count: number
  active_subcontractor_count: number
  active_plan_count: number
  open_issue_count: number
  overdue_issue_count: number
  high_severity_issue_count: number
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('vi-VN')
}

function buildQueryString(params: Record<string, string>) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (String(value || '').trim()) searchParams.set(key, value)
  })
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

function buildBadgeTone(row: ReportRow) {
  if (row.overdue_issue_count > 0) {
    return { label: 'Cần xử lý gấp', color: '#fecaca', background: 'rgba(239,68,68,0.16)', border: 'rgba(239,68,68,0.35)' }
  }
  if (row.high_severity_issue_count > 0) {
    return { label: 'Có việc mức cao', color: '#fed7aa', background: 'rgba(249,115,22,0.16)', border: 'rgba(249,115,22,0.35)' }
  }
  if (row.open_issue_count > 0) {
    return { label: 'Đang có việc mở', color: '#bfdbfe', background: 'rgba(59,130,246,0.16)', border: 'rgba(59,130,246,0.35)' }
  }
  return { label: 'Đang ổn định', color: '#bbf7d0', background: 'rgba(34,197,94,0.16)', border: 'rgba(34,197,94,0.35)' }
}

function sortRows(rows: ReportRow[], sortBy: string) {
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

export default function SubcontractorReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([])
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [issueFilter, setIssueFilter] = useState<'all' | 'open' | 'overdue' | 'high'>('all')
  const [sortBy, setSortBy] = useState<'name_asc' | 'overdue_desc' | 'open_desc' | 'project_desc'>('overdue_desc')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/subcontractors/report', { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      setRows(Array.isArray(json?.data) ? json.data : [])
      setSummary(json?.summary || null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = rows.filter((row) => {
      if (statusFilter === 'active' && !row.is_active) return false
      if (statusFilter === 'inactive' && row.is_active) return false
      if (issueFilter === 'open' && row.open_issue_count <= 0) return false
      if (issueFilter === 'overdue' && row.overdue_issue_count <= 0) return false
      if (issueFilter === 'high' && row.high_severity_issue_count <= 0) return false
      if (!q) return true
      return [row.supplier_name, row.supplier_code, ...row.projects.map((x) => x.project_name)].join(' ').toLowerCase().includes(q)
    })
    return sortRows(filtered, sortBy)
  }, [rows, query, statusFilter, issueFilter, sortBy])

  const currentQuery = buildQueryString({
    q: query,
    status_filter: statusFilter,
    issue_filter: issueFilter,
    sort_by: sortBy,
  })

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>THẦU PHỤ / BÁO CÁO</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Báo cáo thầu phụ</h1>
          <div style={{ color: 'var(--text3)', marginTop: 6 }}>
            Theo dõi thầu phụ nào đang ôm nhiều việc, quá hạn bao nhiêu và đang tham gia những dự án nào.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn" href="/subcontractors">Về danh mục thầu phụ</Link>
          <a className="btn" href={`/api/subcontractors/report/export${currentQuery}`}>Xuất Excel</a>
          <a className="btn" href={`/api/subcontractors/report/print${currentQuery}`} target="_blank" rel="noreferrer">In / PDF</a>
          <button className="btn btn-primary" type="button" onClick={load}>Tải lại báo cáo</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Số thầu phụ</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{summary?.subcontractor_count || 0}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Đang dùng: {summary?.active_subcontractor_count || 0}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Kế hoạch đang phụ trách</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{summary?.active_plan_count || 0}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Issue đang mở</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{summary?.open_issue_count || 0}</div>
        </div>
        <div className="card" style={{ borderColor: 'rgba(239,68,68,0.35)' }}>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Issue quá hạn</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: 'var(--red)' }}>{summary?.overdue_issue_count || 0}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Mức cao/nghiêm trọng: {summary?.high_severity_issue_count || 0}</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) 180px 220px 220px', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Tìm kiếm</div>
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tên thầu phụ, mã thầu phụ, tên dự án..." />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Trạng thái</div>
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}>
              <option value="all">Tất cả</option>
              <option value="active">Đang dùng</option>
              <option value="inactive">Ngừng dùng</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Lọc theo việc đang xử lý</div>
            <select className="select" value={issueFilter} onChange={(e) => setIssueFilter(e.target.value as 'all' | 'open' | 'overdue' | 'high')}>
              <option value="all">Tất cả</option>
              <option value="open">Có issue đang mở</option>
              <option value="overdue">Có issue quá hạn</option>
              <option value="high">Có issue mức cao / nghiêm trọng</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Sắp xếp</div>
            <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'name_asc' | 'overdue_desc' | 'open_desc' | 'project_desc')}>
              <option value="overdue_desc">Quá hạn nhiều nhất</option>
              <option value="open_desc">Issue mở nhiều nhất</option>
              <option value="project_desc">Tham gia nhiều dự án nhất</option>
              <option value="name_asc">Tên thầu phụ A-Z</option>
            </select>
          </div>
        </div>

        {loading ? <div style={{ color: 'var(--text3)' }}>Đang tải báo cáo...</div> : null}
        {!loading && !filteredRows.length ? <div style={{ color: 'var(--text3)' }}>Chưa có dữ liệu thầu phụ phù hợp bộ lọc.</div> : null}

        <div style={{ display: 'grid', gap: 12 }}>
          {filteredRows.map((row) => (
            <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 280 }}>
                  {(() => {
                    const tone = buildBadgeTone(row)
                    return (
                      <div style={{ marginBottom: 8 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            color: tone.color,
                            background: tone.background,
                            border: `1px solid ${tone.border}`,
                          }}
                        >
                          {tone.label}
                        </span>
                      </div>
                    )
                  })()}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{row.supplier_name}</div>
                    <span className="chip">{row.supplier_code}</span>
                    <span className="chip" style={{ color: row.is_active ? 'var(--green)' : 'var(--text3)' }}>
                      {row.is_active ? 'Đang dùng' : 'Ngừng dùng'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, fontSize: 13 }}>
                    <div>Kế hoạch đang phụ trách: <b>{row.active_plan_count}</b></div>
                    <div>Issue đang mở: <b style={{ color: row.open_issue_count ? 'var(--blue)' : 'var(--text)' }}>{row.open_issue_count}</b></div>
                    <div>Issue quá hạn: <b style={{ color: row.overdue_issue_count ? 'var(--red)' : 'var(--green)' }}>{row.overdue_issue_count}</b></div>
                    <div>Dự án tham gia: <b>{row.project_count}</b></div>
                    <div>Issue mức cao/nghiêm trọng: <b style={{ color: row.high_severity_issue_count ? 'var(--orange)' : 'var(--text)' }}>{row.high_severity_issue_count}</b></div>
                    <div>Cập nhật issue gần nhất: <b>{formatDate(row.last_issue_at)}</b></div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text2)' }}>
                    Dự án: {row.projects.length ? row.projects.map((project) => project.project_name || project.id).join(', ') : '-'}
                  </div>
                </div>

                <div style={{ minWidth: 320, flex: '0 1 420px' }}>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Issue đang mở gần nhất</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {row.latest_open_issues.length ? row.latest_open_issues.map((issue) => (
                      <div key={issue.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <Link href={`/projects/${issue.project_id}/site-issues/${issue.id}`} style={{ fontWeight: 700, color: 'var(--text)' }}>
                            {issue.issue_code}
                          </Link>
                          <span className="chip">{issue.project_name || 'Dự án'}</span>
                          <span className="chip" style={{ color: issue.severity === 'critical' ? 'var(--red)' : issue.severity === 'high' ? 'var(--orange)' : 'var(--text3)' }}>
                            {issue.severity}
                          </span>
                          <span className="chip">{issue.status}</span>
                        </div>
                        <div style={{ marginTop: 4, fontSize: 13 }}>{issue.title}</div>
                        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text3)' }}>
                          Hạn xử lý: {formatDate(issue.due_at)}
                        </div>
                      </div>
                    )) : (
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>Hiện chưa có issue đang mở.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
