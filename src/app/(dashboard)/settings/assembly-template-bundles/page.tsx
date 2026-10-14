'use client'

import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'

type TaxonomyRow = {
  id: string
  kind: string
  value: string
  name: string
  description?: string | null
  sort_order: number
  is_active: boolean
}

type TemplateRow = {
  id: string
  template_code: string
  template_name: string
  template_type?: string | null
  room_type?: string | null
  version?: number | null
  is_active: boolean
}

type FormState = {
  id?: string
  value: string
  name: string
  sort_order: string
  is_active: boolean
  component_type: string
  space_type: string
  space_profile: string
  foundation_type: string
  opening_preset: string
  roof_preset: string
  stair_preset: string
  interior_preset: string
  facade_role: string
  template_codes: string[]
}

type ConflictRow = {
  left_id: string
  left_name: string
  right_id: string
  right_name: string
  score: number
  shared_component_type: string
  summary: string
  shared_template_codes: string[]
}

type RuleFieldKey =
  | 'space_type'
  | 'space_profile'
  | 'foundation_type'
  | 'opening_preset'
  | 'roof_preset'
  | 'stair_preset'
  | 'interior_preset'
  | 'facade_role'

const SPACE_PROFILE_OPTIONS = [
  { value: 'economy', label: 'Tiết kiệm' },
  { value: 'basic', label: 'Cơ bản' },
  { value: 'premium', label: 'Nâng cấp' },
  { value: 'utility', label: 'Phụ trợ / kỹ thuật' },
]

const FACADE_ROLE_OPTIONS = [
  { value: 'main_front', label: 'Mặt tiền chính' },
  { value: 'secondary_front', label: 'Mặt tiền phụ' },
  { value: 'side_left', label: 'Hông trái' },
  { value: 'side_right', label: 'Hông phải' },
  { value: 'rear', label: 'Mặt sau' },
  { value: 'interior', label: 'Khối bên trong' },
]

const COMPONENT_FIELD_MAP: Record<string, RuleFieldKey[]> = {
  room: ['space_type', 'space_profile', 'opening_preset', 'interior_preset', 'facade_role'],
  wall: ['opening_preset', 'facade_role'],
  foundation: ['foundation_type'],
  roof: ['roof_preset', 'facade_role'],
  tum: ['facade_role'],
  tum_roof: ['roof_preset', 'facade_role'],
  stair: ['stair_preset'],
}

function emptyForm(): FormState {
  return {
    value: '',
    name: '',
    sort_order: '0',
    is_active: true,
    component_type: '',
    space_type: '',
    space_profile: '',
    foundation_type: '',
    opening_preset: '',
    roof_preset: '',
    stair_preset: '',
    interior_preset: '',
    facade_role: '',
    template_codes: [],
  }
}

function parseDescription(description?: string | null) {
  const raw = String(description || '').trim()
  if (!raw || !raw.startsWith('{')) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {}
  return {}
}

function formFromRow(row: TaxonomyRow): FormState {
  const cfg = parseDescription(row.description)
  return {
    id: row.id,
    value: String(row.value || ''),
    name: String(row.name || ''),
    sort_order: String(row.sort_order ?? 0),
    is_active: row.is_active !== false,
    component_type: String(cfg.component_type || ''),
    space_type: String(cfg.space_type || ''),
    space_profile: String(cfg.space_profile || ''),
    foundation_type: String(cfg.foundation_type || ''),
    opening_preset: String(cfg.opening_preset || ''),
    roof_preset: String(cfg.roof_preset || ''),
    stair_preset: String(cfg.stair_preset || ''),
    interior_preset: String(cfg.interior_preset || ''),
    facade_role: String(cfg.facade_role || ''),
    template_codes: Array.isArray(cfg.template_codes) ? cfg.template_codes.map((x) => String(x || '')).filter(Boolean) : [],
  }
}

