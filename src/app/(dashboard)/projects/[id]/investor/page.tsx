'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '-'
  return Number(n).toLocaleString('vi-VN') + ' vnd'
}

export default function ProjectInvestorEntryPage() {
  const params = useParams<{ id: string }>()
  const id = String(params?.id || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<any>(null)

  async function load() {
    if (!id) return
    setLoading(true)
    setError('')
    const res = await fetch(`/api/projects/${id}/investor-view`, { cache: 'no-store' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(String(j?.error || 'Không tải được dữ liệu dự án'))
      setLoading(false)
      return
    }
    setData(j?.data || null)
    setLoading(false)
  }

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) return <div style={{ padding: 16 }}>Đang tải dữ liệu...</div>
  if (error) return <div style={{ padding: 16, color: 'var(--red)' }}>{error}</div>

  const ov = data?.overview || {}
  const resources = data?.resources || {}
  const plans = Array.isArray(resources?.plans) ? resources.plans : []

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)' }}>PROJECT INVESTOR</div>
        <h1 style={{ margin: '4px 0 2px', fontSize: 22, fontWeight: 800 }}>{ov.project_name || 'Dự án'}</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          {ov.customer?.full_name || '-'} | {ov.customer?.phone_number || '-'} | {ov.status || '-'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Link href={`/projects/${id}/overview`} className="card" style={{ padding: 14, textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Tổng quan + Timeline</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Xem tổng quan dự án, thanh toán, timeline và kế hoạch ở chế độ chỉ đọc.
          </div>
        </Link>

        <Link href={`/projects/${id}/operations`} className="card" style={{ padding: 14, textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Vận hành dự án</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Tạo action kho từ kế hoạch đã duyệt, sinh phiếu xuất kho hoặc nhập lại khi cần.
          </div>
        </Link>
      </div>
      <div style={{ marginTop: 12 }}>
        <Link href={`/projects/${id}/planning`} className="card" style={{ padding: 14, textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Lập kế hoạch (CRUD)</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Tạo, sửa, xóa mốc dự án, kế hoạch thu, giao dịch thu, tài liệu và kế hoạch vật tư/nhân công.
          </div>
        </Link>
      </div>

      <div className="card" style={{ padding: 12, marginTop: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Tóm tắt nhanh</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(170px, 1fr))', gap: 8 }}>
          <div>Loại nhà: <b>{ov.house_type || '-'}</b></div>
          <div>Diện tích: <b>{ov.floor_area ?? '-'} m2</b></div>
          <div>Ngân sách: <b>{fmtMoney(ov.estimated_budget)}</b></div>
          <div>Số kế hoạch: <b>{plans.length}</b></div>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <Link href="/projects" className="btn-ghost">Về danh sách dự án</Link>
      </div>
    </div>
  )
}
