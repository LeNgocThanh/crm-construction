'use client'

import { useEffect, useMemo, useState } from 'react'

type RuleRow = {
  id: string
  rule_code: string
  rule_name: string
  milestone_definition_id?: string | null
  milestone_key?: string | null
  trigger_status_key: string
  check_type: string
  warning_message: string
  sort_order: number
  is_active: boolean
  milestone_definition?: { id: string; definition_key: string; definition_name: string } | null
}

type DefinitionRow = { id: string; definition_key: string; definition_name: string; is_active: boolean }

const STATUS_OPTIONS = [
  { value: 'completed', label: 'Đã hoàn thành' },
  { value: 'in_progress', label: 'Đang thực hiện' },
  { value: 'pending', label: 'Chờ thực hiện' },
]

const CHECK_OPTIONS = [
  { value: 'require_contract_document', label: 'Cần tài liệu hợp đồng' },
  { value: 'require_project_start_date', label: 'Cần ngày khởi công dự án' },
]

function slugify(v: string) {
  return String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export default function ProjectMilestoneRulesPage() {
  const [rules, setRules] = useState<RuleRow[]>([])
  const [definitions, setDefinitions] = useState<DefinitionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState({
    rule_name: '',
    milestone_definition_id: '',
    milestone_key: '',
    trigger_status_key: 'completed',
    check_type: 'require_contract_document',
    warning_message: '',
    sort_order: '0',
    is_active: true,
  })

  const generatedCode = useMemo(() => `rule_${slugify(form.rule_name || 'new')}`, [form.rule_name])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function load() {
    setLoading(true)
    const [rRes, dRes] = await Promise.all([
      fetch('/api/settings/project-milestone-rules?active_only=false'),
      fetch('/api/settings/project-milestone-definitions?active_only=false'),
    ])
    const rJson = await rRes.json().catch(() => ({}))
    const dJson = await dRes.json().catch(() => ({}))
    setRules(Array.isArray(rJson?.data) ? rJson.data : [])
    setDefinitions(Array.isArray(dJson?.data) ? dJson.data : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function resetForm() {
    setEditingId('')
    setForm({
      rule_name: '',
      milestone_definition_id: '',
      milestone_key: '',
      trigger_status_key: 'completed',
      check_type: 'require_contract_document',
      warning_message: '',
      sort_order: '0',
      is_active: true,
    })
  }

  async function submit() {
    if (!form.rule_name.trim()) return showToast('Thiếu tên rule')
    if (!form.warning_message.trim()) return showToast('Thiếu nội dung cảnh báo')
    if (!form.milestone_definition_id && !form.milestone_key.trim()) return showToast('Chọn mốc gốc hoặc nhập mã mốc')

    const payload = {
      rule_code: generatedCode,
      rule_name: form.rule_name.trim(),
      milestone_definition_id: form.milestone_definition_id || null,
      milestone_key: form.milestone_key.trim() || null,
      trigger_status_key: form.trigger_status_key,
      check_type: form.check_type,
      warning_message: form.warning_message.trim(),
      sort_order: Number(form.sort_order || 0),
      is_active: form.is_active,
      check_params: form.check_type === 'require_contract_document' ? { document_type: 'contract' } : null,
    }

    const res = await fetch(editingId ? `/api/settings/project-milestone-rules/${editingId}` : '/api/settings/project-milestone-rules', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không lưu được rule')

    const wasEditing = !!editingId
    resetForm()
    await load()
    showToast(wasEditing ? 'Đã cập nhật rule' : 'Đã tạo rule')
  }

  async function removeRule(id: string) {
    if (!confirm('Tắt rule này?')) return
    const res = await fetch(`/api/settings/project-milestone-rules/${id}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(j?.error || 'Không tắt được rule')
    await load()
    showToast('Đã tắt rule')
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>DỰ ÁN / CÀI ĐẶT</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Rule cảnh báo mốc dự án</h1>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr .6fr', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tên rule</div>
            <input className="input" value={form.rule_name} onChange={(e) => setForm((p) => ({ ...p, rule_name: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mốc gốc</div>
            <select className="select" value={form.milestone_definition_id} onChange={(e) => setForm((p) => ({ ...p, milestone_definition_id: e.target.value }))}>
              <option value="">(Không chọn)</option>
              {definitions.filter((d) => d.is_active).map((d) => (
                <option key={d.id} value={d.id}>{d.definition_name}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mã mốc (fallback)</div>
            <input className="input" value={form.milestone_key} onChange={(e) => setForm((p) => ({ ...p, milestone_key: e.target.value }))} placeholder="vd: ky_hop_dong" />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Khi chuyển trạng thái</div>
            <select className="select" value={form.trigger_status_key} onChange={(e) => setForm((p) => ({ ...p, trigger_status_key: e.target.value }))}>
              {STATUS_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Loại kiểm tra</div>
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
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Nội dung cảnh báo</div>
            <input className="input" value={form.warning_message} onChange={(e) => setForm((p) => ({ ...p, warning_message: e.target.value }))} placeholder="VD: Mốc ký hợp đồng chưa có tài liệu hợp đồng" />
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
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.rule_code} | {r.check_type} | {r.trigger_status_key} | {r.is_active ? 'On' : 'Off'}</div>
                <div style={{ fontSize: 12, marginTop: 2 }}>{r.warning_message}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  Mốc gốc: {r.milestone_definition?.definition_name || '-'} {r.milestone_key ? `| milestone_key: ${r.milestone_key}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => {
                  setEditingId(r.id)
                  setForm({
                    rule_name: r.rule_name || '',
                    milestone_definition_id: String(r.milestone_definition_id || ''),
                    milestone_key: String(r.milestone_key || ''),
                    trigger_status_key: r.trigger_status_key || 'completed',
                    check_type: r.check_type || 'require_contract_document',
                    warning_message: r.warning_message || '',
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
