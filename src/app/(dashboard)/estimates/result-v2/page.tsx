'use client'

import { useEffect, useMemo, useState } from 'react'

type QuoteItem = {
  id?: string
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

type TemplateOption = {
  id: string
  template_code: string
  template_name: string
  template_type: string
  version: number
}

type SupplierOption = {
  value: string
  name: string
}

type RecomputeData = {
  template_key: string
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

type PreviewContext = {
  result: any
  payload: Record<string, any>
}

const STORAGE_KEY = 'estimate_v2_preview_context'

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

function normalizeTemplateKey(v: unknown) {
  const raw = String(v || '').trim().toLowerCase()
  if (!raw) return ''
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['"`]/g, '')
    .replace(/\s+/g, '_')
}

function parseTemplateNote(note: unknown) {
  const raw = String(note || '').trim()
  if (!raw.startsWith('template:')) return null
  const body = raw.slice('template:'.length).trim()
  if (!body) return null
  const [codeVerRaw, nameRaw] = body.split('|')
  const codeVer = String(codeVerRaw || '').trim()
  const at = codeVer.indexOf('@v')
  if (at < 0) return null
  const templateCode = codeVer.slice(0, at).trim()
  const version = Number(codeVer.slice(at + 2).trim())
  if (!templateCode || !Number.isFinite(version)) return null
  return {
    template_key: `${templateCode}@v${version}`,
    template_code: templateCode,
    version,
    template_name: String(nameRaw || '').trim() || templateCode,
  }
}

function groupPreviewByTemplate(items: QuoteItem[], templates: TemplateOption[]) {
  const map = new Map<string, TemplateGroup>()
  const tmplMap = new Map<string, TemplateOption>()
  for (const t of templates) tmplMap.set(`${t.template_code}@v${t.version}`, t)

  for (const it of items || []) {
    const parsed = parseTemplateNote(it.note)
    if (!parsed) continue
    if (!map.has(parsed.template_key)) {
      const matched = tmplMap.get(parsed.template_key)
      map.set(parsed.template_key, {
        template_key: parsed.template_key,
        template_code: parsed.template_code,
        version: parsed.version,
        template_name: matched?.template_name || parsed.template_name,
        template_type: matched?.template_type || null,
        template_id: matched?.id || null,
        subtotal_cost: 0,
        items: [],
      })
    }
    const g = map.get(parsed.template_key)!
    g.items.push(it)
    g.subtotal_cost += Number(it.cost || 0)
  }
  return Array.from(map.values()).sort((a, b) => b.subtotal_cost - a.subtotal_cost)
}

export default function EstimateResultV2PreviewPage() {
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState('')
  const [toast, setToast] = useState('')
  const [preview, setPreview] = useState<PreviewContext | null>(null)
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [groups, setGroups] = useState<TemplateGroup[]>([])
  const [replacementByGroup, setReplacementByGroup] = useState<Record<string, string>>({})
  const [supplierOverridesByGroup, setSupplierOverridesByGroup] = useState<Record<string, Record<string, string>>>({})
  const [recomputeByGroup, setRecomputeByGroup] = useState<Record<string, RecomputeData>>({})

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(STORAGE_KEY) : null
      const ctx = raw ? (JSON.parse(raw) as PreviewContext) : null
      if (!ctx?.result || !ctx?.payload) {
        setPreview(null)
        setLoading(false)
        return
      }

      const [tRes, txSupRes, supRes] = await Promise.all([
        fetch('/api/settings/estimate/templates?active_only=true'),
        fetch('/api/settings/estimate/taxonomies?active_only=true&kind=supplier'),
        fetch('/api/settings/suppliers?active_only=true'),
      ])
      const tJson = await tRes.json()
      const txSupJson = await txSupRes.json()
      const supJson = await supRes.json()

      const templateRows: TemplateOption[] = Array.isArray(tJson.data) ? tJson.data : []
      const supplierRows = mergeSupplierOptions(
        Array.isArray(txSupJson.data) ? txSupJson.data : [],
        Array.isArray(supJson.data) ? supJson.data : []
      )

      const grouped = groupPreviewByTemplate((ctx.result?.items || []) as QuoteItem[], templateRows)
      const replacement: Record<string, string> = {}
      const overrides: Record<string, Record<string, string>> = {}
      for (const g of grouped) {
        replacement[g.template_key] = g.template_id || ''
        overrides[g.template_key] = {}
      }

      setPreview(ctx)
      setTemplates(templateRows)
      setSuppliers(supplierRows)
      setGroups(grouped)
      setReplacementByGroup(replacement)
      setSupplierOverridesByGroup(overrides)
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }

  function getCandidates(group: TemplateGroup) {
    const typeKey = normalizeTemplateKey(group.template_type)
    if (!typeKey) return []
    return templates.filter((x) => normalizeTemplateKey(x.template_type) === typeKey)
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
    if (!preview) return
    setBusyKey(group.template_key)
    try {
      const r = await fetch('/api/estimates/v2/recompute-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preview_result: preview.result,
          input_payload: preview.payload,
          template_key: group.template_key,
          replacement_template_id: replacementByGroup[group.template_key] || null,
          supplier_overrides: supplierOverridesByGroup[group.template_key] || {},
        }),
      })
      const j = await r.json()
      if (!r.ok) {
        showToast(j?.error || 'Khong the tinh lai template preview')
        return
      }
      setRecomputeByGroup((prev) => ({
        ...prev,
        [group.template_key]: j.data,
      }))
      showToast(`Da tinh lai template ${group.template_name}`)
    } finally {
      setBusyKey('')
    }
  }

  const recomputeSummary = useMemo(() => {
    const rows = Object.values(recomputeByGroup)
    if (!rows.length) return null
    return rows[rows.length - 1].totals
  }, [recomputeByGroup])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <span className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    )
  }

  if (!preview) {
    return (
      <div className="card" style={{ padding: 14 }}>
        Khong co du lieu preview. Hay quay lai /estimates/generate-v2 va bam mo trang chi tiet preview.
      </div>
    )
  }

  const currentTotal = Number(preview.result?.total_cost || 0)
  const currentSubtotal = Number(preview.result?.subtotal_cost || 0)
  const input = (preview?.payload || {}) as Record<string, any>

  const inputRows: Array<{ label: string; value: string }> = [
    { label: 'Mã khách hàng', value: input.customer_id ? String(input.customer_id) : '-' },
    { label: 'Mã vùng', value: input.region_code ? String(input.region_code) : 'ALL' },
    { label: 'Chiều dài xây dựng (m)', value: input.build_length_m != null ? String(input.build_length_m) : '-' },
    { label: 'Chiều rộng xây dựng (m)', value: input.build_width_m != null ? String(input.build_width_m) : '-' },
    { label: 'Số tầng', value: input.floors != null ? String(input.floors) : '-' },
    { label: 'Số tum', value: input.tum_count != null ? String(input.tum_count) : '0' },
    { label: 'Số tầng hầm', value: input.basement_count != null ? String(input.basement_count) : '0' },
    { label: 'Chiều cao tầng (m)', value: input.floor_height_m != null ? String(input.floor_height_m) : 'Mặc định' },
    { label: 'Diện tích hộc thang (m2)', value: input.stair_void_area != null ? String(input.stair_void_area) : 'Mặc định' },
    { label: 'Chu vi WC trung bình (m)', value: input.wc_perimeter_m != null ? String(input.wc_perimeter_m) : 'Mặc định' },
    { label: 'Mức hoàn thiện', value: input.finish_level ? String(input.finish_level) : 'tieu_chuan' },
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

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
          ESTIMATE RESULT V2 (PREVIEW)
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
          Kết quả chi tiết dự toán sơ bộ (chưa lưu DB)
        </h1>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Tong preview hien tai: <span style={{ color: 'var(--green)' }}>{currentTotal.toLocaleString('vi-VN')}đ</span></div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Subtotal vat tu: <span style={{ color: 'var(--blue)' }}>{currentSubtotal.toLocaleString('vi-VN')}đ</span></div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Trang thai: <span style={{ color: 'var(--orange)' }}>Preview</span></div>
        </div>
        {recomputeSummary && (
          <div style={{ marginTop: 10, borderTop: '1px dashed var(--border)', paddingTop: 10, fontSize: 12, color: 'var(--text2)' }}>
            Ket qua tinh lai gan nhat: subtotal {Number(recomputeSummary.new_subtotal || 0).toLocaleString('vi-VN')}đ, total {Number(recomputeSummary.new_total || 0).toLocaleString('vi-VN')}đ
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700, marginBottom: 8 }}>
          Thông tin đầu vào từ /estimates/generate-v2
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {inputRows.map((x) => (
            <div key={x.label} style={{ fontSize: 12, color: 'var(--text2)' }}>
              {x.label}: <span style={{ color: 'var(--blue)' }}>{x.value}</span>
            </div>
          ))}
        </div>
      </div>

      {groups.map((group) => {
        const candidates = getCandidates(group)
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
                <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Điều chỉnh hạng mục (thay template cùng type)</label>
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
                Chi tinh lai nhom nay
              </div>
              <div style={{ display: 'flex', alignItems: 'end' }}>
                <button className="btn-primary" disabled={busyKey === group.template_key} onClick={() => recomputeOneGroup(group)}>
                  {busyKey === group.template_key ? 'Dang tinh...' : 'Tinh lai template nay'}
                </button>
              </div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr .9fr .9fr .9fr 1fr', gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--border)', background: 'rgba(148,163,184,.08)' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>Vat tu</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>So luong</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>Don gia</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>Thanh tien</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>NCC override</div>
              </div>
              {rows.map((it, idx) => (
                <div key={`${group.template_key}-${it.id || idx}`} style={{ display: 'grid', gridTemplateColumns: '1.6fr .9fr .9fr .9fr 1fr', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--text)' }}>
                    {it.material_key} {it.material_name ? `- ${it.material_name}` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{it.quantity != null ? Number(it.quantity).toFixed(2) : '-'}</div>
                  <div style={{ fontSize: 12, color: it.unit_price == null ? 'var(--red)' : 'var(--text2)' }}>
                    {it.unit_price != null ? Number(it.unit_price).toLocaleString('vi-VN') : 'THIEU GIA'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{Number(it.cost || 0).toLocaleString('vi-VN')}đ</div>
                  <div>
                    <select
                      className="select"
                      value={supplierOverrides[it.material_key] || ''}
                      onChange={(e) => setSupplierOverride(group.template_key, it.material_key, e.target.value)}
                    >
                      <option value="">(Giu theo don gia hien tai/policy)</option>
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
