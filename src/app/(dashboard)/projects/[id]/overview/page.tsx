'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  PROJECT_DOCUMENT_ACCESS_LEVEL_OPTIONS,
  PROJECT_DOCUMENT_SCOPE_OPTIONS,
  PROJECT_DOCUMENT_TYPE_OPTIONS,
  projectDocumentAccessLevelLabel,
  projectDocumentScopeLabel,
  projectDocumentTypeLabel,
} from '@/lib/projects/document-taxonomy'
import { getUserDisplayName } from '@/lib/user-display'

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '-'
  return Number(n).toLocaleString('vi-VN') + ' vnd'
}
function fmtDate(s?: string | null) {
  if (!s) return '-'
  return new Date(s).toLocaleString('vi-VN')
}
function fmtGapSigned(n: number | null | undefined) {
  const val = Number(n || 0)
  const sign = val >= 0 ? '+' : '-'
  return `${sign}${Math.abs(val).toLocaleString('vi-VN')} vnd`
}
function cashStateLabel(gap: number | null | undefined) {
  return Number(gap || 0) >= 0 ? 'Đủ vốn' : 'Thiếu vốn'
}

function milestoneStatusLabel(m: any) {
  return m?.status_ref?.status_name || m?.status_key || '-'
}

function milestoneStatusColor(statusKey?: string | null) {
  switch (String(statusKey || '')) {
    case 'in_progress': return 'var(--green)'
    case 'completed': return 'var(--blue)'
    case 'blocked': return 'var(--red)'
    case 'cancelled': return 'var(--text3)'
    default: return 'var(--orange)'
  }
}

function planRoleLabel(value?: string | null) {
  switch (String(value || 'primary')) {
    case 'backup': return 'Dự phòng'
    case 'supplement': return 'Bổ sung'
    default: return 'Chính'
  }
}

function planRoleColor(value?: string | null) {
  switch (String(value || 'primary')) {
    case 'backup': return 'var(--blue)'
    case 'supplement': return 'var(--orange)'
    default: return 'var(--green)'
  }
}

