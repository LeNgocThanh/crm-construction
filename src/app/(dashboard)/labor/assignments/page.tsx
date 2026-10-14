'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Project = { id: string; project_name: string; status?: string | null }
type Trade = { id: string; trade_key: string; trade_name: string; unit_text?: string | null; default_rate?: string | null }
type Crew = { id: string; crew_key: string; crew_name: string; leader_name?: string | null }
type Worker = {
  id: string
  worker_code: string
  full_name: string
  trade?: { id: string; trade_key: string; trade_name: string } | null
  crew?: { id: string; crew_key: string; crew_name: string } | null
  default_unit_text?: string | null
  default_rate?: string | null
}
type Engagement = {
  id: string
  engagement_type: string
  unit_text?: string | null
  rate_amount?: string | null
  planned_qty?: number | null
  planned_total_amount?: string | null
  start_date?: string | null
  end_date?: string | null
  status: string
  is_active: boolean
  note?: string | null
  project?: { id: string; project_name: string; status?: string | null } | null
  worker?: { id: string; worker_code: string; full_name: string } | null
  crew?: { id: string; crew_key: string; crew_name: string } | null
  trade?: { id: string; trade_key: string; trade_name: string } | null
  creator?: { id: string; username: string | null } | null
}

const EMPTY_FORM = {
  project_id: '',
  worker_id: '',
  crew_id: '',
  trade_id: '',
  engagement_type: 'daily',
  unit_text: '',
  rate_amount: '',
  planned_qty: '',
  planned_total_amount: '',
  start_date: '',
  end_date: '',
  status: 'planned',
  note: '',
  is_active: true,
}

function statusLabel(value?: string | null) {
  switch (value) {
    case 'planned': return 'Đã lên kế hoạch'
    case 'active': return 'Đang thực hiện'
    case 'paused': return 'Tạm dừng'
    case 'completed': return 'Hoàn thành'
    case 'cancelled': return 'Đã hủy'
    default: return value || '-'
  }
}

function formatMoney(v?: string | number | null) {
  if (v == null || v === '') return '-'
  const n = typeof v === 'string' ? Number(v) : v
  if (!Number.isFinite(n)) return '-'
  return Number(n).toLocaleString('vi-VN') + ' vnd'
}

