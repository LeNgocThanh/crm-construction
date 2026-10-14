'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type QuoteItem = {
  id: string
  material_key: string
  material_name: string | null
  unit: string | null
  quantity: number | null
  unit_price: number | null
  cost: number
  note?: string | null
}

type TemplateGroup = {
  template_key: string
  template_code: string
  version: number
  template_name: string
  template_type: string | null
  template_id: string | null
  subtotal_cost: number
  items: QuoteItem[]
}

type QuoteData = {
  id: string
  total_cost: number
  subtotal_cost: number
  region_code: string
  quote_date: string
  floors?: number | null
  tum_count?: number | null
  basement_count?: number | null
  finish_level?: string | null
  input_snapshot?: Record<string, any>
  template_groups: TemplateGroup[]
}

type TemplateOption = {
  id: string
  template_code: string
  template_name: string
  template_type: string
  version: number
  is_active: boolean
}

type SupplierOption = {
  value: string
  name: string
}

function normalizeKey(v: unknown) {
  return String(v || '').trim().toLowerCase()
}

function mergeSupplierOptions(
  taxonomyRows: any[],
  supplierRows: any[]
) {
  const map = new Map<string, SupplierOption>()

  for (const x of taxonomyRows || []) {
    const value = String(x?.value || '').trim()
    if (!value) continue
    const k = normalizeKey(value)
    map.set(k, { value, name: String(x?.name || value) })
  }

  for (const x of supplierRows || []) {
    const code = String(x?.supplier_code || '').trim()
    const name = String(x?.supplier_name || '').trim()
    if (!code) continue
    const k = normalizeKey(code)
    map.set(k, { value: code, name: name || code })
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
}

type RecomputeData = {
  quote_id: string
  template_key: string
  old_template: {
    template_id: string
    template_code: string
    template_name: string
    template_type: string
    version: number
  }
  new_template: {
    template_id: string
    template_code: string
    template_name: string
    template_type: string
    version: number
  }
  old_group_subtotal: number
  new_group_subtotal: number
  totals: {
    old_subtotal: number
    new_subtotal: number
    old_total: number
    new_total: number
  }
  old_group_items: QuoteItem[]
  new_group_items: QuoteItem[]
  warnings: string[]
}

export default function EstimateResultV2DetailPage() {
  const params = useParams<{ id: string }>()
  const quoteId = String(params?.id || '')

  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState('')
  const [toast, setToast] = useState('')
  const [quote, setQuote] = useState<QuoteData | null>(null)
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [replacementByGroup, setReplacementByGroup] = useState<Record<string, string>>({})
  const [supplierOverridesByGroup, setSupplierOverridesByGroup] = useState<Record<string, Record<string, string>>>({})
  const [recomputeByGroup, setRecomputeByGroup] = useState<Record<string, RecomputeData>>({})

  useEffect(() => {
    if (!quoteId) return
    loadAll()
  }, [quoteId])

  async function loadAll() {
    setLoading(true)
    try {
      const [qRes, tRes, txSupRes, supRes] = await Promise.all([
        fetch(`/api/estimates/v2/${quoteId}`),
        fetch('/api/settings/estimate/templates?active_only=true'),
        fetch('/api/settings/estimate/taxonomies?active_only=true&kind=supplier'),
        fetch('/api/settings/suppliers?active_only=true'),
      ])
      const qJson = await qRes.json()
      const tJson = await tRes.json()
      const txSupJson = await txSupRes.json()
      const supJson = await supRes.json()

      if (!qRes.ok) {
        showToast(qJson?.error || 'Không tải được chi tiết kết quả')
        setLoading(false)
        return
      }

      setQuote(qJson.data || null)
      setTemplates(Array.isArray(tJson.data) ? tJson.data : [])
      setSuppliers(
        mergeSupplierOptions(
          Array.isArray(txSupJson.data) ? txSupJson.data : [],
          Array.isArray(supJson.data) ? supJson.data : []
        )
      )

      const defaultReplace: Record<string, string> = {}
      const defaultOverrides: Record<string, Record<string, string>> = {}
      for (const g of (qJson.data?.template_groups || [])) {
        defaultReplace[g.template_key] = g.template_id || ''
        defaultOverrides[g.template_key] = {}
      }
      setReplacementByGroup(defaultReplace)
      setSupplierOverridesByGroup(defaultOverrides)
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }

  function getTemplateCandidates(group: TemplateGroup) {
    const typeKey = String(group.template_type || '').trim().toLowerCase()
    return templates.filter((x) => String(x.template_type || '').trim().toLowerCase() === typeKey)
  }

  function setSupplierOverride(groupKey: string, materialKey: string, supplierKey: string) {
    setSupplierOverridesByGroup((prev) => ({
      ...prev,
      [groupKey]: {
        ...(prev[groupKey] || {}),
        [materialKey]: supplierKey,
      },
    }))
  }

  async function recomputeOneGroup(group: TemplateGroup) {
    if (!quote) return
    const replacementTemplateId = replacementByGroup[group.template_key] || ''
    const supplierOverrides = supplierOverridesByGroup[group.template_key] || {}
    setBusyKey(group.template_key)
    try {
      const r = await fetch(`/api/estimates/v2/${quote.id}/recompute-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_key: group.template_key,
          replacement_template_id: replacementTemplateId || null,
          supplier_overrides: supplierOverrides,
        }),
      })
      const j = await r.json()
      if (!r.ok) {
        showToast(j?.error || 'Không tính lại được template')
        return
      }
      setRecomputeByGroup((prev) => ({
        ...prev,
        [group.template_key]: j.data,
      }))
      showToast(`Đã tính lại riêng template ${group.template_name}`)
    } finally {
      setBusyKey('')
    }
  }

  const recomputeSummary = useMemo(() => {
    const rows = Object.values(recomputeByGroup)
    if (!rows.length) return null
    const latest = rows[rows.length - 1]
    return latest.totals
  }, [recomputeByGroup])

  const input = (quote?.input_snapshot || {}) as Record<string, any>
  const inputRows: Array<{ label: string; value: string }> = [
    { label: 'Mã khách hàng', value: input.customer_id ? String(input.customer_id) : '-' },
    { label: 'Mã vùng', value: input.region_code ? String(input.region_code) : String(quote?.region_code || 'ALL') },
    { label: 'Chiều dài xây dựng (m)', value: input.build_length_m != null ? String(input.build_length_m) : '-' },
    { label: 'Chiều rộng xây dựng (m)', value: input.build_width_m != null ? String(input.build_width_m) : '-' },
    { label: 'Số tầng', value: input.floors != null ? String(input.floors) : String(quote?.floors ?? '-') },
    { label: 'Số tum', value: input.tum_count != null ? String(input.tum_count) : String(quote?.tum_count ?? 0) },
    { label: 'Số tầng hầm', value: input.basement_count != null ? String(input.basement_count) : String(quote?.basement_count ?? 0) },
    { label: 'Chiều cao tầng (m)', value: input.floor_height_m != null ? String(input.floor_height_m) : 'Mặc định' },
    { label: 'Diện tích hộc thang (m2)', value: input.stair_void_area != null ? String(input.stair_void_area) : 'Mặc định' },
    { label: 'Chu vi WC trung bình (m)', value: input.wc_perimeter_m != null ? String(input.wc_perimeter_m) : 'Mặc định' },
    { label: 'Mức hoàn thiện', value: input.finish_level ? String(input.finish_level) : String(quote?.finish_level || 'tieu_chuan') },
    { label: 'Loại nhà', value: input.house_type ? String(input.house_type) : '-' },
    { label: 'Phong cách', value: input.style ? String(input.style) : 'mac_dinh' },
    { label: 'Loại móng', value: input.foundation_type ? String(input.foundation_type) : 'mong_bang' },
    { label: 'Phòng ngủ', value: input.bedroom_count != null ? String(input.bedroom_count) : '0' },
    { label: 'WC', value: input.wc_count != null ? String(input.wc_count) : '0' },
    { label: 'Bếp', value: input.kitchen_count != null ? String(input.kitchen_count) : '0' },
    { label: 'Phòng khách', value: input.living_room_count != null ? String(input.living_room_count) : '0' },
    { label: 'Đơn giá cơ sở/m2', value: input.base_cost_per_m2 != null ? String(input.base_cost_per_m2) : '-' },
    { label: 'Pricing policy', value: input.pricing_policy ? String(input.pricing_policy) : 'standard' },
    { label: 'NCC ưu tiên', value: input.preferred_supplier_key ? String(input.preferred_supplier_key) : 'ALL' },
    { label: 'Supplier match mode', value: input.supplier_match_mode ? String(input.supplier_match_mode) : 'preferred_first' },
    { label: 'Template apply mode', value: input.template_apply_mode ? String(input.template_apply_mode) : 'auto' },
  ]

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <span className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    )
  }

  if (!quote) {
    return <div className="card" style={{ padding: 14 }}>Không có dữ liệu kết quả.</div>
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
          ESTIMATE RESULT V2
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
          Kết quả chi tiết dự toán sơ bộ
        </h1>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          Hiển thị đầy đủ dữ liệu đầu vào và cho phép thay template cùng loại, đổi NCC theo từng vật tư để tính lại riêng từng hạng mục.
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Mã quote: <span style={{ color: 'var(--text)' }}>{quote.id}</span></div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Tổng hiện tại: <span style={{ color: 'var(--green)' }}>{Number(quote.total_cost || 0).toLocaleString('vi-VN')}đ</span></div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Tạm tính vật tư: <span style={{ color: 'var(--blue)' }}>{Number(quote.subtotal_cost || 0).toLocaleString('vi-VN')}đ</span></div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Vùng: <span style={{ color: 'var(--text)' }}>{quote.region_code || 'ALL'}</span></div>
        </div>
        {recomputeSummary && (
          <div style={{ marginTop: 10, borderTop: '1px dashed var(--border)', paddingTop: 10, fontSize: 12, color: 'var(--text2)' }}>
            Kết quả tính lại gần nhất: subtotal {Number(recomputeSummary.new_subtotal || 0).toLocaleString('vi-VN')}đ, total {Number(recomputeSummary.new_total || 0).toLocaleString('vi-VN')}đ
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700, marginBottom: 8 }}>
          Thông tin đầu vào dùng để tạo dự toán
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {inputRows.map((x) => (
            <div key={x.label} style={{ fontSize: 12, color: 'var(--text2)' }}>
              {x.label}: <span style={{ color: 'var(--blue)' }}>{x.value}</span>
            </div>
          ))}
        </div>
      </div>

      {(quote.template_groups || []).map((group) => {
        const candidates = getTemplateCandidates(group)
        const recomputed = recomputeByGroup[group.template_key] || null
        const supplierOverrides = supplierOverridesByGroup[group.template_key] || {}
        const rows = recomputed ? recomputed.new_group_items : group.items
        const subtotal = recomputed ? recomputed.new_group_subtotal : group.subtotal_cost
        return (
          <div key={group.template_key} className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>
                  {group.template_name} <span style={{ color: 'var(--text4)', fontSize: 11 }}>({group.template_key})</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  Type: <span style={{ color: 'var(--blue)' }}>{group.template_type || '-'}</span>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>
                {Number(subtotal || 0).toLocaleString('vi-VN')}đ
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Thay template cùng type</label>
                <select
                  className="select"
                  value={replacementByGroup[group.template_key] || ''}
                  onChange={(e) => setReplacementByGroup((prev) => ({ ...prev, [group.template_key]: e.target.value }))}
                >
                  {candidates.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.template_name} ({x.template_code}@v{x.version})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'end' }}>
                Chỉ tính lại nhóm template này
              </div>
              <div style={{ display: 'flex', alignItems: 'end' }}>
                <button
                  className="btn-primary"
                  disabled={busyKey === group.template_key}
                  onClick={() => recomputeOneGroup(group)}
                >
                  {busyKey === group.template_key ? 'Đang tính...' : 'Tính lại template này'}
                </button>
              </div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr .9fr .9fr .9fr 1fr', gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--border)', background: 'rgba(148,163,184,.08)' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>Vật tư</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>Số lượng</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>Đơn giá</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>Thành tiền</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>NCC override</div>
              </div>
              {rows.map((it, idx) => (
                <div key={`${group.template_key}-${it.id || idx}`} style={{ display: 'grid', gridTemplateColumns: '1.6fr .9fr .9fr .9fr 1fr', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--text)' }}>
                    {it.material_key} {it.material_name ? `- ${it.material_name}` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{it.quantity != null ? Number(it.quantity).toFixed(2) : '-'}</div>
                  <div style={{ fontSize: 12, color: it.unit_price == null ? 'var(--red)' : 'var(--text2)' }}>
                    {it.unit_price != null ? Number(it.unit_price).toLocaleString('vi-VN') : 'THIẾU GIÁ'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{Number(it.cost || 0).toLocaleString('vi-VN')}đ</div>
                  <div>
                    <select
                      className="select"
                      value={supplierOverrides[it.material_key] || ''}
                      onChange={(e) => setSupplierOverride(group.template_key, it.material_key, e.target.value)}
                    >
                      <option value="">(Giữ theo đơn giá hiện tại/policy)</option>
                      {suppliers.map((s) => (
                        <option key={`${group.template_key}-${it.material_key}-${s.value}`} value={s.value}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            {recomputed?.warnings?.length ? (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--orange)' }}>
                {recomputed.warnings.map((w, i) => (
                  <div key={`${w}-${i}`}>- {w}</div>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}

      {toast && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
