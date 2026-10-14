'use client'

import { useEffect, useMemo, useState } from 'react'

type SlaLevel = {
  id: string
  policy_id: string
  level_key: string
  level_name: string
  sort_order: number
  trigger_type: 'before_due' | 'after_due' | string
  trigger_minutes: number
  cooldown_minutes: number
  notify_type?: string | null
  notify_targets_json?: any
  is_active: boolean
}

type SlaPolicy = {
  id: string
  policy_key: string
  name: string
  is_active: boolean
  priority: number
  target_minutes: number
  match_json?: any
  levels: SlaLevel[]
}

export default function SlaPoliciesPage() {
  const [policies, setPolicies] = useState<SlaPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const [selectedPolicyId, setSelectedPolicyId] = useState('')
  const [policyKeyTouched, setPolicyKeyTouched] = useState(false)
  const [levelKeyTouched, setLevelKeyTouched] = useState(false)

  const [newPolicy, setNewPolicy] = useState({
    policy_key: '',
    name: '',
    priority: '0',
    target_minutes: '120',
    is_active: true,
    match_json_text: '{}',
  })

  const [newLevel, setNewLevel] = useState({
    level_key: '',
    level_name: '',
    sort_order: '0',
    trigger_type: 'before_due',
    trigger_minutes: '30',
    cooldown_minutes: '60',
    notify_type: 'sla_warning',
    is_active: true,
    notify_targets_json_text: '{"targets":["assignee"]}',
  })

  const notifyTypeOptions = useMemo(
    () => [
      { value: 'sla_warning', label: 'Nhắc sắp tới hạn' },
      { value: 'sla_overdue', label: 'Báo quá hạn' },
      { value: 'sla_escalated', label: 'Escalation lên quản lý' },
    ],
    []
  )

  const selectedPolicy = useMemo(
    () => policies.find((p) => p.id === selectedPolicyId) || null,
    [policies, selectedPolicyId]
  )

  async function loadAll() {
    setLoading(true)
    const res = await fetch('/api/settings/sla-policies?active_only=false')
    const j = await res.json().catch(() => ({}))
    const data = Array.isArray(j?.data) ? j.data : []
    setPolicies(data)
    if (!selectedPolicyId && data.length) setSelectedPolicyId(data[0].id)
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

  function slugifyKey(input: string, fallback: string) {
    const raw = String(input || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    return raw || fallback
  }

  function getNotifyTypeLabel(value?: string | null) {
    const key = String(value || '').trim()
    if (!key) return '-'
    const found = notifyTypeOptions.find((x) => x.value === key)
    return found ? found.label : key
  }

  useEffect(() => {
    if (policyKeyTouched) return
    const next = slugifyKey(newPolicy.name, 'sla_policy')
    setNewPolicy((p) => (p.policy_key === next ? p : { ...p, policy_key: next }))
  }, [newPolicy.name, policyKeyTouched])

  useEffect(() => {
    if (levelKeyTouched) return
    const next = slugifyKey(newLevel.level_name, 'sla_level')
    setNewLevel((p) => (p.level_key === next ? p : { ...p, level_key: next }))
  }, [newLevel.level_name, levelKeyTouched])

  function parseJsonSafe(text: string) {
    const raw = String(text || '').trim()
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  async function createPolicy() {
    const matchJson = parseJsonSafe(newPolicy.match_json_text)
    if (!newPolicy.policy_key.trim() || !newPolicy.name.trim()) {
      setToast('Thiếu mã policy hoặc tên policy')
      return
    }
    setSaving(true)
    const res = await fetch('/api/settings/sla-policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        policy_key: newPolicy.policy_key.trim(),
        name: newPolicy.name.trim(),
        priority: Number(newPolicy.priority || 0),
        target_minutes: Number(newPolicy.target_minutes || 0),
        is_active: newPolicy.is_active,
        match_json: matchJson,
      }),
    })
    const j = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setToast(j?.error || 'Không tạo được policy')
      return
    }
    setNewPolicy({
      policy_key: '',
      name: '',
      priority: '0',
      target_minutes: '120',
      is_active: true,
      match_json_text: '{}',
    })
    setPolicyKeyTouched(false)
    setToast('Đã tạo policy')
    await loadAll()
    if (j?.data?.id) setSelectedPolicyId(j.data.id)
  }

  async function patchPolicy(id: string, patch: any) {
    const res = await fetch(`/api/settings/sla-policies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(j?.error || 'Cập nhật policy thất bại')
      return
    }
    setToast('Đã cập nhật policy')
    await loadAll()
  }

  async function removePolicy(id: string) {
    if (!confirm('Xóa policy này và toàn bộ level?')) return
    const res = await fetch(`/api/settings/sla-policies/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setToast(j?.error || 'Xóa policy thất bại')
      return
    }
    setToast('Đã xóa policy')
    if (selectedPolicyId === id) setSelectedPolicyId('')
    await loadAll()
  }

  async function createLevel() {
    if (!selectedPolicy) return
    const notifyTargets = parseJsonSafe(newLevel.notify_targets_json_text)
    if (!newLevel.level_key.trim() || !newLevel.level_name.trim()) {
      setToast('Thiếu mã level hoặc tên level')
      return
    }
    const res = await fetch(`/api/settings/sla-policies/${selectedPolicy.id}/levels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level_key: newLevel.level_key.trim(),
        level_name: newLevel.level_name.trim(),
        sort_order: Number(newLevel.sort_order || 0),
        trigger_type: newLevel.trigger_type,
        trigger_minutes: Number(newLevel.trigger_minutes || 0),
        cooldown_minutes: Number(newLevel.cooldown_minutes || 0),
        notify_type: newLevel.notify_type || null,
        notify_targets_json: notifyTargets,
        is_active: newLevel.is_active,
      }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(j?.error || 'Tạo level thất bại')
      return
    }
    setNewLevel({
      level_key: '',
      level_name: '',
      sort_order: '0',
      trigger_type: 'before_due',
      trigger_minutes: '30',
      cooldown_minutes: '60',
      notify_type: 'sla_warning',
      is_active: true,
      notify_targets_json_text: '{"targets":["assignee"]}',
    })
    setLevelKeyTouched(false)
    setToast('Đã tạo level')
    await loadAll()
  }

  async function patchLevel(levelId: string, patch: any) {
    const res = await fetch(`/api/settings/sla-policy-levels/${levelId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(j?.error || 'Cập nhật level thất bại')
      return
    }
    setToast('Đã cập nhật level')
    await loadAll()
  }

  async function removeLevel(levelId: string) {
    if (!confirm('Xóa level này?')) return
    const res = await fetch(`/api/settings/sla-policy-levels/${levelId}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(j?.error || 'Xóa level thất bại')
      return
    }
    setToast('Đã xóa level')
    await loadAll()
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>CÀI ĐẶT SLA</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Chính sách / Cấp độ SLA</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Cấu hình SLA theo dữ liệu (DB-driven), không hardcode cấp độ escalation.</div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 30, textAlign: 'center' }}>
          Đang tải...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12 }}>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)', letterSpacing: 1.2, marginBottom: 8 }}>CHÍNH SÁCH SLA</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.6fr 0.7fr auto', gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mã policy</div>
                <input
                  className="input"
                  placeholder="Tự sinh từ tên policy"
                  value={newPolicy.policy_key}
                  onChange={(e) => {
                    setPolicyKeyTouched(true)
                    setNewPolicy((p) => ({ ...p, policy_key: e.target.value }))
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tên policy</div>
                <input className="input" placeholder="vd: SLA CSKH mặc định" value={newPolicy.name} onChange={(e) => setNewPolicy((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Ưu tiên</div>
                <input className="input" placeholder="0" value={newPolicy.priority} onChange={(e) => setNewPolicy((p) => ({ ...p, priority: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mục tiêu (phút)</div>
                <input className="input" placeholder="120" value={newPolicy.target_minutes} onChange={(e) => setNewPolicy((p) => ({ ...p, target_minutes: e.target.value }))} />
              </div>
              <button className="btn-primary" disabled={saving} onClick={createPolicy}>
                + Tạo
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Điều kiện áp dụng (JSON)</div>
            <textarea
              className="input"
              style={{ minHeight: 56, resize: 'vertical', marginBottom: 8 }}
              value={newPolicy.match_json_text}
              onChange={(e) => setNewPolicy((p) => ({ ...p, match_json_text: e.target.value }))}
              placeholder={'vd: {"source_ref_types":["manual_task"],"internal_only":true}'}
            />

            <div style={{ maxHeight: 460, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {policies.map((p) => (
                <div key={p.id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px', background: selectedPolicyId === p.id ? 'rgba(59,130,246,.08)' : 'transparent' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setSelectedPolicyId(p.id)}>
                      Chọn
                    </button>
                    <strong style={{ fontSize: 13 }}>{p.name}</strong>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>({p.policy_key})</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                    mục tiêu={p.target_minutes} phút | ưu tiên={p.priority} | levels={p.levels?.length || 0}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => patchPolicy(p.id, { is_active: !p.is_active })}>
                      {p.is_active ? 'Bật' : 'Tắt'}
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ padding: '2px 8px', fontSize: 11 }}
                      onClick={() => {
                        const next = prompt('Mục tiêu SLA (phút)', String(p.target_minutes))
                        if (!next) return
                        patchPolicy(p.id, { target_minutes: Number(next) })
                      }}
                    >
                      Sửa mục tiêu
                    </button>
                    <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11, color: 'var(--red)' }} onClick={() => removePolicy(p.id)}>
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)', letterSpacing: 1.2, marginBottom: 8 }}>
              CẤP ĐỘ ESCALATION {selectedPolicy ? `- ${selectedPolicy.name}` : ''}
            </div>

            {!selectedPolicy ? (
              <div style={{ color: 'var(--text3)', fontSize: 12 }}>Chọn policy để quản lý các level.</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.5fr 0.9fr 0.8fr 0.8fr 1fr auto', gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mã level</div>
                    <input
                      className="input"
                      placeholder="Tự sinh từ tên level"
                      value={newLevel.level_key}
                      onChange={(e) => {
                        setLevelKeyTouched(true)
                        setNewLevel((p) => ({ ...p, level_key: e.target.value }))
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tên level</div>
                    <input className="input" placeholder="vd: Cảnh báo sớm" value={newLevel.level_name} onChange={(e) => setNewLevel((p) => ({ ...p, level_name: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Thứ tự</div>
                    <input className="input" placeholder="0" value={newLevel.sort_order} onChange={(e) => setNewLevel((p) => ({ ...p, sort_order: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Kiểu kích hoạt</div>
                    <select className="select" value={newLevel.trigger_type} onChange={(e) => setNewLevel((p) => ({ ...p, trigger_type: e.target.value }))}>
                      <option value="before_due">Trước hạn (before_due)</option>
                      <option value="after_due">Sau hạn (after_due)</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Kích hoạt (phút)</div>
                    <input className="input" placeholder="30" value={newLevel.trigger_minutes} onChange={(e) => setNewLevel((p) => ({ ...p, trigger_minutes: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Cooldown (phút)</div>
                    <input className="input" placeholder="60" value={newLevel.cooldown_minutes} onChange={(e) => setNewLevel((p) => ({ ...p, cooldown_minutes: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Loại thông báo</div>
                    <select className="select" value={newLevel.notify_type || 'sla_warning'} onChange={(e) => setNewLevel((p) => ({ ...p, notify_type: e.target.value }))}>
                      {notifyTypeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button className="btn-primary" onClick={createLevel}>
                    + Thêm level
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đích nhận thông báo (JSON)</div>
                <textarea
                  className="input"
                  style={{ minHeight: 56, resize: 'vertical', marginBottom: 8 }}
                  value={newLevel.notify_targets_json_text}
                  onChange={(e) => setNewLevel((p) => ({ ...p, notify_targets_json_text: e.target.value }))}
                  placeholder={'vd: {"targets":["assignee","managers"]}'}
                />

                <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                  {selectedPolicy.levels?.map((lv) => (
                    <div key={lv.id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {lv.level_name} ({lv.level_key})
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                        thứ tự={lv.sort_order} | {lv.trigger_type} {lv.trigger_minutes} phút | cooldown={lv.cooldown_minutes} phút | notify={getNotifyTypeLabel(lv.notify_type)}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => patchLevel(lv.id, { is_active: !lv.is_active })}>
                          {lv.is_active ? 'Bật' : 'Tắt'}
                        </button>
                        <button
                          className="btn-ghost"
                          style={{ padding: '2px 8px', fontSize: 11 }}
                          onClick={() => {
                            const next = prompt('Số phút kích hoạt', String(lv.trigger_minutes))
                            if (!next) return
                            patchLevel(lv.id, { trigger_minutes: Number(next) })
                          }}
                        >
                          Sửa trigger
                        </button>
                        <button
                          className="btn-ghost"
                          style={{ padding: '2px 8px', fontSize: 11 }}
                          onClick={() => {
                            const next = prompt('Cooldown (phút)', String(lv.cooldown_minutes))
                            if (!next) return
                            patchLevel(lv.id, { cooldown_minutes: Number(next) })
                          }}
                        >
                          Sửa cooldown
                        </button>
                        <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11, color: 'var(--red)' }} onClick={() => removeLevel(lv.id)}>
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 12, marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>Hướng dẫn sử dụng</div>
          <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setShowGuide((v) => !v)}>
            {showGuide ? 'Ẩn hướng dẫn' : 'Hiện hướng dẫn'}
          </button>
        </div>
        {showGuide && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
            <div><strong>Bảng này dùng để làm gì?</strong></div>
            <div>- Giúp hệ thống nhắc việc đúng hạn cho đội CSKH/Sales: sắp tới hạn thì cảnh báo, quá hạn thì escalte theo cấp.</div>
            <div>- Giúp quản lý không bỏ sót việc: ai đang trễ hạn, trễ bao lâu, và cần báo cho ai tiếp theo.</div>
            <div style={{ marginTop: 8 }}><strong>Cách dùng theo nghiệp vụ</strong></div>
            <div>1. Tạo <strong>Chính sách SLA</strong> cho từng nhóm công việc (ví dụ: chăm sóc lead mới, gửi khái toán, follow-up sau báo giá).</div>
            <div>2. Nhập <strong>Mục tiêu (phút)</strong>: đây là thời gian kỳ vọng phải xử lý xong công việc.</div>
            <div>3. Thêm các <strong>Cấp độ escalation</strong> để hệ thống tự nhắc:</div>
            <div>- Cảnh báo sớm trước hạn (ví dụ trước 30 phút).</div>
            <div>- Báo quá hạn sau hạn (ví dụ quá 15 phút, quá 60 phút...).</div>
            <div>4. Chọn <strong>người nhận thông báo</strong> theo từng cấp (người phụ trách, quản lý...).</div>
            <div>5. Bật/tắt policy hoặc level khi cần để áp dụng linh hoạt theo từng giai đoạn vận hành.</div>
            <div style={{ marginTop: 8 }}><strong>Gợi ý nhanh</strong></div>
            <div>- Team nhỏ: 1 policy chung + 2 level (trước hạn / quá hạn).</div>
            <div>- Team có quản lý: thêm level quá hạn nặng để báo lên quản lý.</div>
            <div>- Mùa cao điểm: giảm mục tiêu thời gian để nhắc sớm hơn.</div>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