function dateInputValue(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function displayDate(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('vi-VN')
}

export default function LaborAssignmentsPage() {
  const searchParams = useSearchParams()
  const initialProjectId = useMemo(() => String(searchParams.get('project_id') || ''), [searchParams])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [rows, setRows] = useState<Engagement[]>([])
  const [editingId, setEditingId] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId)
  const [form, setForm] = useState(EMPTY_FORM)

  async function loadMeta() {
    const [pRes, tRes, cRes, wRes] = await Promise.all([
      fetch('/api/projects?limit=200'),
      fetch('/api/labor/trades'),
      fetch('/api/labor/crews'),
      fetch('/api/labor/workers'),
    ])
    const [pJson, tJson, cJson, wJson] = await Promise.all([
      pRes.json().catch(() => ({})),
      tRes.json().catch(() => ({})),
      cRes.json().catch(() => ({})),
      wRes.json().catch(() => ({})),
    ])
    setProjects(Array.isArray(pJson?.data) ? pJson.data : [])
    setTrades(Array.isArray(tJson?.data) ? tJson.data : [])
    setCrews(Array.isArray(cJson?.data) ? cJson.data : [])
    setWorkers(Array.isArray(wJson?.data) ? wJson.data : [])
  }

  async function loadRows(projectId = selectedProjectId) {
    setLoading(true)
    try {
      const url = projectId ? `/api/labor/engagements?project_id=${encodeURIComponent(projectId)}` : '/api/labor/engagements'
      const res = await fetch(url)
      const json = await res.json().catch(() => ({}))
      setRows(Array.isArray(json?.data) ? json.data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMeta()
  }, [])

  useEffect(() => {
    if (!initialProjectId) return
    setSelectedProjectId(initialProjectId)
    setForm((p) => ({ ...p, project_id: initialProjectId }))
  }, [initialProjectId])

  useEffect(() => {
    void loadRows(selectedProjectId)
  }, [selectedProjectId])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  function projectName(id: string) {
    return projects.find((x) => x.id === id)?.project_name || id || '-'
  }

  function applyWorkerDefaults(workerId: string) {
    const worker = workers.find((x) => x.id === workerId)
    if (!worker) return
    setForm((p) => ({
      ...p,
      worker_id: workerId,
      trade_id: worker.trade?.id || p.trade_id,
      crew_id: worker.crew?.id || p.crew_id,
      unit_text: p.unit_text || worker.default_unit_text || '',
      rate_amount: p.rate_amount || worker.default_rate || '',
    }))
  }

  function applyTradeDefaults(tradeId: string) {
    const trade = trades.find((x) => x.id === tradeId)
    if (!trade) return
    setForm((p) => ({
      ...p,
      trade_id: tradeId,
      unit_text: p.unit_text || trade.unit_text || '',
      rate_amount: p.rate_amount || trade.default_rate || '',
    }))
  }

  async function submit() {
    if (!form.project_id) {
      setToast('Thiếu dự án')
      return
    }
    const payload = {
      project_id: form.project_id,
      worker_id: form.worker_id || null,
      crew_id: form.crew_id || null,
      trade_id: form.trade_id || null,
      engagement_type: form.engagement_type,
      unit_text: form.unit_text.trim() || null,
      rate_amount: form.rate_amount.trim() || null,
      planned_qty: form.planned_qty.trim() || null,
      planned_total_amount: form.planned_total_amount.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: form.status,
      note: form.note.trim() || null,
      is_active: !!form.is_active,
    }
    const url = editingId ? `/api/labor/engagements/${editingId}` : '/api/labor/engagements'
    const method = editingId ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(json?.error || 'Không lưu được phân công')
      return
    }
    setToast(editingId ? 'Đã cập nhật phân công' : 'Đã tạo phân công')
    setEditingId('')
    setForm((p) => ({ ...EMPTY_FORM, project_id: p.project_id }))
    await loadRows(form.project_id)
  }

  if (loading) return <div style={{ padding: 16 }}>Đang tải dữ liệu...</div>

  const activeRows = rows.filter((x) => (selectedProjectId ? x.project?.id === selectedProjectId : true))

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)' }}>NHÂN CÔNG</div>
          <h1 style={{ margin: '4px 0 4px', fontSize: 22, fontWeight: 800 }}>Phân công khoán việc</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Trang này dùng để giao khoán / phân công nhân công theo dự án, không trộn với chấm công.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link className="btn-ghost" href="/labor">Danh mục nhân công</Link>
          <Link className="btn-ghost" href="/labor/attendance">Chấm công / thanh toán</Link>
          <Link className="btn-ghost" href="/projects">Dự án</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Phân công</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{activeRows.length}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Đang hoạt động</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{activeRows.filter((x) => x.is_active).length}</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>Dự án lọc</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{selectedProjectId ? 1 : projects.length}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: 8, alignItems: 'end', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Dự án</div>
            <select
              className="select"
              value={selectedProjectId}
              onChange={(e) => {
                const next = e.target.value
                setSelectedProjectId(next)
                setForm((p) => ({ ...p, project_id: next }))
              }}
            >
              <option value="">(Tất cả dự án)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.project_name}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Nhân công</div>
            <select
              className="select"
              value={form.worker_id}
              onChange={(e) => applyWorkerDefaults(e.target.value)}
            >
              <option value="">(Chọn nhân công)</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.full_name} ({w.worker_code})</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tổ đội</div>
            <select className="select" value={form.crew_id} onChange={(e) => setForm((p) => ({ ...p, crew_id: e.target.value }))}>
              <option value="">(Chọn đội)</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>{c.crew_name}</option>
              ))}
            </select>
          </div>
          <button className="btn-ghost" onClick={() => { setEditingId(''); setForm({ ...EMPTY_FORM, project_id: selectedProjectId }) }}>Mới</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gap: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Nghề</div>
            <select
              className="select"
              value={form.trade_id}
              onChange={(e) => applyTradeDefaults(e.target.value)}
            >
              <option value="">(Chọn nghề)</option>
              {trades.map((t) => (
                <option key={t.id} value={t.id}>{t.trade_name}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Loại khoán</div>
            <select className="select" value={form.engagement_type} onChange={(e) => setForm((p) => ({ ...p, engagement_type: e.target.value }))}>
              <option value="daily">Công ngày</option>
              <option value="piecework">Khoán sản lượng</option>
              <option value="contract">Khoán hợp đồng</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đơn vị</div>
            <input className="input" value={form.unit_text} placeholder="Ví dụ: công, m2, ngày" onChange={(e) => setForm((p) => ({ ...p, unit_text: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đơn giá</div>
            <input className="input" value={form.rate_amount} placeholder="Có thể để trống" onChange={(e) => setForm((p) => ({ ...p, rate_amount: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Khối lượng</div>
            <input className="input" value={form.planned_qty} placeholder="Không bắt buộc" onChange={(e) => setForm((p) => ({ ...p, planned_qty: e.target.value }))} />
          </div>
          <button className="btn-primary" onClick={submit}>{editingId ? 'Lưu sửa' : '+ Tạo'}</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end', marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tổng tiền dự kiến</div>
            <input className="input" value={form.planned_total_amount} placeholder="Không bắt buộc" onChange={(e) => setForm((p) => ({ ...p, planned_total_amount: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Từ ngày</div>
            <input className="input" type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đến ngày</div>
            <input className="input" type="date" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Trạng thái</div>
            <select className="select" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
              <option value="planned">Đã lên kế hoạch</option>
              <option value="active">Đang thực hiện</option>
              <option value="paused">Tạm dừng</option>
              <option value="completed">Hoàn thành</option>
              <option value="cancelled">Hủy</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, paddingTop: 20 }}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
            Hoạt động
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            {editingId ? (
              <button className="btn-ghost" onClick={() => { setEditingId(''); setForm({ ...EMPTY_FORM, project_id: selectedProjectId }) }}>
                Hủy sửa
              </button>
            ) : null}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, alignItems: 'end', marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ghi chú</div>
            <input className="input" value={form.note} placeholder="Không bắt buộc" onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Danh sách phân công</div>
        <div style={{ maxHeight: 520, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {activeRows.map((r) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>
                  {r.project?.project_name || '-'} | {r.worker?.full_name || r.crew?.crew_name || '-'} | {r.trade?.trade_name || '-'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  Loại: {r.engagement_type} | Đơn vị: {r.unit_text || '-'} | Đơn giá: {formatMoney(r.rate_amount)} | Khối lượng: {r.planned_qty ?? '-'} | Tổng dự kiến: {formatMoney(r.planned_total_amount)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                  {displayDate(r.start_date)} → {displayDate(r.end_date)} | Trạng thái: {statusLabel(r.status)} | {r.is_active ? 'Hoạt động' : 'Ngưng'}
                </div>
                {r.note ? <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>Ghi chú: {r.note}</div> : null}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11 }}
                  onClick={() => {
                    setEditingId(r.id)
                    setForm({
                      project_id: r.project?.id || selectedProjectId,
                      worker_id: r.worker?.id || '',
                      crew_id: r.crew?.id || '',
                      trade_id: r.trade?.id || '',
                      engagement_type: r.engagement_type || 'daily',
                      unit_text: r.unit_text || '',
                      rate_amount: r.rate_amount || '',
                      planned_qty: r.planned_qty != null ? String(r.planned_qty) : '',
                      planned_total_amount: r.planned_total_amount || '',
                      start_date: dateInputValue(r.start_date),
                      end_date: dateInputValue(r.end_date),
                      status: r.status || 'planned',
                      note: r.note || '',
                      is_active: r.is_active,
                    })
                    if (r.project?.id) setSelectedProjectId(r.project.id)
                  }}
                >
                  Sửa
                </button>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11 }}
                  onClick={async () => {
                    await fetch(`/api/labor/engagements/${r.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ is_active: !r.is_active }),
                    })
                    await loadRows(selectedProjectId)
                  }}
                >
                  {r.is_active ? 'Tắt' : 'Bật'}
                </button>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11, color: 'var(--red)' }}
                  onClick={async () => {
                    if (!confirm('Xóa phân công này?')) return
                    await fetch(`/api/labor/engagements/${r.id}`, { method: 'DELETE' })
                    await loadRows(selectedProjectId)
                  }}
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
          {!activeRows.length ? <div style={{ padding: 10, color: 'var(--text3)' }}>Chưa có phân công.</div> : null}
        </div>
      </div>

      {toast ? (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
