'use client'

import { useEffect, useMemo, useState } from 'react'

type RuleRow = {
  id: string
  rule_code: string
  rule_name: string
  from_status_key: string
  to_status_key: string
  rule_mode: 'warning' | 'block' | string
  check_type: string
  message: string
  sort_order: number
  is_active: boolean
}

type StatusRow = { id: string; status_key: string; status_name: string; is_active: boolean }

const CHECK_OPTIONS = [
  { value: 'require_customer_confirm_ready', label: 'Khách hàng đủ điều kiện xác nhận' },
  { value: 'require_start_date', label: 'Có ngày khởi công' },
  { value: 'require_reason', label: 'Có lý do chuyển trạng thái' },
]

function slugify(v: string) {
  return String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export default function ProjectStatusTransitionRulesPage() {
  const [rules, setRules] = useState<RuleRow[]>([])
  const [statuses, setStatuses] = useState<StatusRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState({
    rule_name: '',
    from_status_key: 'draft',
    to_status_key: 'confirmed',
    rule_mode: 'warning',
    check_type: 'require_customer_confirm_ready',
    message: '',
    sort_order: '0',
    is_active: true,
  })

  const generatedCode = useMemo(() => `project_rule_${slugify(form.rule_name || 'new')}`, [form.rule_name])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function load() {
    setLoading(true)
    const [rRes, sRes] = await Promise.all([
      fetch('/api/settings/project-status-transition-rules?active_only=false'),
      fetch('/api/settings/project-statuses?active_only=true'),
    ])
    const rJson = await rRes.json().catch(() => ({}))
    const sJson = await sRes.json().catch(() => ({}))
    const r = Array.isArray(rJson?.data) ? rJson.data : []
    const s = Array.isArray(sJson?.data) ? sJson.data : []
    setRules(r)
    setStatuses(s)
    if (s.length) {
      setForm((prev) => ({
        ...prev,
        from_status_key: prev.from_status_key || s[0].status_key,
        to_status_key: prev.to_status_key || s[0].status_key,
      }))
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function resetForm() {
    setEditingId('')
    setForm({
      rule_name: '',
      from_status_key: statuses[0]?.status_key || 'draft',
      to_status_key: statuses[1]?.status_key || statuses[0]?.status_key || 'confirmed',
      rule_mode: 'warning',
      check_type: 'require_customer_confirm_ready',
      message: '',
      sort_order: '0',
      is_active: true,
    })
  }

  async function submit() {
    if (!form.rule_name.trim()) return showToast('Thiếu tên rule')
    if (!form.from_status_key || !form.to_status_key) return showToast('Thiếu trạng thái nguồn/đích')
    if (!form.message.trim()) return showToast('Thiếu thông điệp rule')

    const payload = {
      rule_code: generatedCode,
      rule_name: form.rule_name.trim(),
      from_status_key: form.from_status_key,
      to_status_key: form.to_status_key,
      rule_mode: form.rule_mode,
      check_type: form.check_type,
      message: form.message.trim(),
      sort_order: Number(form.sort_order || 0),
      is_active: form.is_active,
      check_params: null,
    }

    const res = await fetch(editingId ? `/api/settings/project-status-transition-rules/${editingId}` : '/api/settings/project-status-transition-rules', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không lưu được rule chuyển trạng thái')

    const wasEditing = !!editingId
    resetForm()
    await load()
    showToast(wasEditing ? 'Đã cập nhật rule' : 'Đã tạo rule')
  }

  async function removeRule(id: string) {
    if (!confirm('Tắt rule này?')) return
    const res = await fetch(`/api/settings/project-status-transition-rules/${id}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không tắt được rule')
    await load()
    showToast('Đã tắt rule')
  }

  const statusLabel = (key: string) => statuses.find((x) => x.status_key === key)?.status_name || key

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>DỰ ÁN / CÀI ĐẶT</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Rule chuyển trạng thái dự án</h1>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr .7fr 1fr .6fr', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tên rule</div>
            <input className="input" value={form.rule_name} onChange={(e) => setForm((p) => ({ ...p, rule_name: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Từ trạng thái</div>
            <select className="select" value={form.from_status_key} onChange={(e) => setForm((p) => ({ ...p, from_status_key: e.target.value }))}>
              {statuses.map((s) => <option key={s.id} value={s.status_key}>{s.status_name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Sang trạng thái</div>
            <select className="select" value={form.to_status_key} onChange={(e) => setForm((p) => ({ ...p, to_status_key: e.target.value }))}>
              {statuses.map((s) => <option key={s.id} value={s.status_key}>{s.status_name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Chế độ</div>
            <select className="select" value={form.rule_mode} onChange={(e) => setForm((p) => ({ ...p, rule_mode: e.target.value }))}>
              <option value="warning">Cảnh báo</option>
              <option value="block">Chặn</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Kiểm tra</div>
            <select className="select" value={form.check_type} onChange={(e) => setForm((p) => ({ ...p, check_type: e.target.value }))}>
              {CHECK_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Thứ tự</div>
            <input className="input" type="number" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Thông điệp</div>
            <input className="input" value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} placeholder="VD: Cần nhập ngày khởi công trước khi chuyển trạng thái" />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Mã rule tự sinh: <b>{generatedCode}</b></div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <button className="btn-primary" onClick={submit}>{editingId ? 'Lưu sửa' : '+ Tạo rule'}</button>
            {editingId ? <button className="btn-ghost" onClick={resetForm}>Hủy</button> : null}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        {loading ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Đang tải...</div> : null}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 560, overflowY: 'auto' }}>
          {rules.map((r) => (
            <div key={r.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{r.rule_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.rule_code} | {statusLabel(r.from_status_key)} {'->'} {statusLabel(r.to_status_key)} | {r.rule_mode === 'block' ? 'Chặn' : 'Cảnh báo'} | {r.is_active ? 'On' : 'Off'}</div>
                <div style={{ fontSize: 12 }}>{r.message}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => {
                  setEditingId(r.id)
                  setForm({
                    rule_name: r.rule_name || '',
                    from_status_key: r.from_status_key || statuses[0]?.status_key || 'draft',
                    to_status_key: r.to_status_key || statuses[0]?.status_key || 'confirmed',
                    rule_mode: (r.rule_mode as any) || 'warning',
                    check_type: r.check_type || 'require_customer_confirm_ready',
                    message: r.message || '',
                    sort_order: String(r.sort_order || 0),
                    is_active: r.is_active,
                  })
                }}>Sửa</button>
                <button className="btn-ghost" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => removeRule(r.id)}>Tắt</button>
              </div>
            </div>
          ))}
          {!rules.length ? <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>Chưa có rule nào.</div> : null}
        </div>
      </div>

      {toast ? <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>{toast}</div> : null}
    </div>
  )
}