function descriptionFromForm(form: FormState) {
  const cfg: Record<string, unknown> = {}
  const allowedFieldKeys = getAllowedRuleFieldKeys(form.component_type)
  for (const key of ['component_type', 'space_type', 'space_profile', 'foundation_type', 'opening_preset', 'roof_preset', 'stair_preset', 'interior_preset', 'facade_role'] as const) {
    if (key !== 'component_type' && !allowedFieldKeys.includes(key)) continue
    const value = String(form[key] || '').trim()
    if (value) cfg[key] = value
  }
  if (form.template_codes.length > 0) cfg.template_codes = form.template_codes
  return JSON.stringify(cfg)
}

function slugify(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function autoValue(form: FormState) {
  const allowedFieldKeys = getAllowedRuleFieldKeys(form.component_type)
  const parts = [
    'bundle',
    form.component_type,
    allowedFieldKeys.includes('space_type') ? form.space_type : '',
    allowedFieldKeys.includes('space_profile') ? form.space_profile : '',
    allowedFieldKeys.includes('foundation_type') ? form.foundation_type : '',
    allowedFieldKeys.includes('opening_preset') ? form.opening_preset : '',
    allowedFieldKeys.includes('roof_preset') ? form.roof_preset : '',
    allowedFieldKeys.includes('stair_preset') ? form.stair_preset : '',
    allowedFieldKeys.includes('interior_preset') ? form.interior_preset : '',
    allowedFieldKeys.includes('facade_role') ? form.facade_role : '',
  ].map(slugify).filter(Boolean)
  return parts.join('_').slice(0, 120)
}

function normalizeKey(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function criteriaFromRow(row: TaxonomyRow) {
  const cfg = parseDescription(row.description)
  const out: Record<string, string> = {}
  for (const key of ['component_type', 'space_type', 'space_profile', 'foundation_type', 'opening_preset', 'roof_preset', 'stair_preset', 'interior_preset', 'facade_role'] as const) {
    const value = normalizeKey(cfg[key])
    if (value) out[key] = value
  }
  return out
}

function templateCodesFromRow(row: TaxonomyRow) {
  const cfg = parseDescription(row.description)
  return Array.isArray(cfg.template_codes)
    ? cfg.template_codes.map((x) => String(x || '').trim()).filter(Boolean)
    : []
}

function getAllowedRuleFieldKeys(componentType: string): RuleFieldKey[] {
  const normalized = normalizeKey(componentType)
  return COMPONENT_FIELD_MAP[normalized] || []
}

function sanitizeFormByComponent(form: FormState): FormState {
  const allowedFieldKeys = getAllowedRuleFieldKeys(form.component_type)
  const next = { ...form }
  const clearIfHidden = (key: RuleFieldKey) => {
    if (!allowedFieldKeys.includes(key)) next[key] = ''
  }
  clearIfHidden('space_type')
  clearIfHidden('space_profile')
  clearIfHidden('foundation_type')
  clearIfHidden('opening_preset')
  clearIfHidden('roof_preset')
  clearIfHidden('stair_preset')
  clearIfHidden('interior_preset')
  clearIfHidden('facade_role')
  return next
}

function analyzePotentialConflicts(rows: TaxonomyRow[]) {
  const activeRows = rows.filter((row) => row.kind === 'assembly_template_bundle_map' && row.is_active !== false)
  const conflicts: ConflictRow[] = []
  for (let i = 0; i < activeRows.length; i += 1) {
    const left = activeRows[i]
    const leftCriteria = criteriaFromRow(left)
    const leftEntries = Object.entries(leftCriteria)
    if (!leftEntries.length) continue
    for (let j = i + 1; j < activeRows.length; j += 1) {
      const right = activeRows[j]
      const rightCriteria = criteriaFromRow(right)
      const rightEntries = Object.entries(rightCriteria)
      if (!rightEntries.length) continue
      if (leftEntries.length !== rightEntries.length) continue

      let conflict = true
      const shared: string[] = []
      const allKeys = Array.from(new Set([...Object.keys(leftCriteria), ...Object.keys(rightCriteria)]))
      for (const key of allKeys) {
        const leftValue = leftCriteria[key]
        const rightValue = rightCriteria[key]
        if (leftValue && rightValue && leftValue !== rightValue) {
          conflict = false
          break
        }
        if (leftValue && rightValue && leftValue === rightValue) {
          shared.push(`${key}=${leftValue}`)
        }
      }
      if (!conflict) continue
      const leftTemplateCodes = templateCodesFromRow(left)
      const rightTemplateCodes = templateCodesFromRow(right)
      const sharedTemplateCodes = leftTemplateCodes.filter((code) => rightTemplateCodes.includes(code))
      conflicts.push({
        left_id: left.id,
        left_name: left.name,
        right_id: right.id,
        right_name: right.name,
        score: leftEntries.length,
        shared_component_type: leftCriteria.component_type || rightCriteria.component_type || '',
        summary: shared.join(' | '),
        shared_template_codes: Array.from(new Set(sharedTemplateCodes)),
      })
    }
  }
  return conflicts
}

export default function AssemblyTemplateBundlesPage() {
  const [items, setItems] = useState<TaxonomyRow[]>([])
  const [taxonomies, setTaxonomies] = useState<TaxonomyRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const [ruleSearch, setRuleSearch] = useState('')
  const [ruleComponentFilter, setRuleComponentFilter] = useState('')
  const [templateSearch, setTemplateSearch] = useState('')

  const groupedItems = useMemo(
    () => items
      .filter((row) => row.kind === 'assembly_template_bundle_map')
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || '').localeCompare(String(b.name || ''))),
    [items]
  )
  const filteredItems = useMemo(() => {
    const q = ruleSearch.trim().toLowerCase()
    return groupedItems.filter((item) => {
      const criteria = criteriaFromRow(item)
      if (ruleComponentFilter && normalizeKey(criteria.component_type) !== normalizeKey(ruleComponentFilter)) return false
      if (!q) return true
      const haystack = [
        item.name,
        item.value,
        String(item.description || ''),
        criteria.component_type,
        criteria.space_type,
        criteria.foundation_type,
        criteria.roof_preset,
      ].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [groupedItems, ruleSearch, ruleComponentFilter])
  const potentialConflicts = useMemo(
    () => analyzePotentialConflicts(groupedItems),
    [groupedItems]
  )

  const componentOptions = useMemo(() => taxonomies.filter((x) => x.kind === 'assembly_component_type' && x.is_active), [taxonomies])
  const roomTypeOptions = useMemo(() => taxonomies.filter((x) => x.kind === 'room_type' && x.is_active), [taxonomies])
  const foundationOptions = useMemo(() => taxonomies.filter((x) => x.kind === 'foundation_type' && x.is_active), [taxonomies])
  const openingOptions = useMemo(() => taxonomies.filter((x) => x.kind === 'opening_preset' && x.is_active), [taxonomies])
  const roofOptions = useMemo(() => taxonomies.filter((x) => x.kind === 'roof_preset' && x.is_active), [taxonomies])
  const stairOptions = useMemo(() => taxonomies.filter((x) => x.kind === 'stair_preset' && x.is_active), [taxonomies])
  const interiorOptions = useMemo(() => taxonomies.filter((x) => x.kind === 'interior_preset' && x.is_active), [taxonomies])

  const selectedTemplates = useMemo(
    () => templates.filter((row) => form.template_codes.includes(row.template_code)),
    [templates, form.template_codes]
  )
  const allowedFieldKeys = useMemo(
    () => getAllowedRuleFieldKeys(form.component_type),
    [form.component_type]
  )
  const visibleTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase()
    if (!q) return templates
    return templates.filter((tpl) => (
      `${tpl.template_name} ${tpl.template_code} ${tpl.template_type || ''} ${tpl.room_type || ''}`.toLowerCase().includes(q)
    ))
  }, [templates, templateSearch])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function loadData() {
    setLoading(true)
    const [taxRes, tplRes] = await Promise.all([
      fetch('/api/settings/estimate/taxonomies?active_only=false'),
      fetch('/api/settings/estimate/templates?active_only=true'),
    ])
    const taxJson = await taxRes.json().catch(() => ({}))
    const tplJson = await tplRes.json().catch(() => ({}))
    const taxRows = Array.isArray(taxJson?.data) ? taxJson.data : []
    const tplRows = Array.isArray(tplJson?.data) ? tplJson.data : []
    setTaxonomies(taxRows)
    setItems(taxRows)
    setTemplates(tplRows)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setForm(emptyForm())
      return
    }
    const hit = items.find((row) => row.id === selectedId)
    if (hit) setForm(sanitizeFormByComponent(formFromRow(hit)))
  }, [items, selectedId])

  async function saveForm() {
    if (!form.name.trim()) {
      showToast('Cần nhập tên rule')
      return
    }
    if (!form.component_type) {
      showToast('Cần chọn loại block')
      return
    }
    if (!form.template_codes.length) {
      showToast('Cần chọn ít nhất 1 template')
      return
    }

    const value = form.value.trim() || autoValue(form)
    if (!value) {
      showToast('Không thể tự sinh mã rule')
      return
    }

    setSaving(true)
    try {
      const payload = {
        kind: 'assembly_template_bundle_map',
        value,
        name: form.name.trim(),
        sort_order: Number(form.sort_order || 0) || 0,
        is_active: form.is_active,
        description: descriptionFromForm({ ...form, value }),
      }
      const res = await fetch(form.id ? `/api/settings/estimate/taxonomies/${form.id}` : '/api/settings/estimate/taxonomies', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(json?.error || 'Không lưu được rule')
        return
      }
      await loadData()
      if (json?.data?.id) setSelectedId(String(json.data.id))
      showToast(form.id ? 'Đã cập nhật rule' : 'Đã tạo rule mới')
    } finally {
      setSaving(false)
    }
  }

  async function removeCurrent() {
    if (!form.id) return
    if (!confirm('Bạn có chắc muốn xóa rule này?')) return
    await fetch(`/api/settings/estimate/taxonomies/${form.id}`, { method: 'DELETE' })
    setSelectedId('')
    setForm(emptyForm())
    await loadData()
    showToast('Đã xóa rule')
  }

  function toggleTemplateCode(code: string) {
    setForm((prev) => ({
      ...prev,
      template_codes: prev.template_codes.includes(code)
        ? prev.template_codes.filter((x) => x !== code)
        : [...prev.template_codes, code],
    }))
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>ASSEMBLY TEMPLATE BUNDLES</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Rule ghép Block -&gt; Template</h1>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>
          Cấu hình mềm để hệ thống tự nhận biết block nào nên kéo thêm template nào trước khi chạy dự toán.
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Hướng dẫn sử dụng</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Trang này giúp nối ngữ nghĩa của block với bộ template dự toán, không cần sửa code.</div>
          </div>
          <button className="btn btn-ghost" onClick={() => setShowGuide((v) => !v)} style={{ borderRadius: 10 }}>
            {showGuide ? 'Ẩn hướng dẫn' : 'Hiện hướng dẫn'}
          </button>
        </div>
        {showGuide && (
          <div style={{ marginTop: 12, display: 'grid', gap: 8, fontSize: 13, color: 'var(--text2)' }}>
            <div>Loại block là điều kiện gốc. Sau đó có thể bổ sung thêm loại phòng, loại móng, preset mái, preset nội thất...</div>
            <div>Mỗi rule có thể gắn 1 hoặc nhiều template. Khi block match rule, các template đó sẽ được ép vào preview estimate.</div>
            <div>Nếu có nhiều rule cùng match, hệ thống ưu tiên rule có nhiều điều kiện khớp hơn.</div>
            <div>Ví dụ: block phòng + space_type=bedroom -&gt; kéo template phòng ngủ. Block mái + roof_preset=thai_basic -&gt; kéo template mái Thái.</div>
          </div>
        )}
      </div>

      {!loading && potentialConflicts.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 14, border: '1px solid rgba(239,68,68,.28)', background: 'rgba(239,68,68,.06)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: 'var(--red)' }}>Cảnh báo xung đột rule</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
            Các cặp rule dưới đây có cùng độ đặc hiệu và có thể cùng match một block. Khi đó hệ thống sẽ coi là đồng hạng.
          </div>
          <div style={{ display: 'grid', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
            {potentialConflicts.map((row) => (
              <div key={`${row.left_id}-${row.right_id}`} style={{ border: '1px solid rgba(239,68,68,.22)', borderRadius: 10, padding: 10, background: 'rgba(15,23,42,.22)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{row.left_name} <span style={{ color: 'var(--text4)' }}>vs</span> {row.right_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  Loại block: {row.shared_component_type || '-'} | Điểm match: {row.score}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text4)', marginTop: 4 }}>
                  Điều kiện trùng: {row.summary || 'Có thể cùng match theo cùng mức đặc hiệu'}
                </div>
                <div style={{ fontSize: 12, color: row.shared_template_codes.length ? 'var(--orange)' : 'var(--text4)', marginTop: 4 }}>
                  Template trùng: {row.shared_template_codes.length ? row.shared_template_codes.join(', ') : 'Không trùng template, nhưng vẫn có thể cùng match block'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: 28, textAlign: 'center', color: 'var(--text3)' }}>Đang tải rule...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 14 }}>
          <div className="card" style={{ padding: 14, display: 'grid', gap: 12, alignSelf: 'start' }}>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setSelectedId('')
                setForm(emptyForm())
              }}
              style={{ borderRadius: 10 }}
            >
              + Tạo rule mới
            </button>

            <div>
              <label style={labelStyle}>Tìm rule</label>
              <input
                className="input"
                value={ruleSearch}
                onChange={(e) => setRuleSearch(e.target.value)}
                placeholder="Tìm theo tên, mã rule, điều kiện..."
              />
            </div>

            <div>
              <label style={labelStyle}>Lọc theo loại block</label>
              <select className="select" value={ruleComponentFilter} onChange={(e) => setRuleComponentFilter(e.target.value)}>
                <option value="">(tất cả)</option>
                {componentOptions.map((x) => <option key={x.id} value={x.value}>{x.name} ({x.value})</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {filteredItems.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có rule nào.</div>
              ) : filteredItems.map((item) => {
                const parsed = parseDescription(item.description)
                const chip = [
                  String(parsed.component_type || ''),
                  String(parsed.space_type || ''),
                  String(parsed.foundation_type || ''),
                  String(parsed.roof_preset || ''),
                ].filter(Boolean).join(' | ')
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    style={{
                      textAlign: 'left',
                      border: item.id === selectedId ? '1px solid var(--orange)' : '1px solid var(--border)',
                      background: item.id === selectedId ? 'rgba(249,115,22,.08)' : 'rgba(255,255,255,.02)',
                      borderRadius: 10,
                      padding: 10,
                      cursor: 'pointer',
                      color: 'var(--text)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: item.is_active ? 'var(--green)' : 'var(--text4)' }}>
                        {item.is_active ? 'Đang dùng' : 'Đã tắt'}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{item.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 4 }}>{chip || 'Rule tổng quát'}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{form.id ? 'Sửa rule' : 'Tạo rule mới'}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Rule này được lưu dưới taxonomy kind `assembly_template_bundle_map`.</div>
              </div>
              {form.id && (
                <button className="btn btn-ghost" onClick={removeCurrent} style={{ borderRadius: 10, color: 'var(--red)' }}>
                  Xóa rule
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <div>
                <label style={labelStyle}>Tên rule</label>
                <input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="VD: Phòng ngủ cơ bản -> template phòng ngủ" />
              </div>
              <div>
                <label style={labelStyle}>Mã rule</label>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input className="input" value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} placeholder="Để trống để tự sinh" />
                  <button
                    className="btn btn-ghost"
                    onClick={() => setForm((p) => ({ ...p, value: autoValue(p) }))}
                    style={{ borderRadius: 10, whiteSpace: 'nowrap' }}
                  >
                    Tự sinh
                  </button>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Thứ tự</label>
                <input className="input" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} placeholder="0" />
              </div>
              <div style={{ display: 'flex', alignItems: 'end' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text2)' }}>
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
                  Đang kích hoạt
                </label>
              </div>

              <div>
                <label style={labelStyle}>Loại block</label>
                <select
                  className="select"
                  value={form.component_type}
                  onChange={(e) => setForm((p) => sanitizeFormByComponent({ ...p, component_type: e.target.value }))}
                >
                  <option value="">(chọn loại block)</option>
                  {componentOptions.map((x) => <option key={x.id} value={x.value}>{x.name} ({x.value})</option>)}
                </select>
              </div>
              {allowedFieldKeys.includes('space_type') && (
                <div>
                  <label style={labelStyle}>Loại phòng / không gian</label>
                  <select className="select" value={form.space_type} onChange={(e) => setForm((p) => ({ ...p, space_type: e.target.value }))}>
                    <option value="">(không dùng)</option>
                    {roomTypeOptions.map((x) => <option key={x.id} value={x.value}>{x.name} ({x.value})</option>)}
                  </select>
                </div>
              )}

              {allowedFieldKeys.includes('space_profile') && (
                <div>
                  <label style={labelStyle}>Mức không gian</label>
                  <select className="select" value={form.space_profile} onChange={(e) => setForm((p) => ({ ...p, space_profile: e.target.value }))}>
                    <option value="">(không dùng)</option>
                    {SPACE_PROFILE_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label} ({x.value})</option>)}
                  </select>
                </div>
              )}

              {allowedFieldKeys.includes('foundation_type') && (
                <div>
                  <label style={labelStyle}>Loại móng</label>
                  <select className="select" value={form.foundation_type} onChange={(e) => setForm((p) => ({ ...p, foundation_type: e.target.value }))}>
                    <option value="">(không dùng)</option>
                    {foundationOptions.map((x) => <option key={x.id} value={x.value}>{x.name} ({x.value})</option>)}
                  </select>
                </div>
              )}

              {allowedFieldKeys.includes('opening_preset') && (
                <div>
                  <label style={labelStyle}>Preset ô mở</label>
                  <select className="select" value={form.opening_preset} onChange={(e) => setForm((p) => ({ ...p, opening_preset: e.target.value }))}>
                    <option value="">(không dùng)</option>
                    {openingOptions.map((x) => <option key={x.id} value={x.value}>{x.name} ({x.value})</option>)}
                  </select>
                </div>
              )}

              {allowedFieldKeys.includes('roof_preset') && (
                <div>
                  <label style={labelStyle}>Preset mái</label>
                  <select className="select" value={form.roof_preset} onChange={(e) => setForm((p) => ({ ...p, roof_preset: e.target.value }))}>
                    <option value="">(không dùng)</option>
                    {roofOptions.map((x) => <option key={x.id} value={x.value}>{x.name} ({x.value})</option>)}
                  </select>
                </div>
              )}

              {allowedFieldKeys.includes('stair_preset') && (
                <div>
                  <label style={labelStyle}>Preset cầu thang</label>
                  <select className="select" value={form.stair_preset} onChange={(e) => setForm((p) => ({ ...p, stair_preset: e.target.value }))}>
                    <option value="">(không dùng)</option>
                    {stairOptions.map((x) => <option key={x.id} value={x.value}>{x.name} ({x.value})</option>)}
                  </select>
                </div>
              )}

              {allowedFieldKeys.includes('interior_preset') && (
                <div>
                  <label style={labelStyle}>Preset nội thất</label>
                  <select className="select" value={form.interior_preset} onChange={(e) => setForm((p) => ({ ...p, interior_preset: e.target.value }))}>
                    <option value="">(không dùng)</option>
                    {interiorOptions.map((x) => <option key={x.id} value={x.value}>{x.name} ({x.value})</option>)}
                  </select>
                </div>
              )}

              {allowedFieldKeys.includes('facade_role') && (
                <div>
                  <label style={labelStyle}>Vai trò mặt tiền</label>
                  <select className="select" value={form.facade_role} onChange={(e) => setForm((p) => ({ ...p, facade_role: e.target.value }))}>
                    <option value="">(không dùng)</option>
                    {FACADE_ROLE_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label} ({x.value})</option>)}
                  </select>
                </div>
              )}
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Template sẽ được ép vào dự toán</div>
              <div style={{ marginBottom: 8 }}>
                <label style={labelStyle}>Tìm template</label>
                <input
                  className="input"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Tìm theo tên template, mã template, scope..."
                />
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, maxHeight: 260, overflowY: 'auto', padding: 10, display: 'grid', gap: 8 }}>
                {visibleTemplates.map((tpl) => (
                  <label key={tpl.id} style={{ display: 'grid', gridTemplateColumns: '18px minmax(0,1fr)', gap: 8, alignItems: 'start', fontSize: 12, color: 'var(--text2)' }}>
                    <input type="checkbox" checked={form.template_codes.includes(tpl.template_code)} onChange={() => toggleTemplateCode(tpl.template_code)} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{tpl.template_name}</div>
                      <div style={{ color: 'var(--text4)', fontSize: 11 }}>
                        {tpl.template_code} | {String(tpl.template_type || '-')} | {tpl.room_type ? `scope ${tpl.room_type}` : 'không scope'} | v{Number(tpl.version || 1)}
                      </div>
                    </div>
                  </label>
                ))}
                {visibleTemplates.length === 0 && (
                  <div style={{ color: 'var(--text4)', fontSize: 12 }}>Không tìm thấy template phù hợp.</div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Xem nhanh rule</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 12 }}>
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'rgba(255,255,255,.02)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Điều kiện đang bật</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      form.component_type && `block=${form.component_type}`,
                      form.space_type && `space=${form.space_type}`,
                      form.space_profile && `profile=${form.space_profile}`,
                      form.foundation_type && `mong=${form.foundation_type}`,
                      form.opening_preset && `opening=${form.opening_preset}`,
                      form.roof_preset && `roof=${form.roof_preset}`,
                      form.stair_preset && `stair=${form.stair_preset}`,
                      form.interior_preset && `interior=${form.interior_preset}`,
                      form.facade_role && `facade=${form.facade_role}`,
                    ].filter(Boolean).map((chip) => (
                      <div key={chip} style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(59,130,246,.12)', color: 'var(--text2)', fontSize: 12 }}>
                        {chip}
                      </div>
                    ))}
                    {![
                      form.component_type, form.space_type, form.space_profile, form.foundation_type,
                      form.opening_preset, form.roof_preset, form.stair_preset, form.interior_preset, form.facade_role,
                    ].some(Boolean) ? (
                      <div style={{ color: 'var(--text4)', fontSize: 12 }}>Chưa có điều kiện nào.</div>
                    ) : null}
                  </div>
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'rgba(255,255,255,.02)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Template đang chọn</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {selectedTemplates.length ? selectedTemplates.map((tpl) => (
                      <div key={tpl.id} style={{ fontSize: 12, color: 'var(--text2)' }}>
                        <div style={{ fontWeight: 700 }}>{tpl.template_name}</div>
                        <div style={{ color: 'var(--text4)', fontSize: 11 }}>{tpl.template_code}</div>
                      </div>
                    )) : (
                      <div style={{ color: 'var(--text4)', fontSize: 12 }}>Chưa chọn template nào.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={saveForm} disabled={saving}>
                {saving ? 'Đang lưu...' : form.id ? 'Lưu thay đổi' : 'Tạo rule'}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setSelectedId('')
                  setForm(emptyForm())
                }}
                style={{ borderRadius: 10 }}
              >
                Làm mới form
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', zIndex: 1000 }}>
          {toast}
        </div>
      )}
    </div>
  )
}

const labelStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--text3)',
  display: 'block',
  marginBottom: 6,
}
