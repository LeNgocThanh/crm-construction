'use client'

import { useEffect, useState } from 'react'

type Warehouse = { id: string; warehouse_code: string; warehouse_name: string }
type AuditItem = {
  id: string
  material_key: string
  material_name?: string | null
  item_unit?: string | null
  book_qty: number
  counted_qty?: number | null
  variance_qty?: number | null
  avg_unit_cost?: number | null
  variance_value?: number | null
  note?: string | null
}
type AuditRow = {
  id: string
  audit_code: string
  warehouse_id: string
  audit_date: string
  status: string
  note?: string | null
  total_items: number
  counted_items: number
  variance_items: number
  total_variance_value?: number | null
  applied_txn_id?: string | null
  applied_txn_code?: string | null
  warehouse?: Warehouse | null
  items?: AuditItem[]
}

function formatMoney(value?: number | null) {
  return `${Number(value || 0).toLocaleString('vi-VN')} vnd`
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('vi-VN')
}

function statusLabel(status?: string | null) {
  switch (status) {
    case 'draft': return 'Nháp'
    case 'counted': return 'Đã chốt kiểm kê'
    case 'applied': return 'Đã áp chênh lệch'
    case 'cancelled': return 'Đã hủy'
    default: return status || '-'
  }
}

function statusColor(status?: string | null) {
  switch (status) {
    case 'draft': return 'var(--orange)'
    case 'counted': return 'var(--blue)'
    case 'applied': return 'var(--green)'
    case 'cancelled': return 'var(--red)'
    default: return 'var(--text3)'
  }
}