export default function ProjectOverviewPage() {
  const params = useParams<{ id: string }>()
  const id = String(params?.id || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<any>(null)
  const [timelineRows, setTimelineRows] = useState<any[]>([])
  const [siteIssueSummary, setSiteIssueSummary] = useState({
    open_count: 0,
    overdue_count: 0,
    waiting_verify_count: 0,
  })
  const [timelineMilestoneFilter, setTimelineMilestoneFilter] = useState('')
  const [timelineGroupFilter, setTimelineGroupFilter] = useState('')
  const [docScopeFilter, setDocScopeFilter] = useState('')
  const [docTypeFilter, setDocTypeFilter] = useState('')
  const [docAccessFilter, setDocAccessFilter] = useState('')
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [showSnapshotGuide, setShowSnapshotGuide] = useState(false)
  const [snapshotForm, setSnapshotForm] = useState({
    snapshot_type: 'month_end',
    period_key: new Date().toISOString().slice(0, 7),
    milestone_id: '',
    budget_current: '',
    budget_allocated: '',
    cost_committed: '',
    cost_actual: '',
    cash_on_hand: '',
    receivable_planned_30d: '',
    payable_planned_30d: '',
    progress_planned_percent: '',
    progress_actual_percent: '',
    delay_days: '',
    risk_level: '',
    note: '',
  })
  const [editingDocId, setEditingDocId] = useState('')
  const [docForm, setDocForm] = useState({
    title: '',
    file_url: '',
    file_name: '',
    document_scope: 'internal',
    document_type: 'other',
    access_level: 'team_only',
    note: '',
  })

  async function load() {
    if (!id) return
    setLoading(true)
    setError('')
    const timelineUrl = timelineMilestoneFilter
      ? `/api/projects/${id}/timeline?milestone_id=${encodeURIComponent(timelineMilestoneFilter)}`
      : `/api/projects/${id}/timeline`
    const [viewRes, timelineRes, siteIssuesRes] = await Promise.all([
      fetch(`/api/projects/${id}/investor-view`, { cache: 'no-store' }),
      fetch(timelineUrl, { cache: 'no-store' }),
      fetch(`/api/projects/${id}/site-issues?page=1&pageSize=1`, { cache: 'no-store' }),
    ])
    const [viewJson, timelineJson, siteIssuesJson] = await Promise.all([
      viewRes.json().catch(() => ({})),
      timelineRes.json().catch(() => ({})),
      siteIssuesRes.json().catch(() => ({})),
    ])
    if (!viewRes.ok) {
      setError(String(viewJson?.error || 'Không tải được dữ liệu dự án'))
      setLoading(false)
      return
    }
    setData(viewJson?.data || null)
    setTimelineRows(Array.isArray(timelineJson?.data) ? timelineJson.data : [])
    setSiteIssueSummary({
      open_count: Number(siteIssuesJson?.summary?.open_count || 0),
      overdue_count: Number(siteIssuesJson?.summary?.overdue_count || 0),
      waiting_verify_count: Number(siteIssuesJson?.summary?.waiting_verify_count || 0),
    })
    setLoading(false)
  }

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, timelineMilestoneFilter])

  const resourcePlans = useMemo(() => (Array.isArray(data?.resources?.plans) ? data.resources.plans : []), [data])
  const resourceItems = useMemo(() => (Array.isArray(data?.resources?.items) ? data.resources.items : []), [data])
  const milestones = useMemo(() => (Array.isArray(data?.milestones) ? data.milestones : []), [data])
  const executionAxis = data?.execution_axis || {}

  if (loading) return <div style={{ padding: 16 }}>Đang tải dữ liệu...</div>
  if (error) return <div style={{ padding: 16, color: 'var(--red)' }}>{error}</div>
  if (!data) return <div style={{ padding: 16 }}>Không có dữ liệu</div>

  const ov = data.overview || {}
  const pay = data.payments || {}
  const summary = pay.summary || {}
  const docs = Array.isArray(data.documents) ? data.documents : []
  const cashflowSnapshots = Array.isArray(data?.cashflow?.snapshots) ? data.cashflow.snapshots : []
  const projectAssets = Array.isArray(data?.assets) ? data.assets : []
  const laborFinance = ov?.labor_finance_summary || {}
  const filteredDocs = docs.filter((d: any) => {
    const okScope = !docScopeFilter || String(d?.document_scope || '') === docScopeFilter
    const okType = !docTypeFilter || String(d?.document_type || '') === docTypeFilter
    const okAccess = !docAccessFilter || String(d?.access_level || '') === docAccessFilter
    return okScope && okType && okAccess
  })
  const laborPaymentTimelineRows = timelineRows.filter((ev: any) => String(ev?.event_key || '').startsWith('labor_payment_batch_'))
  const filteredTimelineRows = timelineRows.filter((ev: any) => {
    const eventKey = String(ev?.event_key || '')
    if (!timelineGroupFilter) return true
    if (timelineGroupFilter === 'planning') return eventKey.startsWith('resource_plan_') || eventKey.startsWith('milestone_')
    if (timelineGroupFilter === 'materials') return eventKey.includes('inventory_') || eventKey.includes('direct_purchase') || eventKey === 'active_material_plan_changed'
    if (timelineGroupFilter === 'labor') return eventKey.startsWith('labor_') || eventKey === 'active_labor_plan_changed'
    return true
  })

  function resetDocForm() {
    setEditingDocId('')
    setDocForm({
      title: '',
      file_url: '',
      file_name: '',
      document_scope: 'internal',
      document_type: 'other',
      access_level: 'team_only',
      note: '',
    })
  }

  async function saveSnapshot() {
    setSavingSnapshot(true)
    const res = await fetch(`/api/projects/${id}/cashflow-snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auto_fill_from_payments: true,
        snapshot_type: snapshotForm.snapshot_type,
        period_key: snapshotForm.period_key || null,
        milestone_id: snapshotForm.milestone_id || null,
        budget_current: snapshotForm.budget_current || null,
        budget_allocated: snapshotForm.budget_allocated || null,
        cost_committed: snapshotForm.cost_committed || null,
        cost_actual: snapshotForm.cost_actual || null,
        cash_on_hand: snapshotForm.cash_on_hand || null,
        receivable_planned_30d: snapshotForm.receivable_planned_30d || null,
        payable_planned_30d: snapshotForm.payable_planned_30d || null,
        progress_planned_percent: snapshotForm.progress_planned_percent || null,
        progress_actual_percent: snapshotForm.progress_actual_percent || null,
        delay_days: snapshotForm.delay_days || null,
        risk_level: snapshotForm.risk_level || null,
        note: snapshotForm.note || null,
      }),
    })
    setSavingSnapshot(false)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(String(j?.error || 'Không lưu được snapshot'))
      return
    }
    setSnapshotForm({
      snapshot_type: 'month_end',
      period_key: new Date().toISOString().slice(0, 7),
      milestone_id: '',
      budget_current: '',
      budget_allocated: '',
      cost_committed: '',
      cost_actual: '',
      cash_on_hand: '',
      receivable_planned_30d: '',
      payable_planned_30d: '',
      progress_planned_percent: '',
      progress_actual_percent: '',
      delay_days: '',
      risk_level: '',
      note: '',
    })
    await load()
  }

  async function fillReceivableFromPayments() {
    const res = await fetch(`/api/projects/${id}/cashflow-snapshots?mode=suggest_from_payments`, { cache: 'no-store' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(String(j?.error || 'Không nạp được dự kiến thu từ thanh toán'))
      return
    }
    const val = j?.data?.receivable_planned_30d
    setSnapshotForm((p) => ({ ...p, receivable_planned_30d: val != null ? String(val) : '' }))
  }
  async function fillCostsFromOperations() {
    const res = await fetch(`/api/projects/${id}/cashflow-snapshots?mode=suggest_from_operations`, { cache: 'no-store' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(String(j?.error || 'Không nạp được chi phí từ vận hành'))
      return
    }
    setSnapshotForm((p) => ({
      ...p,
      cost_committed: j?.data?.cost_committed != null ? String(j.data.cost_committed) : p.cost_committed,
      cost_actual: j?.data?.cost_actual != null ? String(j.data.cost_actual) : p.cost_actual,
    }))
  }

  async function saveDocument() {
    if (!docForm.title.trim() || !docForm.file_url.trim()) {
      alert('Vui lòng nhập Tên tài liệu và URL file')
      return
    }
    const isEdit = !!editingDocId
    const url = isEdit ? `/api/projects/${id}/documents/${editingDocId}` : `/api/projects/${id}/documents`
    const res = await fetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: docForm.title.trim(),
        file_url: docForm.file_url.trim(),
        file_name: docForm.file_name.trim() || null,
        document_scope: docForm.document_scope,
        document_type: docForm.document_type,
        access_level: docForm.access_level,
        note: docForm.note.trim() || null,
      }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(String(j?.error || 'Không lưu được tài liệu'))
      return
    }
    await load()
    resetDocForm()
  }

  async function removeDocument(docId: string) {
    if (!confirm('Xóa tài liệu này?')) return
    const res = await fetch(`/api/projects/${id}/documents/${docId}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(String(j?.error || 'Không xóa được tài liệu'))
      return
    }
    if (editingDocId === docId) resetDocForm()
    await load()
  }

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)' }}>PROJECT OVERVIEW</div>
          <h1 style={{ margin: '4px 0 2px', fontSize: 22, fontWeight: 800 }}>{ov.project_name || 'Dự án'}</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {ov.customer?.full_name || '-'} | {ov.customer?.phone_number || '-'} | {ov.status || '-'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Link className="btn-ghost" href={`/projects/${id}/planning`}>Mở planning</Link>
          <Link className="btn-ghost" href={`/projects/${id}/operations`}>Mở vận hành</Link>
          <Link className="btn-ghost" href={`/projects/${id}/labor`}>Nhân công</Link>
          <Link className="btn-ghost" href={`/labor/payments?project_id=${id}`}>Thanh toán công</Link>
          <Link className="btn-ghost" href={`/projects/${id}/diary`}>Mở nhật ký</Link>
          <Link className="btn-ghost" href={`/projects/${id}/site-issues`}>Mở lỗi hiện trường</Link>
          <Link className="btn-ghost" href={`/projects/${id}/diary/report`}>Báo cáo nhật ký</Link>
          <Link className="btn-ghost" href="/projects">Về danh sách</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Tổng quan dự án</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 8 }}>
          <div>Loại nhà: <b>{ov.house_type || '-'}</b></div>
          <div>Diện tích sàn: <b>{ov.floor_area ?? '-'} m2</b></div>
          <div>Số tầng: <b>{ov.floors ?? '-'}</b></div>
          <div>Địa chỉ: <b>{ov.address || '-'}</b></div>
          <div>Khởi công: <b>{fmtDate(ov.start_date)}</b></div>
          <div>Dự kiến xong: <b>{fmtDate(ov.expected_end_date)}</b></div>
          <div>Ngân sách ước tính: <b>{fmtMoney(ov.estimated_budget)}</b></div>
          <div>Giá trị hợp đồng: <b>{fmtMoney(ov.contract_value)}</b></div>
          <div>Ngân sách gốc: <b>{fmtMoney(ov.budget_baseline)}</b></div>
          <div>Ngân sách hiện tại: <b>{fmtMoney(ov.budget_current)}</b></div>
          <div>Ngân sách phân bổ: <b>{fmtMoney(ov.budget_allocated)}</b></div>
          <div>Chi phí cam kết: <b>{fmtMoney(ov.cost_committed)}</b></div>
          <div>Chi phí thực tế: <b>{fmtMoney(ov.cost_actual)}</b></div>
          <div>Nguồn tiền hiện tại: <b>{fmtMoney(ov.cash_on_hand)}</b></div>
          <div>Dự kiến thu 30 ngày: <b>{fmtMoney(ov.receivable_planned_30d)}</b></div>
          <div>Dự kiến chi 30 ngày: <b>{fmtMoney(ov.payable_planned_30d)}</b></div>
          <div>Tiến độ kế hoạch: <b>{ov.progress_planned_percent ?? '-'}%</b></div>
          <div>Tiến độ thực tế: <b>{ov.progress_actual_percent ?? '-'}%</b></div>
          <div>Trễ tiến độ: <b>{ov.delay_days ?? 0} ngay</b></div>
          <div>Mức rủi ro: <b>{ov.risk_level || '-'}</b></div>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Trục điều hành dự án</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(180px, 1fr))', gap: 8, marginBottom: 8 }}>
          <div>Trạng thái hiện tại: <b>{executionAxis?.project_status || ov.status || '-'}</b></div>
          <div>Stage hiện tại: <b>{executionAxis?.current_stage || ov.stage || '-'}</b></div>
          <div>Stage đề xuất: <b>{executionAxis?.suggested_stage || '-'}</b></div>
          <div>Mốc đang chạy: <b>{executionAxis?.active_milestone?.milestone_name || '-'}</b></div>
          <div>Trạng thái mốc: <b style={{ color: milestoneStatusColor(executionAxis?.active_milestone?.status_key) }}>{milestoneStatusLabel(executionAxis?.active_milestone)}</b></div>
          <div>
            Kế hoạch vật tư đang vận hành:
            {' '}
            <b>{executionAxis?.active_material_plan?.plan_name || '-'}</b>
            {executionAxis?.active_material_plan?.plan_name ? (
              <span style={{ marginLeft: 6, fontSize: 11, color: planRoleColor(executionAxis?.active_material_plan?.plan_role), fontWeight: 700 }}>
                [{planRoleLabel(executionAxis?.active_material_plan?.plan_role)}]
              </span>
            ) : null}
          </div>
          <div>
            Kế hoạch nhân công đang vận hành:
            {' '}
            <b>{executionAxis?.active_labor_plan?.plan_name || '-'}</b>
            {executionAxis?.active_labor_plan?.plan_name ? (
              <span style={{ marginLeft: 6, fontSize: 11, color: planRoleColor(executionAxis?.active_labor_plan?.plan_role), fontWeight: 700 }}>
                [{planRoleLabel(executionAxis?.active_labor_plan?.plan_role)}]
              </span>
            ) : null}
          </div>
          <div>Số kế hoạch vật tư/nhân công: <b>{resourcePlans.length}</b></div>
          <div>Số dòng vật tư/nhân công: <b>{resourceItems.length}</b></div>
          <div>Cảnh báo trục: <b style={{ color: executionAxis?.warnings?.length ? 'var(--orange)' : 'var(--green)' }}>{executionAxis?.warnings?.length || 0}</b></div>
        </div>
        {Array.isArray(executionAxis?.warnings) && executionAxis.warnings.length ? (
          <div style={{ fontSize: 12, color: 'var(--orange)' }}>
            {executionAxis.warnings.join(' | ')}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Trục vận hành hiện tại đã xác định được mốc đang chạy và kế hoạch vận hành chính.
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Lỗi hiện trường / Punch list</div>
          <Link className="btn-ghost" href={`/projects/${id}/site-issues`}>Mở danh sách lỗi</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 8 }}>
          <div className="card" style={{ padding: 10, borderColor: 'rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Lỗi đang mở</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{siteIssueSummary.open_count}</div>
          </div>
          <div className="card" style={{ padding: 10, borderColor: 'rgba(255,120,80,0.35)', background: 'rgba(255,120,80,0.08)' }}>
            <div style={{ fontSize: 11, color: 'var(--orange)', marginBottom: 4 }}>Lỗi quá hạn</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--orange)' }}>{siteIssueSummary.overdue_count}</div>
          </div>
          <div className="card" style={{ padding: 10, borderColor: 'rgba(80,170,255,0.35)', background: 'rgba(80,170,255,0.08)' }}>
            <div style={{ fontSize: 11, color: 'var(--blue)', marginBottom: 4 }}>Chờ xác nhận</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue)' }}>{siteIssueSummary.waiting_verify_count}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Tiến độ dự án</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
          Số mốc tiến độ: <b style={{ color: 'var(--text)' }}>{milestones.length}</b>
        </div>
        <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {milestones.map((m: any) => (
            <div key={m.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{m.milestone_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    Hạn: {m?.due_date ? new Date(String(m.due_date)).toLocaleDateString('vi-VN') : '-'}
                    {m?.completed_at ? ` | Hoàn thành: ${new Date(String(m.completed_at)).toLocaleDateString('vi-VN')}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: milestoneStatusColor(m?.status_key), fontWeight: 700 }}>
                    {milestoneStatusLabel(m)}
                  </div>
                  {String(m?.status_key || '') === 'in_progress' ? (
                    <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 2 }}>Đang thực hiện</div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {!milestones.length ? (
            <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>
              Chưa có mốc tiến độ nào.
            </div>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Tài sản dự án</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
          Số tài sản đang gắn dự án: <b style={{ color: 'var(--text)' }}>{projectAssets.length}</b>
        </div>
        <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {projectAssets.map((a: any) => (
            <div key={a.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{a.asset_name} ({a.asset_code})</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    Loại: {a.asset_type_data?.type_name || a.asset_type || '-'} | Trạng thái: {a.status || '-'} | Tình trạng: {a.condition_status || '-'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    Người giữ: {a.current_holder ? getUserDisplayName(a.current_holder) : '-'} | Vị trí: {a.current_location || '-'}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {a.updated_at ? new Date(String(a.updated_at)).toLocaleString('vi-VN') : '-'}
                </div>
              </div>
            </div>
          ))}
          {!projectAssets.length ? (
            <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>
              Chưa có tài sản nào đang gắn với dự án này.
            </div>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Nhu cầu - Cung ứng - Chênh lệch tiền (30 ngày)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 8 }}>
          <div>Nhu cầu 30 ngày: <b>{fmtMoney(ov?.cashflow_summary?.demand_30d)}</b></div>
          <div>Cung ứng 30 ngày: <b>{fmtMoney(ov?.cashflow_summary?.supply_30d)}</b></div>
          <div>Chênh lệch: <b style={{ color: Number(ov?.cashflow_summary?.gap_30d || 0) < 0 ? 'var(--red)' : 'var(--green)' }}>{fmtGapSigned(ov?.cashflow_summary?.gap_30d)}</b></div>
          <div>Trạng thái vốn: <b style={{ color: Number(ov?.cashflow_summary?.gap_30d || 0) < 0 ? 'var(--red)' : 'var(--green)' }}>{cashStateLabel(ov?.cashflow_summary?.gap_30d)}</b></div>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Tài chính nhân công</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Theo dõi kế hoạch nhân công, chi phí công thực tế, đã chi và số tiền công còn phải trả.
            </div>
          </div>
          <Link className="btn-ghost" href={`/labor/payments?project_id=${id}`}>Mở thanh toán công</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 8, marginBottom: 8 }}>
          <div>Kế hoạch nhân công: <b>{fmtMoney(laborFinance.planned_cost)}</b></div>
          <div>Công thực tế đã ghi nhận: <b>{fmtMoney(laborFinance.actual_cost)}</b></div>
          <div>Đã chi nhân công: <b>{fmtMoney(laborFinance.paid_amount)}</b></div>
          <div>Còn phải trả: <b style={{ color: Number(laborFinance.payable_amount || 0) > 0 ? 'var(--orange)' : 'var(--green)' }}>{fmtMoney(laborFinance.payable_amount)}</b></div>
          <div>Tổng công kế hoạch: <b>{Number(laborFinance.planned_qty || 0).toLocaleString('vi-VN')}</b></div>
          <div>Tổng công thực tế: <b>{Number(laborFinance.actual_qty || 0).toLocaleString('vi-VN')}</b></div>
          <div>Lệch kế hoạch nhân công: <b style={{ color: Number(laborFinance.planned_gap_amount || 0) < 0 ? 'var(--red)' : 'var(--green)' }}>{fmtGapSigned(laborFinance.planned_gap_amount)}</b></div>
          <div>Dư tiền trả công hiện tại: <b style={{ color: Number(laborFinance.cash_gap_for_payable || 0) < 0 ? 'var(--red)' : 'var(--green)' }}>{fmtGapSigned(laborFinance.cash_gap_for_payable)}</b></div>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Timeline thanh toán công</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Theo dõi các mốc tạo đợt, duyệt đợt, đã chi và mở lại đợt thanh toán nhân công.
            </div>
          </div>
          <Link className="btn-ghost" href={`/labor/payments?project_id=${id}`}>Mở thanh toán công</Link>
        </div>
        <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {laborPaymentTimelineRows.map((ev: any) => (
            <div key={`labor_${ev.id}`} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{ev.title || ev.event_key}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtDate(ev.happened_at)} | {ev.actor ? getUserDisplayName(ev.actor) : '-'} | {ev.event_key || '-'}</div>
              {ev.description ? <div style={{ fontSize: 12, marginTop: 4 }}>{ev.description}</div> : null}
            </div>
          ))}
          {!laborPaymentTimelineRows.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Chưa có timeline thanh toán công.</div> : null}
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Cập nhật vận hành theo thời điểm (snapshot)</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Lưu một mốc theo tháng, theo sự kiện hoặc theo mốc tiến độ để theo dõi tình hình tài chính và vận hành.
          </div>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowSnapshotGuide((v) => !v)}>
            {showSnapshotGuide ? 'Ẩn hướng dẫn' : 'Hiện hướng dẫn'}
          </button>
        </div>
        {showSnapshotGuide ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 12, color: 'var(--text3)', lineHeight: 1.55 }}>
            <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Hướng dẫn sử dụng</div>
            <div>
              <b>Kiểu cập nhật:</b> chọn theo tháng nếu muốn chốt số liệu cuối tháng, theo thời điểm nếu muốn lưu một mốc bất kỳ, hoặc theo mốc tiến độ nếu muốn gắn với milestone của dự án.
            </div>
            <div>
              <b>Kỳ tháng / Mốc tiến độ:</b> chi nhap khi kieu cap nhat tuong ung. Neu khong dung thang hoac moc thi de trong.
            </div>
            <div>
              <b>Ngân sách hiện tại / ngân sách phân bổ / chi phí cam kết / chi phí thực tế / nguồn tiền hiện tại:</b> la cac so lieu tai thoi diem snapshot, dung de so sanh dung von, thieu von va muc da cam ket.
            </div>
            <div>
              <b>Dự kiến thu 30 ngày:</b> số tiền có thể thu về trong 30 ngày tới. Nút <b>Nạp từ thanh toán</b> sẽ tự lấy từ các payment plan chưa thu hết.
            </div>
            <div>
              <b>Chi phí cam kết / chi phí thực tế:</b> nút <b>Nạp từ vận hành</b> sẽ tự tổng hợp từ kế hoạch vật tư / nhân công đã duyệt, phiếu mua trực tiếp đã xác nhận, vật tư đã xuất dùng và công thực tế đã xác nhận.
            </div>
            <div>
              <b>Tiến độ kế hoạch / tiến độ thực tế / số ngày trễ / mức độ rủi ro:</b> dùng để lưu trạng thái vận hành tại mỗi mốc, không phải trạng thái chung của dự án.
            </div>
            <div>
              <b>Ghi chú:</b> dùng để ghi giải thích nguyên nhân snapshot, ví dụ chậm tiến độ, thay đổi ngân sách, hoặc điều chỉnh sau kiểm tra thực tế.
            </div>
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Kiểu cập nhật</div>
            <select className="select" value={snapshotForm.snapshot_type} onChange={(e) => setSnapshotForm((p) => ({ ...p, snapshot_type: e.target.value }))}>
              <option value="month_end">Theo tháng</option>
              <option value="event">Theo thời điểm</option>
              <option value="milestone">Theo mốc tien do</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Kỳ tháng (YYYY-MM)</div>
            <input className="input" value={snapshotForm.period_key} onChange={(e) => setSnapshotForm((p) => ({ ...p, period_key: e.target.value }))} disabled={snapshotForm.snapshot_type !== 'month_end'} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Mốc tiến độ</div>
            <select className="select" value={snapshotForm.milestone_id} onChange={(e) => setSnapshotForm((p) => ({ ...p, milestone_id: e.target.value }))} disabled={snapshotForm.snapshot_type !== 'milestone'}>
              <option value="">(Không chọn)</option>
              {milestones.map((m: any) => <option key={m.id} value={m.id}>{m.milestone_name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Lọc theo nhóm</div>
            <select className="select" value={timelineGroupFilter} onChange={(e) => setTimelineGroupFilter(e.target.value)}>
              <option value="">Tất cả nhóm</option>
              <option value="planning">Kế hoạch / tiến độ</option>
              <option value="materials">Vật tư / kho</option>
              <option value="labor">Nhân công / thanh toán công</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 8 }}>
          <div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Ngân sách hiện tại</div><input className="input" value={snapshotForm.budget_current} onChange={(e) => setSnapshotForm((p) => ({ ...p, budget_current: e.target.value }))} /></div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Ngân sách phân bổ</div><input className="input" value={snapshotForm.budget_allocated} onChange={(e) => setSnapshotForm((p) => ({ ...p, budget_allocated: e.target.value }))} /></div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>Chi phí cam kết</span>
              <button className="btn-ghost" style={{ fontSize: 10, padding: '2px 6px' }} onClick={fillCostsFromOperations}>Nạp từ vận hành</button>
            </div>
            <input className="input" value={snapshotForm.cost_committed} onChange={(e) => setSnapshotForm((p) => ({ ...p, cost_committed: e.target.value }))} />
          </div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Chi phí thực tế</div><input className="input" value={snapshotForm.cost_actual} onChange={(e) => setSnapshotForm((p) => ({ ...p, cost_actual: e.target.value }))} /></div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Nguồn tiền hiện tại</div><input className="input" value={snapshotForm.cash_on_hand} onChange={(e) => setSnapshotForm((p) => ({ ...p, cash_on_hand: e.target.value }))} /></div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>Dự kiến thu 30 ngày</span>
              <button className="btn-ghost" style={{ fontSize: 10, padding: '2px 6px' }} onClick={fillReceivableFromPayments}>Nạp từ thanh toán</button>
            </div>
            <input className="input" value={snapshotForm.receivable_planned_30d} onChange={(e) => setSnapshotForm((p) => ({ ...p, receivable_planned_30d: e.target.value }))} />
          </div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Dự kiến chi 30 ngày</div><input className="input" value={snapshotForm.payable_planned_30d} onChange={(e) => setSnapshotForm((p) => ({ ...p, payable_planned_30d: e.target.value }))} /></div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Mức độ rủi ro</div>
            <select className="select" value={snapshotForm.risk_level} onChange={(e) => setSnapshotForm((p) => ({ ...p, risk_level: e.target.value }))}>
              <option value="">(Không chọn)</option>
              <option value="low">Thấp</option>
              <option value="medium">Trung bình</option>
              <option value="high">Cao</option>
              <option value="critical">Nghiêm trọng</option>
            </select>
          </div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Tiến độ kế hoạch (%)</div><input className="input" value={snapshotForm.progress_planned_percent} onChange={(e) => setSnapshotForm((p) => ({ ...p, progress_planned_percent: e.target.value }))} /></div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Tiến độ thực tế (%)</div><input className="input" value={snapshotForm.progress_actual_percent} onChange={(e) => setSnapshotForm((p) => ({ ...p, progress_actual_percent: e.target.value }))} /></div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Số ngày trễ</div><input className="input" value={snapshotForm.delay_days} onChange={(e) => setSnapshotForm((p) => ({ ...p, delay_days: e.target.value }))} /></div>
          <div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Ghi chú</div><input className="input" value={snapshotForm.note} onChange={(e) => setSnapshotForm((p) => ({ ...p, note: e.target.value }))} /></div>
        </div>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={saveSnapshot} disabled={savingSnapshot}>{savingSnapshot ? 'Đang lưu...' : 'Lưu snapshot'}</button>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Lịch sử snapshot vận hành</div>
        <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {cashflowSnapshots.map((s: any) => (
            <div key={s.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>
                {fmtDate(s.snapshot_date)} | {s.snapshot_type === 'month_end' ? `Theo tháng ${s.period_key || ''}` : s.snapshot_type === 'milestone' ? `Theo mốc ${s?.milestone?.milestone_name || '-'}` : 'Theo thời điểm'} | Trạng thái vốn: {cashStateLabel(s.gap_30d)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                Nhu cầu: {fmtMoney(s.demand_30d)} | Cung ứng: {fmtMoney(s.supply_30d)} | Chênh lệch: <span style={{ color: Number(s.gap_30d || 0) < 0 ? 'var(--red)' : 'var(--green)' }}>{fmtGapSigned(s.gap_30d)}</span>
              </div>
            </div>
          ))}
          {!cashflowSnapshots.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Chưa có snapshot.</div> : null}
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Thanh toán</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 8 }}>
          <div>Tổng kế hoạch thu: <b>{fmtMoney(summary.total_planned)}</b></div>
          <div>Đã thu: <b>{fmtMoney(summary.total_paid)}</b></div>
          <div>Còn lại: <b>{fmtMoney(summary.outstanding)}</b></div>
          <div>Kỳ thu gần nhất: <b>{fmtDate(pay.next_due?.due_date)}</b></div>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Kế hoạch vật tư / nhân công (chỉ đọc)</div>
        <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text3)' }}>
          Số kế hoạch: <b style={{ color: 'var(--text)' }}>{resourcePlans.length}</b> | Số item: <b style={{ color: 'var(--text)' }}>{resourceItems.length}</b>
        </div>
        <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {resourcePlans.map((p: any) => {
            const items = resourceItems.filter((x: any) => x.plan_id === p.id)
            const total = items.reduce((s: number, x: any) => s + Number(x.estimated_cost || 0), 0)
            return (
              <div key={p.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700 }}>{p.plan_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  Trạng thái: {p.status || '-'} | Item: {items.length} | Tổng: {fmtMoney(total)}
                </div>
              </div>
            )
          })}
          {!resourcePlans.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Chưa có kế hoạch.</div> : null}
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Tài liệu dự án</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Phạm vi tài liệu</div>
            <select className="select" value={docScopeFilter} onChange={(e) => setDocScopeFilter(e.target.value)}>
              <option value="">Tất cả phạm vi</option>
              {PROJECT_DOCUMENT_SCOPE_OPTIONS.map((x) => (
                <option key={x.value} value={x.value}>{x.label}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Loại tài liệu</div>
            <select className="select" value={docTypeFilter} onChange={(e) => setDocTypeFilter(e.target.value)}>
              <option value="">Tất cả loại</option>
              {PROJECT_DOCUMENT_TYPE_OPTIONS.map((x) => (
                <option key={x.value} value={x.value}>{x.label}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mức truy cập</div>
            <select className="select" value={docAccessFilter} onChange={(e) => setDocAccessFilter(e.target.value)}>
              <option value="">Tất cả mức truy cập</option>
              {PROJECT_DOCUMENT_ACCESS_LEVEL_OPTIONS.map((x) => (
                <option key={x.value} value={x.value}>{x.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{editingDocId ? 'Sửa tài liệu' : 'Thêm tài liệu'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tên tài liệu</div>
              <input className="input" value={docForm.title} onChange={(e) => setDocForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>URL file</div>
              <input className="input" value={docForm.file_url} onChange={(e) => setDocForm((p) => ({ ...p, file_url: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tên file (nếu có)</div>
              <input className="input" value={docForm.file_name} onChange={(e) => setDocForm((p) => ({ ...p, file_name: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Phạm vi tài liệu</div>
              <select className="select" value={docForm.document_scope} onChange={(e) => setDocForm((p) => ({ ...p, document_scope: e.target.value }))}>
                {PROJECT_DOCUMENT_SCOPE_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Loại tài liệu</div>
              <select className="select" value={docForm.document_type} onChange={(e) => setDocForm((p) => ({ ...p, document_type: e.target.value }))}>
                {PROJECT_DOCUMENT_TYPE_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mức truy cập</div>
              <select className="select" value={docForm.access_level} onChange={(e) => setDocForm((p) => ({ ...p, access_level: e.target.value }))}>
                {PROJECT_DOCUMENT_ACCESS_LEVEL_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ghi chú</div>
              <input className="input" value={docForm.note} onChange={(e) => setDocForm((p) => ({ ...p, note: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <button className="btn-primary" onClick={saveDocument}>{editingDocId ? 'Lưu sửa' : '+ Thêm tài liệu'}</button>
              {editingDocId ? <button className="btn-ghost" onClick={resetDocForm}>Hủy</button> : null}
            </div>
          </div>
        </div>
        <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {filteredDocs.map((d: any) => (
            <div key={d.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontWeight: 700 }}>{d.title}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <a className="btn-ghost" style={{ fontSize: 11 }} href={d.file_url} target="_blank" rel="noreferrer">Mở</a>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 11 }}
                    onClick={() => {
                      setEditingDocId(String(d.id || ''))
                      setDocForm({
                        title: String(d.title || ''),
                        file_url: String(d.file_url || ''),
                        file_name: String(d.file_name || ''),
                        document_scope: String(d.document_scope || 'internal'),
                        document_type: String(d.document_type || 'other'),
                        access_level: String(d.access_level || 'team_only'),
                        note: String(d.note || ''),
                      })
                    }}
                  >
                    Sửa
                  </button>
                  <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => removeDocument(String(d.id || ''))}>
                    Xóa
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                {projectDocumentTypeLabel(d.document_type)} | {projectDocumentScopeLabel(d.document_scope)} | {projectDocumentAccessLevelLabel(d.access_level)} | {fmtDate(d.uploaded_at)}
              </div>
            </div>
          ))}
          {!filteredDocs.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Không có tài liệu theo bộ lọc đang chọn.</div> : null}
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 220px', gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Timeline dự án</div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Lọc theo tiến độ</div>
            <select className="select" value={timelineMilestoneFilter} onChange={(e) => setTimelineMilestoneFilter(e.target.value)}>
              <option value="">Tất cả tiến độ</option>
              {milestones.map((m: any) => <option key={m.id} value={m.id}>{m.milestone_name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {filteredTimelineRows.map((ev: any) => (
            <div key={ev.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{ev.title || ev.event_key} {ev?.milestone?.milestone_name ? `| ${ev.milestone.milestone_name}` : ''}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtDate(ev.happened_at)} | {ev.actor ? getUserDisplayName(ev.actor) : '-'} | {ev.event_key || '-'}</div>
              {ev.description ? <div style={{ fontSize: 12, marginTop: 4 }}>{ev.description}</div> : null}
            </div>
          ))}
          {!filteredTimelineRows.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Chưa có timeline theo bộ lọc đang chọn.</div> : null}
        </div>
      </div>
    </div>
  )
}
