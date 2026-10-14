'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'

type TaxonomyItem = {
  id: string
  kind: string
  value: string
  name: string
  description?: string | null
  is_active: boolean
}

type ContextProfile = {
  value: string
  name: string
  geo_factor: number
  labor_factor: number
  transport_factor: number
  difficulty_factor: number
  market_factor: number
}

type SupplierOption = { value: string; name: string }
type RegionOption = { code: string; name: string }
type CustomerOption = { id: string; full_name: string | null; phone_number: string | null }

const FIELD_TITLES: Record<string, string> = {
  build_length_m: 'Chiều dài xây dựng (m)',
  build_width_m: 'Chiều rộng xây dựng (m)',
  floor_height_m: 'Chiều cao tầng (m)',
  stair_void_area: 'Diện tích hộc thang (m2)',
  floors: 'Số tầng',
  tum_count: 'Số tum',
  tum_area_m2: 'Diện tích tum (m2)',
  tum_area_percent: 'Diện tích tum (%)',
  basement_count: 'Số tầng hầm',
  foundation_type: 'Loại móng',
  house_type: 'Loại nhà',
  style: 'Phong cách kiến trúc',
  region_code: 'Mã vùng',
  customer_id: 'Mã khách hàng',
}

export default function EstimateGenerateV2Page() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [result, setResult] = useState<any>(null)
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [suggestedInputs, setSuggestedInputs] = useState<Record<string, string>>({})
  const [missingDetails, setMissingDetails] = useState<string[]>([])
  const [lastPayload, setLastPayload] = useState<any>(null)

  const [houseTypeOptions, setHouseTypeOptions] = useState<Array<{ value: string; name: string }>>([])
  const [styleOptions, setStyleOptions] = useState<Array<{ value: string; name: string }>>([])
  const [foundationTypeOptions, setFoundationTypeOptions] = useState<Array<{ value: string; name: string }>>([])
  const [contextProfiles, setContextProfiles] = useState<ContextProfile[]>([])
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([])
  const [regionOptions, setRegionOptions] = useState<RegionOption[]>([{ code: 'ALL', name: 'ALL - Toàn quốc' }])
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [selectedContextProfile, setSelectedContextProfile] = useState('manual')
  const [updateCustomerSnapshotOnRun, setUpdateCustomerSnapshotOnRun] = useState(false)
  const [markAsStandard, setMarkAsStandard] = useState(false)
  const [templateStateOnSave, setTemplateStateOnSave] = useState<'candidate' | 'validated_by_admin' | 'archived'>('validated_by_admin')
  const [templateApplyMode, setTemplateApplyMode] = useState<'auto' | 'standard_template' | 'nearest_template' | 'none'>('auto')
  const [prefillApplied, setPrefillApplied] = useState(false)
  const [templateGroups, setTemplateGroups] = useState<Array<{ key: string; label: string; items: any[]; total: number }>>([])

  const [form, setForm] = useState({
    customer_id: '',
    construction_address: '',
    region_code: 'ALL',
    build_length_m: '15',
    build_width_m: '4',
    floor_height_m: '',
    stair_void_area: '',
    wc_perimeter_m: '',
    floors: '3',
    tum_count: '1',
    tum_area_mode: 'percent',
    tum_area_m2: '',
    tum_area_percent: '50',
    basement_count: '0',
    has_elevator: false,
    finish_level: 'tieu_chuan',
    house_type: 'nha_pho',
    style: '',
    foundation_type: '',
    bedroom_count: '4',
    wc_count: '3',
    kitchen_count: '1',
    living_room_count: '1',
    base_cost_per_m2: '',
    pricing_policy: 'standard',
    geo_factor: '1',
    labor_factor: '1',
    transport_factor: '1',
    difficulty_factor: '1',
    market_factor: '1',
    supplier_match_mode: 'preferred_first',
    extra_facts_json_text: '',
  })

  const areaPreview = useMemo(() => {
    const length = Number(form.build_length_m)
    const width = Number(form.build_width_m)
    const floors = Number(form.floors)
    if (!Number.isFinite(length) || !Number.isFinite(width) || !Number.isFinite(floors)) return null
    if (length <= 0 || width <= 0 || floors <= 0) return null
    const footprint = length * width
    const tumAreaM2 = Number(form.tum_area_m2)
    const tumAreaPercent = Number(form.tum_area_percent)
    const tumArea =
      form.tum_area_mode === 'm2'
        ? (Number.isFinite(tumAreaM2) && tumAreaM2 > 0 ? tumAreaM2 : 0)
        : (Number.isFinite(tumAreaPercent) ? Math.max(0, footprint * (Math.max(0, Math.min(100, tumAreaPercent)) / 100)) : 0)
    return footprint * floors + tumArea
  }, [form.build_length_m, form.build_width_m, form.floors, form.tum_area_mode, form.tum_area_m2, form.tum_area_percent])

  useEffect(() => {
    loadTaxonomyOptions()
    loadCustomerOptions()
  }, [])

  useEffect(() => {
    if (prefillApplied) return
    const raw = searchParams.get('prefill')
    if (!raw?.trim()) return
    try {
      const prefill = JSON.parse(raw)
      setForm((prev) => ({
        ...prev,
        customer_id: prefill?.customer_id ? String(prefill.customer_id) : prev.customer_id,
        region_code: prefill?.region_code ? String(prefill.region_code) : prev.region_code,
        construction_address: prefill?.construction_address != null ? String(prefill.construction_address) : prev.construction_address,
        build_length_m: prefill?.build_length_m != null ? String(prefill.build_length_m) : prev.build_length_m,
        build_width_m: prefill?.build_width_m != null ? String(prefill.build_width_m) : prev.build_width_m,
        floor_height_m: prefill?.floor_height_m != null ? String(prefill.floor_height_m) : prev.floor_height_m,
        stair_void_area: prefill?.stair_void_area != null ? String(prefill.stair_void_area) : prev.stair_void_area,
        floors: prefill?.floors != null ? String(prefill.floors) : prev.floors,
        tum_count: prefill?.tum_count != null ? String(prefill.tum_count) : prev.tum_count,
        tum_area_mode: prefill?.tum_area_mode ? String(prefill.tum_area_mode) : prev.tum_area_mode,
        tum_area_m2: prefill?.tum_area_m2 != null ? String(prefill.tum_area_m2) : prev.tum_area_m2,
        tum_area_percent: prefill?.tum_area_percent != null ? String(prefill.tum_area_percent) : prev.tum_area_percent,
        basement_count: prefill?.basement_count != null ? String(prefill.basement_count) : prev.basement_count,
        house_type: prefill?.house_type ? String(prefill.house_type) : prev.house_type,
        style: prefill?.style ? String(prefill.style) : prev.style,
        foundation_type: prefill?.foundation_type ? String(prefill.foundation_type) : prev.foundation_type,
        finish_level: prefill?.finish_level ? String(prefill.finish_level) : prev.finish_level,
        bedroom_count: prefill?.bedroom_count != null ? String(prefill.bedroom_count) : prev.bedroom_count,
        wc_count: prefill?.wc_count != null ? String(prefill.wc_count) : prev.wc_count,
        kitchen_count: prefill?.kitchen_count != null ? String(prefill.kitchen_count) : prev.kitchen_count,
        living_room_count: prefill?.living_room_count != null ? String(prefill.living_room_count) : prev.living_room_count,
        base_cost_per_m2: prefill?.base_cost_per_m2 != null ? String(prefill.base_cost_per_m2) : prev.base_cost_per_m2,
        extra_facts_json_text: prefill?.extra_facts_json && typeof prefill.extra_facts_json === 'object' ? JSON.stringify(prefill.extra_facts_json, null, 2) : prev.extra_facts_json_text,
      }))
      setPrefillApplied(true)
      showToast('Đã nạp dữ liệu prefill')
    } catch {
      // ignore
    }
  }, [searchParams, prefillApplied])

  useEffect(() => {
    if (!form.customer_id) return
    hydrateEstimateInputsFromCustomer(form.customer_id)
  }, [form.customer_id])

  async function loadTaxonomyOptions() {
    try {
      const [hRes, stRes, fRes, pRes, sRes, mRes, gRes] = await Promise.all([
        fetch('/api/settings/estimate/taxonomies?active_only=true&kind=house_type'),
        fetch('/api/settings/estimate/taxonomies?active_only=true&kind=style'),
        fetch('/api/settings/estimate/taxonomies?active_only=true&kind=foundation_type'),
        fetch('/api/settings/estimate/taxonomies?active_only=true&kind=context_profile'),
        fetch('/api/settings/estimate/taxonomies?active_only=true&kind=supplier'),
        fetch('/api/settings/estimate/materials'),
        fetch('/api/settings/regions?active_only=true&level=province&limit=500'),
      ])

      const hJson = await hRes.json()
      const stJson = await stRes.json()
      const fJson = await fRes.json()
      const pJson = await pRes.json()
      const sJson = await sRes.json()
      const mJson = await mRes.json()
      const gJson = await gRes.json().catch(() => ({}))

      const houseRows: TaxonomyItem[] = Array.isArray(hJson.data) ? hJson.data : []
      const styleRows: TaxonomyItem[] = Array.isArray(stJson.data) ? stJson.data : []
      const foundationRows: TaxonomyItem[] = Array.isArray(fJson.data) ? fJson.data : []
      const profileRows: TaxonomyItem[] = Array.isArray(pJson.data) ? pJson.data : []
      const supplierRows: TaxonomyItem[] = Array.isArray(sJson.data) ? sJson.data : []
      const materialRows: Array<{ source_note?: string | null }> = Array.isArray(mJson.data) ? mJson.data : []
      const regionRows: Array<{ code?: string; name?: string }> = Array.isArray(gJson.data) ? gJson.data : []

      const houseOpts = houseRows.map((x) => ({ value: x.value, name: x.name || x.value }))
      const styleOpts = styleRows.map((x) => ({ value: x.value, name: x.name || x.value }))
      const foundationOpts = foundationRows.map((x) => ({ value: x.value, name: x.name || x.value }))
      const profiles = profileRows.map(toContextProfile).filter((x): x is ContextProfile => Boolean(x))

      const supplierMap = new Map<string, SupplierOption>()
      for (const s of supplierRows) supplierMap.set(s.value, { value: s.value, name: s.name || s.value })
      for (const m of materialRows) {
        const key = extractSupplierFromNote(m?.source_note)
        if (key && !supplierMap.has(key)) supplierMap.set(key, { value: key, name: key })
      }

      const regions = [
        { code: 'ALL', name: 'ALL - Toàn quốc' },
        ...regionRows.map((x) => ({ code: String(x.code || ''), name: String(x.name || x.code || '') })).filter((x) => x.code),
      ]

      setHouseTypeOptions(houseOpts)
      setStyleOptions(styleOpts)
      setFoundationTypeOptions(foundationOpts)
      setContextProfiles(profiles)
      setSupplierOptions(Array.from(supplierMap.values()))
      setRegionOptions(regions)
    } catch {
      // keep fallback UI
    }
  }

  async function loadCustomerOptions() {
    try {
      const r = await fetch('/api/customers?limit=300&sort=updated_at&dir=desc')
      const j = await r.json().catch(() => ({}))
      const rows = Array.isArray(j.data) ? j.data : []
      setCustomerOptions(
        rows
          .map((x: any) => ({
            id: String(x.id || ''),
            full_name: x.full_name ? String(x.full_name) : null,
            phone_number: x.phone_number ? String(x.phone_number) : null,
          }))
          .filter((x: CustomerOption) => x.id)
      )
    } catch {
      setCustomerOptions([])
    }
  }

  async function hydrateEstimateInputsFromCustomer(customerId: string) {
    try {
      const r = await fetch(`/api/customers/${customerId}`)
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j?.data) return

      const data = j.data
      const snapshot = data.requirement_snapshot_current || null
      const normalized = snapshot?.normalized_json && typeof snapshot.normalized_json === 'object' ? snapshot.normalized_json : {}
      const fromAny = (...values: any[]) => {
        for (const v of values) {
          if (v === null || v === undefined) continue
          if (typeof v === 'string' && !v.trim()) continue
          return v
        }
        return null
      }

      setForm((prev) => ({
        ...prev,
        customer_id: customerId,
        construction_address: String(fromAny(normalized.construction_address, normalized.address, data.construction_address, prev.construction_address) ?? ''),
        region_code: String(fromAny(normalized.region_code, prev.region_code, 'ALL') ?? 'ALL'),
        build_length_m: String(fromAny(normalized.build_length_m, prev.build_length_m) ?? prev.build_length_m),
        build_width_m: String(fromAny(normalized.build_width_m, prev.build_width_m) ?? prev.build_width_m),
        floor_height_m: String(fromAny(normalized.floor_height_m, prev.floor_height_m) ?? prev.floor_height_m),
        stair_void_area: String(fromAny(normalized.stair_void_area, prev.stair_void_area) ?? prev.stair_void_area),
        wc_perimeter_m: String(fromAny(normalized.wc_perimeter_m, prev.wc_perimeter_m) ?? prev.wc_perimeter_m),
        floors: String(fromAny(normalized.floors, data.floors, prev.floors) ?? prev.floors),
        tum_count: String(fromAny(normalized.tum_count, prev.tum_count) ?? prev.tum_count),
        tum_area_mode: String(fromAny(normalized.tum_area_mode, prev.tum_area_mode) ?? prev.tum_area_mode),
        tum_area_m2: String(fromAny(normalized.tum_area_m2, prev.tum_area_m2) ?? prev.tum_area_m2),
        tum_area_percent: String(fromAny(normalized.tum_area_percent, prev.tum_area_percent) ?? prev.tum_area_percent),
        basement_count: String(fromAny(normalized.basement_count, prev.basement_count) ?? prev.basement_count),
        has_elevator: Boolean(fromAny(normalized.has_elevator, prev.has_elevator)),
        finish_level: String(fromAny(normalized.finish_level, prev.finish_level) ?? prev.finish_level),
        house_type: String(fromAny(normalized.house_type, data.house_type, prev.house_type) ?? prev.house_type),
        style: String(fromAny(normalized.style, prev.style) ?? prev.style),
        foundation_type: String(fromAny(normalized.foundation_type, prev.foundation_type) ?? prev.foundation_type),
        bedroom_count: String(fromAny(normalized.bedroom_count, prev.bedroom_count) ?? prev.bedroom_count),
        wc_count: String(fromAny(normalized.wc_count, prev.wc_count) ?? prev.wc_count),
        kitchen_count: String(fromAny(normalized.kitchen_count, prev.kitchen_count) ?? prev.kitchen_count),
        living_room_count: String(fromAny(normalized.living_room_count, prev.living_room_count) ?? prev.living_room_count),
        base_cost_per_m2: String(fromAny(normalized.base_cost_per_m2, prev.base_cost_per_m2) ?? prev.base_cost_per_m2),
        extra_facts_json_text: fromAny(
          normalized.extra_facts_json && typeof normalized.extra_facts_json === 'object' ? JSON.stringify(normalized.extra_facts_json, null, 2) : null,
          prev.extra_facts_json_text
        ) ?? prev.extra_facts_json_text,
      }))

      showToast('Đã nạp thông số từ khách hàng + snapshot')
    } catch {
      // ignore
    }
  }

  function applyContextProfile(profileValue: string) {
    setSelectedContextProfile(profileValue)
    if (profileValue === 'manual') return
    const profile = contextProfiles.find((x) => x.value === profileValue)
    if (!profile) return
    setForm((prev) => ({
      ...prev,
      geo_factor: String(profile.geo_factor),
      labor_factor: String(profile.labor_factor),
      transport_factor: String(profile.transport_factor),
      difficulty_factor: String(profile.difficulty_factor),
      market_factor: String(profile.market_factor),
    }))
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function generate() {
    setLoading(true)
    setResult(null)
    setMissingFields([])
    setSuggestedInputs({})
    setMissingDetails([])

    let extraFactsJson: Record<string, any> | null = null
    if (form.extra_facts_json_text.trim()) {
      try {
        const parsed = JSON.parse(form.extra_facts_json_text)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          showToast('extra_facts_json phải là object JSON')
          setLoading(false)
          return
        }
        extraFactsJson = parsed
      } catch {
        showToast('extra_facts_json không hợp lệ')
        setLoading(false)
        return
      }
    }

    const payload = {
      customer_id: form.customer_id || null,
      construction_address: form.construction_address || null,
      region_code: form.region_code || 'ALL',
      build_length_m: form.build_length_m ? Number(form.build_length_m) : null,
      build_width_m: form.build_width_m ? Number(form.build_width_m) : null,
      floor_height_m: form.floor_height_m ? Number(form.floor_height_m) : null,
      stair_void_area: form.stair_void_area ? Number(form.stair_void_area) : null,
      wc_perimeter_m: form.wc_perimeter_m ? Number(form.wc_perimeter_m) : null,
      floors: Number(form.floors),
      tum_count: Number(form.tum_count),
      tum_area_mode: form.tum_area_mode,
      tum_area_m2: form.tum_area_mode === 'm2' && form.tum_area_m2 ? Number(form.tum_area_m2) : null,
      tum_area_percent: form.tum_area_mode === 'percent' && form.tum_area_percent ? Number(form.tum_area_percent) : null,
      basement_count: Number(form.basement_count),
      has_elevator: form.has_elevator,
      finish_level: form.finish_level,
      house_type: form.house_type || null,
      style: form.style || null,
      foundation_type: form.foundation_type || null,
      bedroom_count: Number(form.bedroom_count || 0),
      wc_count: Number(form.wc_count || 0),
      kitchen_count: Number(form.kitchen_count || 0),
      living_room_count: Number(form.living_room_count || 0),
      base_cost_per_m2: form.base_cost_per_m2 ? Number(form.base_cost_per_m2) : null,
      extra_facts_json: extraFactsJson,
      pricing_policy: form.pricing_policy || 'standard',
      preferred_supplier_key: selectedSupplier.trim() || null,
      supplier_match_mode: form.supplier_match_mode || 'preferred_first',
      template_apply_mode: templateApplyMode,
      context_profile_key: selectedContextProfile !== 'manual' ? selectedContextProfile : null,
      geo_factor: form.geo_factor ? Number(form.geo_factor) : 1,
      labor_factor: form.labor_factor ? Number(form.labor_factor) : 1,
      transport_factor: form.transport_factor ? Number(form.transport_factor) : 1,
      difficulty_factor: form.difficulty_factor ? Number(form.difficulty_factor) : 1,
      market_factor: form.market_factor ? Number(form.market_factor) : 1,
      update_customer_snapshot_from_form: Boolean(form.customer_id) && updateCustomerSnapshotOnRun,
    }

    setLastPayload(payload)

    const r = await fetch('/api/estimates/generate-v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await r.json().catch(() => ({}))
    setLoading(false)

    if (!r.ok) {
      setMissingFields(Array.isArray(j.missing_fields) ? j.missing_fields : [])
      setSuggestedInputs((j.suggested_inputs || {}) as Record<string, string>)
      setMissingDetails(Array.isArray(j.details) ? j.details : [])
      showToast(`Lỗi: ${j.error || 'Không thể tạo dự toán sơ bộ'}`)
      return
    }

    setResult(j.data)
    setTemplateGroups(buildTemplateGroups(Array.isArray(j.data?.items) ? j.data.items : []))
    showToast('Đã tạo bản xem trước')
  }

  async function saveConfirmed() {
    if (!lastPayload) {
      showToast('Hãy tạo bản xem trước trước khi lưu')
      return
    }

    setSaving(true)
    const r = await fetch('/api/estimates/generate-v2/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...lastPayload,
        confirm_correct: true,
        mark_as_standard: markAsStandard,
        template_state: templateStateOnSave,
        update_customer_snapshot_from_form: Boolean(form.customer_id) && updateCustomerSnapshotOnRun,
      }),
    })
    const j = await r.json().catch(() => ({}))
    setSaving(false)

    if (!r.ok) {
      showToast(`Lỗi lưu: ${j.error || 'Không thể lưu dự toán sơ bộ'}`)
      return
    }

    setResult(j.data)
    setTemplateGroups(buildTemplateGroups(Array.isArray(j.data?.items) ? j.data.items : []))
    showToast('Đã lưu dự toán sơ bộ')
  }

  function openResultV2Page() {
    if (!result || !lastPayload) {
      showToast('Cần tạo kết quả trước khi chuyển trang')
      return
    }
    try {
      window.sessionStorage.setItem(
        'estimate_v2_preview_context',
        JSON.stringify({ result, payload: lastPayload })
      )
      window.location.href = '/settings/result-v2'
    } catch {
      showToast('Không thể mở trang result-v2')
    }
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>
          ESTIMATION V2
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Dự toán sơ bộ theo kích thước</h1>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>Chọn khách hàng, kiểm tra thông số, tạo bản xem trước rồi xác nhận lưu.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.3, color: 'var(--text4)', fontWeight: 700, marginBottom: 10 }}>THÔNG SỐ ĐẦU VÀO</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Khách hàng">
              <select className="select" value={form.customer_id} onChange={(e) => setForm((p) => ({ ...p, customer_id: e.target.value }))}>
                <option value="">(Không chọn)</option>
                {customerOptions.map((c) => (
                  <option key={c.id} value={c.id}>{(c.full_name?.trim() || 'Khách hàng')} - {c.phone_number || c.id}</option>
                ))}
              </select>
            </Field>

            <Field label="Mã vùng">
              <select className="select" value={form.region_code} onChange={(e) => setForm((p) => ({ ...p, region_code: e.target.value }))}>
                {!regionOptions.some((r) => r.code === form.region_code) && <option value={form.region_code}>{form.region_code} - Custom</option>}
                {regionOptions.map((r) => (
                  <option key={r.code} value={r.code}>{r.code} - {r.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Địa chỉ xây dựng">
              <input className="input" value={form.construction_address} onChange={(e) => setForm((p) => ({ ...p, construction_address: e.target.value }))} placeholder="Địa chỉ công trình" />
            </Field>

            <Field label="Chiều dài xây dựng (m)">
              <input className="input" value={form.build_length_m} onChange={(e) => setForm((p) => ({ ...p, build_length_m: e.target.value }))} />
            </Field>

            <Field label="Chiều rộng xây dựng (m)">
              <input className="input" value={form.build_width_m} onChange={(e) => setForm((p) => ({ ...p, build_width_m: e.target.value }))} />
            </Field>

            <Field label="Số tầng"><input className="input" value={form.floors} onChange={(e) => setForm((p) => ({ ...p, floors: e.target.value }))} /></Field>
            <Field label="Số tum"><input className="input" value={form.tum_count} onChange={(e) => setForm((p) => ({ ...p, tum_count: e.target.value }))} /></Field>
            <Field label="Cách nhập diện tích tum">
              <select className="select" value={form.tum_area_mode} onChange={(e) => setForm((p) => ({ ...p, tum_area_mode: e.target.value }))}>
                <option value="percent">% diện tích 1 sàn</option>
                <option value="m2">m2 cố định</option>
              </select>
            </Field>
            {form.tum_area_mode === 'm2' ? (
              <Field label="Diện tích tum (m2)">
                <input className="input" value={form.tum_area_m2} onChange={(e) => setForm((p) => ({ ...p, tum_area_m2: e.target.value }))} placeholder="VD: 25" />
              </Field>
            ) : (
              <Field label="Diện tích tum (% 1 sàn)">
                <input className="input" value={form.tum_area_percent} onChange={(e) => setForm((p) => ({ ...p, tum_area_percent: e.target.value }))} placeholder="VD: 50" />
              </Field>
            )}
            <Field label="Số tầng hầm"><input className="input" value={form.basement_count} onChange={(e) => setForm((p) => ({ ...p, basement_count: e.target.value }))} /></Field>

            <Field label="Loại nhà">
              <select className="select" value={form.house_type} onChange={(e) => setForm((p) => ({ ...p, house_type: e.target.value }))}>
                {houseTypeOptions.length === 0 ? (
                  <>
                    <option value="nha_pho">Nhà phố</option>
                    <option value="biet_thu">Biệt thự</option>
                    <option value="nha_cap_4">Nhà cấp 4</option>
                  </>
                ) : (
                  houseTypeOptions.map((x) => <option key={x.value} value={x.value}>{x.name}</option>)
                )}
              </select>
            </Field>

            <Field label="Phong cách kiến trúc">
              <select className="select" value={form.style} onChange={(e) => setForm((p) => ({ ...p, style: e.target.value }))}>
                <option value="">(Không chọn)</option>
                {styleOptions.map((x) => <option key={x.value} value={x.value}>{x.name}</option>)}
              </select>
            </Field>

            <Field label="Loại móng">
              <select className="select" value={form.foundation_type} onChange={(e) => setForm((p) => ({ ...p, foundation_type: e.target.value }))}>
                <option value="">(Không chọn)</option>
                {foundationTypeOptions.map((x) => <option key={x.value} value={x.value}>{x.name}</option>)}
              </select>
            </Field>

            <Field label="Mức hoàn thiện">
              <select className="select" value={form.finish_level} onChange={(e) => setForm((p) => ({ ...p, finish_level: e.target.value }))}>
                <option value="co_ban">Cơ bản</option>
                <option value="tieu_chuan">Tiêu chuẩn</option>
                <option value="cao_cap">Cao cấp</option>
              </select>
            </Field>

            <Field label="Đơn giá cơ sở/m2"><input className="input" value={form.base_cost_per_m2} onChange={(e) => setForm((p) => ({ ...p, base_cost_per_m2: e.target.value }))} /></Field>
            <Field label="Extra facts JSON (nâng cao)">
              <textarea
                className="input"
                value={form.extra_facts_json_text}
                onChange={(e) => setForm((p) => ({ ...p, extra_facts_json_text: e.target.value }))}
                placeholder='VD: {"wall_height_override":3.6,"corridor_factor":1.08}'
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </Field>

            <Field label="Nhà cung cấp ưu tiên">
              <>
                <input className="input" list="supplier-option-list" value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)} placeholder="bỏ trống = tất cả" />
                <datalist id="supplier-option-list">
                  {supplierOptions.map((s) => <option key={s.value} value={s.value}>{s.name}</option>)}
                </datalist>
              </>
            </Field>

            <Field label="Hồ sơ hệ số bối cảnh">
              <select className="select" value={selectedContextProfile} onChange={(e) => applyContextProfile(e.target.value)}>
                <option value="manual">Nhập tay</option>
                {contextProfiles.map((p) => <option key={p.value} value={p.value}>{p.name} ({p.value})</option>)}
              </select>
            </Field>

            <Field label="Hệ số địa lý"><input className="input" value={form.geo_factor} onChange={(e) => setForm((p) => ({ ...p, geo_factor: e.target.value }))} /></Field>
            <Field label="Hệ số nhân công"><input className="input" value={form.labor_factor} onChange={(e) => setForm((p) => ({ ...p, labor_factor: e.target.value }))} /></Field>
            <Field label="Hệ số vận chuyển"><input className="input" value={form.transport_factor} onChange={(e) => setForm((p) => ({ ...p, transport_factor: e.target.value }))} /></Field>
            <Field label="Hệ số độ khó"><input className="input" value={form.difficulty_factor} onChange={(e) => setForm((p) => ({ ...p, difficulty_factor: e.target.value }))} /></Field>
            <Field label="Hệ số thị trường"><input className="input" value={form.market_factor} onChange={(e) => setForm((p) => ({ ...p, market_factor: e.target.value }))} /></Field>
          </div>

          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
            Diện tích sàn tạm tính: <span style={{ color: 'var(--blue)' }}>{areaPreview != null ? `${areaPreview.toFixed(2)} m2` : 'Chưa đủ dữ liệu'}</span>
          </div>

          <label style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--text2)' }}>
            <input type="checkbox" checked={markAsStandard} onChange={(e) => setMarkAsStandard(e.target.checked)} />
            Lưu làm mẫu chuẩn khi bấm lưu
          </label>

          {form.customer_id && (
            <label style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--text2)' }}>
              <input type="checkbox" checked={updateCustomerSnapshotOnRun} onChange={(e) => setUpdateCustomerSnapshotOnRun(e.target.checked)} />
              Cập nhật `project_requirement_snapshots` từ dữ liệu form
            </label>
          )}

          <Field label="Trạng thái mẫu khi lưu">
            <select className="select" value={templateStateOnSave} onChange={(e) => setTemplateStateOnSave(e.target.value as any)}>
              <option value="validated_by_admin">Đã thẩm định</option>
              <option value="candidate">Đề xuất</option>
              <option value="archived">Lưu trữ</option>
            </select>
          </Field>

          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={generate} disabled={loading} style={{ minWidth: 180 }}>
              {loading ? 'Đang tạo...' : 'Tạo dự toán sơ bộ'}
            </button>
            <button
              onClick={saveConfirmed}
              disabled={saving || !result}
              style={{ minWidth: 180, background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.35)', color: 'var(--green)', borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: saving || !result ? 'not-allowed' : 'pointer', opacity: saving || !result ? 0.6 : 1 }}
            >
              {saving ? 'Đang lưu...' : 'Xác nhận lưu'}
            </button>
            <button
              onClick={openResultV2Page}
              disabled={!result}
              style={{ minWidth: 180, background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.35)', color: 'var(--blue)', borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: !result ? 'not-allowed' : 'pointer', opacity: !result ? 0.6 : 1 }}
            >
              Mở /settings/result-v2
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.3, color: 'var(--text4)', fontWeight: 700, marginBottom: 10 }}>KẾT QUẢ</div>
          {!result ? (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Chưa có kết quả.</div>
              {missingFields.length > 0 && (
                <div style={{ border: '1px solid rgba(239,68,68,.35)', background: 'rgba(239,68,68,.08)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--red)', fontWeight: 700, marginBottom: 6 }}>Thiếu dữ liệu đầu vào:</div>
                  {missingFields.map((f) => (
                    <div key={f} style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>
                      - <span style={{ color: 'var(--text)' }}>{FIELD_TITLES[f] || f}</span>
                      {suggestedInputs[f] ? `: ${suggestedInputs[f]}` : ''}
                    </div>
                  ))}
                  {missingDetails.map((d, i) => <div key={`${d}-${i}`} style={{ fontSize: 12, color: 'var(--text3)' }}>- {d}</div>)}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>Mã quote: <span style={{ color: 'var(--text)' }}>{result.id || '(xem trước)'}</span></div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>Tổng chi phí: <span style={{ color: 'var(--green)', fontWeight: 700 }}>{Number(result.total_cost || 0).toLocaleString('vi-VN')}đ</span></div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>Độ tin cậy: <span style={{ color: 'var(--blue)' }}>{result.meta?.confidence ?? '-'}</span></div>

              <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                {(result.items || []).map((it: any) => (
                  <div key={it.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text)' }}>{it.material_key} {it.material_name ? `- ${it.material_name}` : ''}</div>
                    <div style={{ fontSize: 11, color: it.unit_price == null ? 'var(--red)' : 'var(--text3)' }}>
                      SL: {it.quantity != null ? Number(it.quantity).toFixed(2) : '-'} | Đơn giá: {it.unit_price != null ? Number(it.unit_price).toLocaleString('vi-VN') : 'THIẾU GIÁ'} | Thành tiền: {Number(it.cost || 0).toLocaleString('vi-VN')}đ
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', background: 'rgba(59,130,246,.10)', fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
                  Tách theo từng Template + Items
                </div>
                {templateGroups.length === 0 ? (
                  <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>
                    Không có dòng nào gắn template.
                  </div>
                ) : (
                  <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                    {templateGroups.map((g) => (
                      <div key={g.key} style={{ borderBottom: '1px solid var(--border)' }}>
                        <div style={{ padding: '8px 10px', background: 'rgba(148,163,184,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                          <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700 }}>{g.label}</div>
                          <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>
                            Tổng template: {Number(g.total || 0).toLocaleString('vi-VN')}đ
                          </div>
                        </div>
                        {g.items.map((it: any, idx: number) => (
                          <div key={`${g.key}-${it.id || idx}`} style={{ padding: '8px 10px', borderTop: '1px solid rgba(148,163,184,.12)' }}>
                            <div style={{ fontSize: 12, color: 'var(--text)' }}>{it.material_key} {it.material_name ? `- ${it.material_name}` : ''}</div>
                            <div style={{ fontSize: 11, color: it.unit_price == null ? 'var(--red)' : 'var(--text3)' }}>
                              SL: {it.quantity != null ? Number(it.quantity).toFixed(2) : '-'} | Đơn giá: {it.unit_price != null ? Number(it.unit_price).toLocaleString('vi-VN') : 'THIẾU GIÁ'} | Thành tiền: {Number(it.cost || 0).toLocaleString('vi-VN')}đ
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 9, padding: '10px 16px', fontSize: 13, zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  )
}

function toContextProfile(row: TaxonomyItem): ContextProfile | null {
  const parsed = safeParseProfile(row.description)
  if (!parsed) return null
  return {
    value: row.value,
    name: row.name || row.value,
    geo_factor: parsed.geo_factor,
    labor_factor: parsed.labor_factor,
    transport_factor: parsed.transport_factor,
    difficulty_factor: parsed.difficulty_factor,
    market_factor: parsed.market_factor,
  }
}

function safeParseProfile(raw: string | null | undefined) {
  if (!raw || !String(raw).trim()) return null
  try {
    const obj = JSON.parse(String(raw))
    return {
      geo_factor: safePositive(obj?.geo_factor),
      labor_factor: safePositive(obj?.labor_factor),
      transport_factor: safePositive(obj?.transport_factor),
      difficulty_factor: safePositive(obj?.difficulty_factor),
      market_factor: safePositive(obj?.market_factor),
    }
  } catch {
    return null
  }
}

function safePositive(v: unknown) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return 1
  return n
}

function extractSupplierFromNote(note: string | null | undefined) {
  const raw = String(note || '')
  if (!raw) return ''
  const m = raw.match(/supplier\s*[:=]\s*([a-zA-Z0-9_-]+)/i)
  return m?.[1] ? m[1] : ''
}

function parseTemplateNote(note: unknown) {
  const raw = String(note || '').trim()
  if (!raw.startsWith('template:')) return null
  const payload = raw.slice('template:'.length).trim()
  if (!payload) return null
  const [codeAndVersionRaw, templateNameRaw] = payload.split('|')
  const codeAndVersion = String(codeAndVersionRaw || '').trim()
  if (!codeAndVersion) return null
  const atIndex = codeAndVersion.indexOf('@')
  const code = atIndex >= 0 ? codeAndVersion.slice(0, atIndex).trim() : codeAndVersion
  const version = atIndex >= 0 ? codeAndVersion.slice(atIndex).trim() : ''
  const templateName = String(templateNameRaw || '').trim()
  const label = templateName
    ? `${templateName}${version ? ` (${code}${version})` : ''}`
    : `${code}${version}`
  return { key: `${code}${version}`, label }
}

function buildTemplateGroups(items: any[]) {
  const grouped = new Map<string, { key: string; label: string; items: any[]; total: number }>()
  for (const it of items || []) {
    const parsed = parseTemplateNote(it?.note)
    if (!parsed) continue
    if (!grouped.has(parsed.key)) grouped.set(parsed.key, { key: parsed.key, label: parsed.label, items: [], total: 0 })
    const box = grouped.get(parsed.key)!
    box.items.push(it)
    box.total += Number(it?.cost || 0)
  }
  return Array.from(grouped.values()).sort((a, b) => b.total - a.total)
}