export default function InventoryAuditsPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [rows, setRows] = useState<AuditRow[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<AuditRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [paging, setPaging] = useState({ page: 1, page_size: 20, total: 0, total_pages: 1 })
  const [filter, setFilter] = useState({
    warehouse_id: '',
    status: '',
    include_cancelled: false,
  })
  const [createForm, setCreateForm] = useState({
    warehouse_id: '',
    audit_date: '',
    note: '',
    include_zero: false,
  })

  const editable = detail?.status === 'draft'
  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2400)
  }

  async function loadWarehouses() {
    const res = await fetch('/api/settings/warehouses?active_only=true', { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    const next = Array.isArray(json?.data) ? json.data : []
    setWarehouses(next)
    setCreateForm((prev) => ({ ...prev, warehouse_id: prev.warehouse_id || next[0]?.id || '' }))
  }

  async function loadRows(page = paging.page) {
    setLoading(true)
    try {
      const sp = new URLSearchParams()
      sp.set('page', String(page))
      sp.set('page_size', String(paging.page_size))
      if (filter.warehouse_id) sp.set('warehouse_id', filter.warehouse_id)
      if (filter.status) sp.set('status', filter.status)
      if (filter.include_cancelled) sp.set('include_cancelled', 'true')
      const res = await fetch(`/api/inventory/audits?${sp.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      const next = Array.isArray(json?.data) ? json.data : []
      setRows(next)
      const p = json?.pagination || {}
      setPaging((prev) => ({
        ...prev,
        page: Number(p.page || page || 1),
        page_size: Number(p.page_size || prev.page_size || 20),
        total: Number(p.total || 0),
        total_pages: Number(p.total_pages || 1),
      }))
      if (selectedId) {
        const matched = next.find((x: AuditRow) => x.id === selectedId)
        if (matched) void loadDetail(matched.id)
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(id: string) {
    const res = await fetch(`/api/inventory/audits/${id}`, { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(json?.error || 'Không tải được phiếu kiểm kê')
      return
    }
    setDetail(json.data || null)
  }

  async function createAudit() {
    if (!createForm.warehouse_id) return showToast('Thiếu kho kiểm kê')
    setSaving(true)
    const res = await fetch('/api/inventory/audits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        warehouse_id: createForm.warehouse_id,
        audit_date: createForm.audit_date || null,
        note: createForm.note || null,
        include_zero: createForm.include_zero,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return showToast(json?.error || 'Không tạo được phiếu kiểm kê')
    showToast('Đã tạo phiếu kiểm kê')
    setSelectedId(String(json?.data?.id || ''))
    setDetail(json?.data || null)
    await loadRows(1)
  }

  async function saveCounts() {
    if (!detail) return
    setSaving(true)
    const res = await fetch(`/api/inventory/audits/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note: detail.note || null,
        items: (detail.items || []).map((item) => ({
          id: item.id,
          counted_qty: item.counted_qty ?? null,
          note: item.note || null,
        })),
      }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return showToast(json?.error || 'Không lưu được số đếm')
    setDetail(json?.data || null)
    await loadRows(paging.page)
    showToast('Đã lưu số đếm thực tế')
  }

  async function runAction(action: string) {
    if (!detail) return
    const confirmMap: Record<string, string> = {
      counted: 'Chốt phiếu kiểm kê này?',
      reopen: 'Mở lại phiếu kiểm kê để sửa số đếm?',
      apply: 'Áp chênh lệch và sinh phiếu điều chỉnh kho?',
      cancel: 'Hủy phiếu kiểm kê này?',
    }
    if (confirmMap[action] && !window.confirm(confirmMap[action])) return
    setSaving(true)
    const res = await fetch(`/api/inventory/audits/${detail.id}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return showToast(json?.error || 'Không thực hiện được thao tác')
    setDetail(json?.data || null)
    await loadRows(paging.page)
    if (action === 'apply' && json?.posted_transaction?.txn_code) {
      showToast(`Đã áp chênh lệch qua phiếu ${json.posted_transaction.txn_code}`)
      return
    }
    showToast('Đã cập nhật phiếu kiểm kê')
  }

  async function deleteCancelledAudit() {
    if (!detail) return
    if (!window.confirm('Xóa cứng phiếu kiểm kê đã hủy này?')) return
    setSaving(true)
    const res = await fetch(`/api/inventory/audits/${detail.id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return showToast(json?.error || 'Không xóa được phiếu kiểm kê')
    setDetail(null)
    setSelectedId('')
    await loadRows(1)
    showToast('Đã xóa phiếu kiểm kê đã hủy')
  }

  useEffect(() => {
    void loadWarehouses()
    void loadRows(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>KIEM KE KHO</div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Kiểm kê kho</h1>
        <div style={{ marginTop: 6, color: 'var(--text3)', fontSize: 13 }}>
          Chụp tồn sổ tại một thời điểm, nhập số đếm thực tế và áp chênh lệch thành phiếu điều chỉnh kho.
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Tạo phiếu kiểm kê mới</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1.2fr auto', gap: 10, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Kho kiểm kê</div>
            <select className="input" value={createForm.warehouse_id} onChange={(e) => setCreateForm((p) => ({ ...p, warehouse_id: e.target.value }))}>
              <option value="">Chọn kho</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Thời điểm kiểm kê</div>
            <input className="input" type="datetime-local" value={createForm.audit_date} onChange={(e) => setCreateForm((p) => ({ ...p, audit_date: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Ghi chú</div>
            <input className="input" value={createForm.note} onChange={(e) => setCreateForm((p) => ({ ...p, note: e.target.value }))} />
          </div>
          <button className="btn-primary" disabled={saving} onClick={() => void createAudit()}>+ Tạo phiếu</button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>
          <input type="checkbox" checked={createForm.include_zero} onChange={(e) => setCreateForm((p) => ({ ...p, include_zero: e.target.checked }))} />
          Tạo cả dòng vật tư đang có tồn sổ bằng 0
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px minmax(0,1fr)', gap: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Danh sách phiếu kiểm kê</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <select className="input" value={filter.warehouse_id} onChange={(e) => setFilter((p) => ({ ...p, warehouse_id: e.target.value }))}>
              <option value="">Tất cả kho</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
            </select>
            <select className="input" value={filter.status} onChange={(e) => setFilter((p) => ({ ...p, status: e.target.value }))}>
              <option value="">Tất cả trạng thái</option>
              <option value="draft">Nháp</option>
              <option value="counted">Đã chốt kiểm kê</option>
              <option value="applied">Đã áp chênh lệch</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12, color: 'var(--text2)' }}>
            <input
              type="checkbox"
              checked={filter.include_cancelled}
              onChange={(e) => setFilter((p) => ({ ...p, include_cancelled: e.target.checked }))}
            />
            Hiện phiếu đã hủy
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button className="btn" onClick={() => void loadRows(1)}>Lọc</button>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  setSelectedId(row.id)
                  void loadDetail(row.id)
                }}
                style={{
                  textAlign: 'left',
                  padding: 10,
                  borderRadius: 10,
                  border: selectedId === row.id
                    ? (Number(row.variance_items || 0) > 0 ? '1px solid var(--red)' : '1px solid var(--green)')
                    : '1px solid var(--border)',
                  background: Number(row.variance_items || 0) > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>{row.audit_code}</div>
                  <div style={{ color: statusColor(row.status), fontSize: 12 }}>{statusLabel(row.status)}</div>
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text3)' }}>{row.warehouse?.warehouse_name || '-'}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text3)' }}>{formatDate(row.audit_date)}</div>
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  Đã đếm: <b>{row.counted_items || 0}/{row.total_items || 0}</b> | Lệch: <b>{row.variance_items || 0}</b>
                </div>
              </button>
            ))}
            {!rows.length ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Chưa có phiếu kiểm kê.</div> : null}
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          {!detail ? (
            <div style={{ color: 'var(--text3)' }}>Chọn một phiếu kiểm kê để xem chi tiết.</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)' }}>PHIEU KIEM KE</div>
                  <h2 style={{ margin: '4px 0 0', fontSize: 22 }}>{detail.audit_code}</h2>
                  <div style={{ marginTop: 6, color: 'var(--text3)', fontSize: 13 }}>
                    {detail.warehouse?.warehouse_name || '-'} | {formatDate(detail.audit_date)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => window.open(`/api/inventory/audits/${detail.id}/print?print=1`, '_blank', 'width=1100,height=800')}
                  >
                    In / PDF
                  </button>
                  {detail.status === 'cancelled' && !detail.applied_txn_id ? (
                    <button className="btn-ghost" disabled={saving} onClick={() => void deleteCancelledAudit()}>Xóa phiếu</button>
                  ) : null}
                  {detail.status === 'draft' ? <button className="btn" disabled={saving} onClick={() => void saveCounts()}>Lưu số đếm</button> : null}
                  {detail.status === 'draft' ? <button className="btn" disabled={saving} onClick={() => void runAction('counted')}>Chốt kiểm kê</button> : null}
                  {detail.status === 'counted' ? <button className="btn" disabled={saving} onClick={() => void runAction('reopen')}>Mở lại</button> : null}
                  {detail.status === 'counted' ? <button className="btn-primary" disabled={saving} onClick={() => void runAction('apply')}>Áp chênh lệch</button> : null}
                  {['draft', 'counted'].includes(String(detail.status || '')) ? <button className="btn-ghost" disabled={saving} onClick={() => void runAction('cancel')}>Hủy phiếu</button> : null}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8, marginBottom: 12 }}>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text4)' }}>Tổng dòng</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{detail.total_items || 0}</div>
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text4)' }}>Đã đếm</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{detail.counted_items || 0}</div>
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text4)' }}>Dòng lệch</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{detail.variance_items || 0}</div>
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text4)' }}>Giá trị chênh lệch</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{formatMoney(detail.total_variance_value)}</div>
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Ghi chú phiếu kiểm kê</div>
                <textarea
                  className="input"
                  rows={2}
                  value={detail.note || ''}
                  disabled={!editable}
                  onChange={(e) => setDetail((prev) => prev ? ({ ...prev, note: e.target.value }) : prev)}
                />
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: 8 }}>Vật tư</th>
                      <th style={{ padding: 8 }}>Mã</th>
                      <th style={{ padding: 8 }}>Đơn vị</th>
                      <th style={{ padding: 8, textAlign: 'right' }}>Tồn sổ</th>
                      <th style={{ padding: 8, textAlign: 'right' }}>Đếm thực tế</th>
                      <th style={{ padding: 8, textAlign: 'right' }}>Chênh lệch</th>
                      <th style={{ padding: 8, textAlign: 'right' }}>Giá trị lệch</th>
                      <th style={{ padding: 8 }}>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.items || []).map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: 8 }}>{item.material_name || '-'}</td>
                        <td style={{ padding: 8, color: 'var(--text3)' }}>{item.material_key}</td>
                        <td style={{ padding: 8 }}>{item.item_unit || '-'}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{Number(item.book_qty || 0).toLocaleString('vi-VN')}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>
                          {editable ? (
                            <input
                              className="input"
                              style={{ width: 120, marginLeft: 'auto' }}
                              type="number"
                              value={item.counted_qty ?? ''}
                              onChange={(e) => {
                                const next = e.target.value === '' ? null : Number(e.target.value)
                                setDetail((prev) => prev ? ({
                                  ...prev,
                                  items: (prev.items || []).map((x) => x.id === item.id ? ({
                                    ...x,
                                    counted_qty: next,
                                    variance_qty: next == null ? null : Number(next) - Number(x.book_qty || 0),
                                    variance_value: next == null ? 0 : Math.round((Number(next) - Number(x.book_qty || 0)) * Number(x.avg_unit_cost || 0)),
                                  }) : x),
                                }) : prev)
                              }}
                            />
                          ) : (
                            item.counted_qty == null ? '-' : Number(item.counted_qty).toLocaleString('vi-VN')
                          )}
                        </td>
                        <td style={{ padding: 8, textAlign: 'right', color: item.variance_qty == null ? 'var(--text3)' : Number(item.variance_qty || 0) > 0 ? 'var(--green)' : Number(item.variance_qty || 0) < 0 ? 'var(--red)' : 'var(--text3)' }}>
                          {item.variance_qty == null ? '-' : Number(item.variance_qty).toLocaleString('vi-VN')}
                        </td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{item.variance_qty == null ? '-' : formatMoney(item.variance_value)}</td>
                        <td style={{ padding: 8 }}>
                          {editable ? (
                            <input
                              className="input"
                              value={item.note || ''}
                              onChange={(e) => setDetail((prev) => prev ? ({
                                ...prev,
                                items: (prev.items || []).map((x) => x.id === item.id ? ({ ...x, note: e.target.value }) : x),
                              }) : prev)}
                            />
                          ) : (
                            item.note || '-'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {detail.applied_txn_id ? (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
                  Phiếu kiểm kê này đã sinh phiếu điều chỉnh kho: <b>{detail.applied_txn_code || detail.applied_txn_id}</b>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {loading ? <div style={{ marginTop: 12, color: 'var(--text3)' }}>Đang tải kiểm kê kho...</div> : null}
      {toast ? (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
