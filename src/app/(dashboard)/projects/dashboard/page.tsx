'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Project = {
  id: string
  project_name: string | null
  status: string
  contract_value: number | null
  estimated_budget: number | null
  expected_end_date: string | null
  labor_finance_summary?: {
    payable_amount: number
    cash_gap_for_payable: number
    warning_state: string
  } | null
}

type Stats = {
  total_contract_value: number
  total_estimated: number
  confirmed_count: number
  by_status: { status: string; count: number; value: number }[]
  by_type: { type: string; count: number; value: number }[]
  monthly_revenue: { month: string; value: number }[]
}

function fmtVnd(v: number) {
  return Number(v || 0).toLocaleString('vi-VN') + ' đ'
}

export default function ProjectDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats | null>(null)
  const [projects, setProjects] = useState<Project[]>([])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/projects?limit=500&stats=1')
    const j = await res.json().catch(() => ({}))
    setStats(j?.stats || null)
    setProjects(Array.isArray(j?.data) ? j.data : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const overdueCount = useMemo(() => {
    const now = new Date()
    return projects.filter((p) => p.expected_end_date && new Date(p.expected_end_date) < now && !['completed', 'cancelled', 'draft'].includes(String(p.status))).length
  }, [projects])
  const topLaborPayableProjects = useMemo(() => {
    return [...projects]
      .filter((p) => Number(p.labor_finance_summary?.payable_amount || 0) > 0)
      .sort((a, b) => Number(b.labor_finance_summary?.payable_amount || 0) - Number(a.labor_finance_summary?.payable_amount || 0))
      .slice(0, 5)
  }, [projects])

  function laborWarningLabel(state?: string | null) {
    switch (state) {
      case 'missing': return 'Thiếu tiền trả công'
      case 'tight': return 'Sắp thiếu'
      default: return 'Đủ tiền'
    }
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>DỰ ÁN</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Dashboard dự án</h1>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <Link className="btn-ghost" href="/projects">Danh sách dự án</Link>
          <Link className="btn-ghost" href="/projects/diary-manager">Giám sát nhật ký</Link>
        </div>
      </div>

      {loading ? <div className="card" style={{ padding: 20 }}>Đang tải...</div> : null}

      {stats ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10, marginBottom: 12 }}>
            <div className="card" style={{ padding: 12 }}><div style={{ fontSize: 11, color: 'var(--text3)' }}>Tổng giá trị HĐ</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmtVnd(stats.total_contract_value || 0)}</div></div>
            <div className="card" style={{ padding: 12 }}><div style={{ fontSize: 11, color: 'var(--text3)' }}>Tổng dự toán</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmtVnd(stats.total_estimated || 0)}</div></div>
            <div className="card" style={{ padding: 12 }}><div style={{ fontSize: 11, color: 'var(--text3)' }}>Dự án đã xác nhận</div><div style={{ fontSize: 18, fontWeight: 800 }}>{stats.confirmed_count || 0}</div></div>
            <div className="card" style={{ padding: 12 }}><div style={{ fontSize: 11, color: 'var(--text3)' }}>Dự án trễ tiến độ</div><div style={{ fontSize: 18, fontWeight: 800, color: overdueCount > 0 ? 'var(--red)' : 'var(--text)' }}>{overdueCount}</div></div>
          </div>

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Theo trạng thái</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
              {stats.by_status.map((s) => (
                <div key={s.status} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                  <div style={{ fontSize: 12 }}>{s.status}</div>
                  <div style={{ fontWeight: 700 }}>{s.count} dự án</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtVnd(s.value || 0)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700 }}>Dự án đang nợ công nhiều nhất</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  Theo dõi công trình còn phải trả nhân công để ưu tiên xử lý dòng tiền.
                </div>
              </div>
              <Link className="btn-ghost" href="/labor/payments">Mở thanh toán công</Link>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {topLaborPayableProjects.map((project) => (
                <div key={project.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{project.project_name || '(Khong ten du an)'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                        Con phai tra: <b>{fmtVnd(Number(project.labor_finance_summary?.payable_amount || 0))}</b>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                        Chenh lech tien tra cong: <b style={{ color: Number(project.labor_finance_summary?.cash_gap_for_payable || 0) < 0 ? 'var(--red)' : 'var(--green)' }}>
                          {Number(project.labor_finance_summary?.cash_gap_for_payable || 0).toLocaleString('vi-VN')} đ
                        </b>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 999,
                        border: '1px solid var(--border2)',
                        color:
                          project.labor_finance_summary?.warning_state === 'missing'
                            ? 'var(--red)'
                            : project.labor_finance_summary?.warning_state === 'tight'
                              ? 'var(--orange)'
                              : 'var(--green)',
                      }}>
                        {laborWarningLabel(project.labor_finance_summary?.warning_state)}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <Link className="btn-ghost" href={`/projects/${project.id}/overview`}>Overview</Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {!topLaborPayableProjects.length ? (
                <div style={{ padding: 12, color: 'var(--text3)' }}>Chưa có dự án nào phát sinh nợ công cần theo dõi.</div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
