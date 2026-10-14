'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

function fmtDate(s?: string | null) {
  if (!s) return '-'
  return new Date(s).toLocaleString('vi-VN')
}

export default function ProjectDiaryManagerPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/projects/diary/manager-report', { cache: 'no-store' })
    const j = await res.json().catch(() => ({}))
    setRows(Array.isArray(j?.data) ? j.data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const viewRows = useMemo(() => rows.filter((r) => {
    if (filter === 'all') return true
    if (filter === 'no_recent') return !r.has_recent_diary
    if (filter === 'stalled') return !!r.progress_stalled
    if (filter === 'quality') return !!r.repeated_quality_blocked
    if (filter === 'safety') return !!r.repeated_safety_incident
    return true
  }), [rows, filter])

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)' }}>PROJECTS / MANAGER</div>
          <h1 style={{ margin: '4px 0 2px', fontSize: 22, fontWeight: 800 }}>Giám sát nhật ký đa dự án</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Tất cả</option>
            <option value="no_recent">3 ngày chưa có nhật ký</option>
            <option value="stalled">Tiến độ đứng yên</option>
            <option value="quality">Lặp lỗi chất lượng</option>
            <option value="safety">Lặp sự cố an toàn</option>
          </select>
          <Link className="btn-ghost" href="/projects">Về dự án</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        {loading ? <div>Đang tải...</div> : null}
        <div style={{ maxHeight: 520, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {viewRows.map((r) => (
            <div key={r.id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{r.project_name || r.id}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {r.customer_name || '-'} | {r.customer_phone || '-'} | Trạng thái: {r.status || '-'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    Nhật ký mới nhất: {fmtDate(r.latest_diary_at)} | Lũy kế: {r.latest_progress_total ?? '-'}%
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  {!r.has_recent_diary ? <span style={{ fontSize: 10, color: 'var(--red)' }}>Chưa có nhật ký 3 ngày</span> : null}
                  {r.progress_stalled ? <span style={{ fontSize: 10, color: 'var(--orange)' }}>Tiến độ đứng yên</span> : null}
                  {r.repeated_quality_blocked ? <span style={{ fontSize: 10, color: 'var(--red)' }}>Lặp blocked chất lượng</span> : null}
                  {r.repeated_safety_incident ? <span style={{ fontSize: 10, color: 'var(--red)' }}>Lặp incident an toàn</span> : null}
                </div>
              </div>
              <div style={{ marginTop: 6 }}>
                <Link className="btn-ghost" href={`/projects/${r.id}/diary`}>Mở nhật ký</Link>
                <span style={{ display: 'inline-block', width: 6 }} />
                <Link className="btn-ghost" href={`/projects/${r.id}/diary/report`}>Mở báo cáo</Link>
              </div>
            </div>
          ))}
          {!loading && !viewRows.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Không có dữ liệu phù hợp.</div> : null}
        </div>
      </div>
    </div>
  )
}
