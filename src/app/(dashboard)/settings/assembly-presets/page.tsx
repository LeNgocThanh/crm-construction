'use client'

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

type PresetKind = 'opening_preset' | 'roof_preset' | 'stair_preset' | 'interior_preset'

type FieldDef = {
  key: string
  label: string
  type: 'text' | 'number' | 'color' | 'select'
  placeholder?: string
  options?: Array<{ value: string; label: string }>
}

type PresetForm = {
  id?: string
  kind: PresetKind
  value: string
  name: string
  summary: string
  sort_order: string
  is_active: boolean
  opening_type: string
  opening_count: string
  opening_area: string
  width_ratio: string
  min_width: string
  height_ratio: string
  max_height: string
  sill_ratio: string
  min_sill: string
  color: string
  roof_height_ratio: string
  roof_height_min: string
  body_height_min: string
  lean_to_tilt_rad: string
  thai_radius_ratio: string
  roof_color: string
  step_count: string
  step_depth_ratio: string
  step_width_ratio: string
  min_step_depth: string
  min_step_width: string
  turn_ratio: string
  interior_bed_count: string
  kitchen_counter_length_total_m: string
  wc_fixture_set_count: string
}

const KIND_META: Record<PresetKind, { title: string; hint: string; fields: FieldDef[] }> = {
  opening_preset: {
    title: 'Preset ô mở',
    hint: 'Dùng cho cửa đi, cửa sổ, ô thông gió mặc định khi block chưa khai báo openings[] chi tiết.',
    fields: [
      { key: 'opening_type', label: 'Loại ô mở', type: 'select', options: [
        { value: 'door', label: 'Cửa đi' },
        { value: 'window', label: 'Cửa sổ' },
        { value: 'vent', label: 'Ô thông gió' },
      ] },
      { key: 'opening_count', label: 'Số lượng mặc định', type: 'number', placeholder: 'Ví dụ: 1' },
      { key: 'opening_area', label: 'Diện tích ô mở (m2)', type: 'number', placeholder: 'Ví dụ: 1.8' },
      { key: 'width_ratio', label: 'Tỷ lệ rộng theo chiều dài block', type: 'number', placeholder: 'Ví dụ: 0.24' },
      { key: 'min_width', label: 'Chiều rộng tối thiểu (m)', type: 'number', placeholder: 'Ví dụ: 1.2' },
      { key: 'height_ratio', label: 'Tỷ lệ cao theo chiều cao block', type: 'number', placeholder: 'Ví dụ: 0.28' },
      { key: 'max_height', label: 'Chiều cao tối đa (m)', type: 'number', placeholder: 'Ví dụ: 1.2' },
      { key: 'sill_ratio', label: 'Tỷ lệ bậu cửa', type: 'number', placeholder: 'Ví dụ: 0.28' },
      { key: 'min_sill', label: 'Bậu cửa tối thiểu (m)', type: 'number', placeholder: 'Ví dụ: 0.2' },
      { key: 'color', label: 'Màu hiển thị', type: 'color' },
    ],
  },
  roof_preset: {
    title: 'Preset mái',
    hint: 'Chi phối hình mái trong 3D và logic ước lượng chiều cao thân nhà / phần mái.',
    fields: [
      { key: 'roof_height_ratio', label: 'Tỷ lệ cao phần mái', type: 'number', placeholder: 'Ví dụ: 0.22' },
      { key: 'roof_height_min', label: 'Chiều cao mái tối thiểu (m)', type: 'number', placeholder: 'Ví dụ: 0.9' },
      { key: 'body_height_min', label: 'Chiều cao thân tối thiểu (m)', type: 'number', placeholder: 'Ví dụ: 2.6' },
      { key: 'lean_to_tilt_rad', label: 'Độ nghiêng mái lệch (rad)', type: 'number', placeholder: 'Ví dụ: 0.2' },
      { key: 'thai_radius_ratio', label: 'Tỷ lệ bo mái Thái', type: 'number', placeholder: 'Ví dụ: 0.18' },
      { key: 'roof_color', label: 'Màu mái', type: 'color' },
    ],
  },
  stair_preset: {
    title: 'Preset cầu thang',
    hint: 'Điều khiển số bậc và tỷ lệ hình khối cầu thang trong mô hình sơ bộ.',
    fields: [
      { key: 'step_count', label: 'Số bậc mặc định', type: 'number', placeholder: 'Ví dụ: 18' },
      { key: 'step_depth_ratio', label: 'Tỷ lệ chiều sâu bậc', type: 'number', placeholder: 'Ví dụ: 0.12' },
      { key: 'step_width_ratio', label: 'Tỷ lệ chiều rộng thang', type: 'number', placeholder: 'Ví dụ: 0.35' },
      { key: 'min_step_depth', label: 'Chiều sâu bậc tối thiểu (m)', type: 'number', placeholder: 'Ví dụ: 0.26' },
      { key: 'min_step_width', label: 'Chiều rộng thang tối thiểu (m)', type: 'number', placeholder: 'Ví dụ: 0.9' },
      { key: 'turn_ratio', label: 'Tỷ lệ đoạn đổi hướng', type: 'number', placeholder: 'Ví dụ: 0.52' },
    ],
  },
  interior_preset: {
    title: 'Preset nội thất',
    hint: 'Dùng để gợi ý semantic facts của phòng mẫu như số giường, chiều dài bếp, số bộ thiết bị vệ sinh.',
    fields: [
      { key: 'interior_bed_count', label: 'Số giường mặc định', type: 'number', placeholder: 'Ví dụ: 1' },
      { key: 'kitchen_counter_length_total_m', label: 'Chiều dài bếp mặc định (m)', type: 'number', placeholder: 'Ví dụ: 3.2' },
      { key: 'wc_fixture_set_count', label: 'Số bộ thiết bị vệ sinh', type: 'number', placeholder: 'Ví dụ: 1' },
    ],
  },
}

const PRESET_KINDS = Object.keys(KIND_META) as PresetKind[]

function emptyForm(kind: PresetKind): PresetForm {
  return {
    kind,
    value: '',
    name: '',
    summary: '',
    sort_order: '0',
    is_active: true,
    opening_type: '',
    opening_count: '',
    opening_area: '',
    width_ratio: '',
    min_width: '',
    height_ratio: '',
    max_height: '',
    sill_ratio: '',
    min_sill: '',
    color: '#93c5fd',
    roof_height_ratio: '',
    roof_height_min: '',
    body_height_min: '',
    lean_to_tilt_rad: '',
    thai_radius_ratio: '',
    roof_color: '#94a3b8',
    step_count: '',
    step_depth_ratio: '',
    step_width_ratio: '',
    min_step_depth: '',
    min_step_width: '',
    turn_ratio: '',
    interior_bed_count: '',
    kitchen_counter_length_total_m: '',
    wc_fixture_set_count: '',
  }
}

function parseDescription(description?: string | null) {
  const raw = String(description || '').trim()
  if (!raw) return {}
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch {}
  }
  return { summary: raw }
}

function toText(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value)
}

function toNumberOrSkip(value: string) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return undefined
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : undefined
}

function formFromRow(row: TaxonomyRow): PresetForm {
  const cfg = parseDescription(row.description)
  const form = emptyForm(row.kind as PresetKind)
  return {
    ...form,
    id: row.id,
    kind: row.kind as PresetKind,
    value: row.value,
    name: row.name,
    summary: toText(cfg.summary),
    sort_order: String(row.sort_order ?? 0),
    is_active: row.is_active !== false,
    opening_type: toText(cfg.opening_type),
    opening_count: toText(cfg.opening_count),
    opening_area: toText(cfg.opening_area),
    width_ratio: toText(cfg.width_ratio),
    min_width: toText(cfg.min_width),
    height_ratio: toText(cfg.height_ratio),
    max_height: toText(cfg.max_height),
    sill_ratio: toText(cfg.sill_ratio),
    min_sill: toText(cfg.min_sill),
    color: toText(cfg.color) || '#93c5fd',
    roof_height_ratio: toText(cfg.roof_height_ratio),
    roof_height_min: toText(cfg.roof_height_min),
    body_height_min: toText(cfg.body_height_min),
    lean_to_tilt_rad: toText(cfg.lean_to_tilt_rad),
    thai_radius_ratio: toText(cfg.thai_radius_ratio),
    roof_color: toText(cfg.roof_color) || '#94a3b8',
    step_count: toText(cfg.step_count),
    step_depth_ratio: toText(cfg.step_depth_ratio),
    step_width_ratio: toText(cfg.step_width_ratio),
    min_step_depth: toText(cfg.min_step_depth),
    min_step_width: toText(cfg.min_step_width),
    turn_ratio: toText(cfg.turn_ratio),
    interior_bed_count: toText((cfg.semantic_facts as any)?.interior_bed_count),
    kitchen_counter_length_total_m: toText((cfg.semantic_facts as any)?.kitchen_counter_length_total_m),
    wc_fixture_set_count: toText((cfg.semantic_facts as any)?.wc_fixture_set_count),
  }
}

function descriptionFromForm(form: PresetForm) {
  const cfg: Record<string, unknown> = {}
  if (form.summary.trim()) cfg.summary = form.summary.trim()

  const plainNumberKeys = [
    'opening_count', 'opening_area', 'width_ratio', 'min_width', 'height_ratio', 'max_height', 'sill_ratio', 'min_sill',
    'roof_height_ratio', 'roof_height_min', 'body_height_min', 'lean_to_tilt_rad', 'thai_radius_ratio',
    'step_count', 'step_depth_ratio', 'step_width_ratio', 'min_step_depth', 'min_step_width', 'turn_ratio',
  ] as const

  for (const key of plainNumberKeys) {
    const value = toNumberOrSkip(form[key])
    if (value !== undefined) cfg[key] = value
  }

  if (form.kind === 'opening_preset') {
    if (form.opening_type) cfg.opening_type = form.opening_type
    if (form.color) cfg.color = form.color
  }
  if (form.kind === 'roof_preset' && form.roof_color) cfg.roof_color = form.roof_color
  if (form.kind === 'interior_preset') {
    const semanticFacts: Record<string, number> = {}
    const bed = toNumberOrSkip(form.interior_bed_count)
    const kitchen = toNumberOrSkip(form.kitchen_counter_length_total_m)
    const wc = toNumberOrSkip(form.wc_fixture_set_count)
    if (bed !== undefined) semanticFacts.interior_bed_count = bed
    if (kitchen !== undefined) semanticFacts.kitchen_counter_length_total_m = kitchen
    if (wc !== undefined) semanticFacts.wc_fixture_set_count = wc
    if (Object.keys(semanticFacts).length > 0) cfg.semantic_facts = semanticFacts
  }

  return JSON.stringify(cfg)
}

function renderPresetPreview(form: PresetForm) {
  if (form.kind === 'opening_preset') {
    const openingLabel = form.opening_type === 'window' ? 'Cửa sổ' : form.opening_type === 'vent' ? 'Ô thoáng' : 'Cửa đi'
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Mô phỏng ô mở fallback trên block 2D</div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'rgba(255,255,255,.02)' }}>
          <div style={{ position: 'relative', height: 140, borderRadius: 8, background: 'linear-gradient(180deg, rgba(15,23,42,.82), rgba(30,41,59,.58))', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 26, right: 26, bottom: 12, height: 10, borderRadius: 999, background: 'rgba(15,23,42,.55)' }} />
            <div style={{ position: 'absolute', left: 34, right: 34, bottom: 20, height: 88, borderRadius: '10px 10px 6px 6px', background: 'linear-gradient(180deg, rgba(16,185,129,.18), rgba(16,185,129,.28))', border: '1px solid rgba(255,255,255,.12)' }} />
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: form.opening_type === 'door' ? 36 : 52,
                transform: 'translateX(-50%)',
                width: form.opening_type === 'vent' ? 50 : form.opening_type === 'window' ? 74 : 60,
                height: form.opening_type === 'door' ? 72 : form.opening_type === 'window' ? 34 : 18,
                border: '2px dashed rgba(255,255,255,.8)',
                background: form.color || '#93c5fd',
                borderRadius: 6,
                color: '#0f172a',
                fontWeight: 700,
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {openingLabel}*
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (form.kind === 'roof_preset') {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Mô phỏng tương quan thân nhà và mái</div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'rgba(255,255,255,.02)' }}>
          <div style={{ position: 'relative', height: 120, borderRadius: 8, background: 'linear-gradient(180deg, rgba(15,23,42,.7), rgba(30,41,59,.5))', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 28, right: 28, bottom: 10, height: 10, borderRadius: 999, background: 'rgba(15,23,42,.5)' }} />
            <div style={{ position: 'absolute', left: 40, right: 40, bottom: 18, height: 54, background: 'rgba(148,163,184,.28)', borderRadius: '8px 8px 0 0', border: '1px solid rgba(255,255,255,.12)' }} />
            <div
              style={{
                position: 'absolute',
                left: 30,
                right: 30,
                bottom: 72,
                height: 26,
                background: form.roof_color || '#94a3b8',
                clipPath: form.value === 'flat' || form.value === 'terrace'
                  ? 'polygon(0 35%, 100% 35%, 100% 100%, 0 100%)'
                  : form.value === 'lean_to'
                    ? 'polygon(0 100%, 100% 35%, 100% 100%)'
                    : 'polygon(0 100%, 18% 42%, 50% 0, 82% 42%, 100% 100%)',
                border: '1px solid rgba(255,255,255,.16)',
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  if (form.kind === 'stair_preset') {
    const stepCount = Math.max(3, Math.min(8, Number(form.step_count || 5)))
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Mô phỏng hình khối cầu thang sơ bộ</div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'rgba(255,255,255,.02)' }}>
          <div style={{ position: 'relative', height: 120, borderRadius: 8, background: 'linear-gradient(180deg, rgba(15,23,42,.78), rgba(30,41,59,.55))', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 24, right: 24, bottom: 10, height: 10, borderRadius: 999, background: 'rgba(15,23,42,.5)' }} />
            <div style={{ position: 'absolute', left: 18, right: 18, bottom: 18, height: 80, borderRadius: 10, background: 'rgba(59,130,246,.05)', padding: '8px 10px', display: 'flex', alignItems: 'end', gap: 4 }}>
            {Array.from({ length: stepCount }).map((_, index) => (
              <div
                key={index}
                style={{
                  flex: 1,
                  height: `${28 + index * 10}px`,
                  background: index === stepCount - 1 ? 'rgba(249,115,22,.75)' : 'rgba(148,163,184,.45)',
                  borderRadius: '4px 4px 0 0',
                }}
              />
            ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--text3)' }}>Semantic facts sẽ được dùng cho dự toán / proposal</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'rgba(255,255,255,.02)' }}>
        <div style={{ position: 'relative', minHeight: 126, borderRadius: 8, background: 'linear-gradient(180deg, rgba(15,23,42,.78), rgba(30,41,59,.55))', overflow: 'hidden', padding: 14 }}>
          <div style={{ position: 'absolute', left: 26, right: 26, bottom: 12, height: 10, borderRadius: 999, background: 'rgba(15,23,42,.5)' }} />
          <div style={{ position: 'absolute', left: 24, right: 24, bottom: 22, height: 72, borderRadius: 10, background: 'linear-gradient(180deg, rgba(168,85,247,.16), rgba(168,85,247,.24))', border: '1px solid rgba(255,255,255,.12)' }} />
          <div style={{ position: 'relative', display: 'flex', gap: 8, flexWrap: 'wrap', zIndex: 1 }}>
          <div style={{ padding: '8px 10px', borderRadius: 999, background: 'rgba(59,130,246,.12)', fontSize: 12, color: 'var(--text2)' }}>Giường: {form.interior_bed_count || '0'}</div>
          <div style={{ padding: '8px 10px', borderRadius: 999, background: 'rgba(16,185,129,.12)', fontSize: 12, color: 'var(--text2)' }}>Bếp: {form.kitchen_counter_length_total_m || '0'}m</div>
          <div style={{ padding: '8px 10px', borderRadius: 999, background: 'rgba(249,115,22,.12)', fontSize: 12, color: 'var(--text2)' }}>Thiết bị WC: {form.wc_fixture_set_count || '0'}</div>
        </div>
        </div>
      </div>
    </div>
  )
}

function renderPresetSummary(form: PresetForm) {
  if (form.kind === 'opening_preset') {
    return [
      { label: 'Loại ô mở', value: form.opening_type || 'Chưa đặt' },
      { label: 'Số lượng mặc định', value: form.opening_count || '0' },
      { label: 'Diện tích ô mở', value: form.opening_area ? `${form.opening_area} m2` : 'Chưa đặt' },
      { label: 'Rộng tối thiểu', value: form.min_width ? `${form.min_width} m` : 'Chưa đặt' },
      { label: 'Tỷ lệ rộng', value: form.width_ratio || 'Chưa đặt' },
      { label: 'Màu hiển thị', value: form.color || 'Chưa đặt' },
    ]
  }
  if (form.kind === 'roof_preset') {
    return [
      { label: 'Tỷ lệ cao mái', value: form.roof_height_ratio || 'Chưa đặt' },
      { label: 'Cao mái tối thiểu', value: form.roof_height_min ? `${form.roof_height_min} m` : 'Chưa đặt' },
      { label: 'Cao thân tối thiểu', value: form.body_height_min ? `${form.body_height_min} m` : 'Chưa đặt' },
      { label: 'Độ nghiêng mái lệch', value: form.lean_to_tilt_rad || 'Chưa đặt' },
      { label: 'Tỷ lệ bo mái Thái', value: form.thai_radius_ratio || 'Chưa đặt' },
      { label: 'Màu mái', value: form.roof_color || 'Chưa đặt' },
    ]
  }
  if (form.kind === 'stair_preset') {
    return [
      { label: 'Số bậc', value: form.step_count || '0' },
      { label: 'Tỷ lệ sâu bậc', value: form.step_depth_ratio || 'Chưa đặt' },
      { label: 'Tỷ lệ rộng thang', value: form.step_width_ratio || 'Chưa đặt' },
      { label: 'Sâu bậc tối thiểu', value: form.min_step_depth ? `${form.min_step_depth} m` : 'Chưa đặt' },
      { label: 'Rộng thang tối thiểu', value: form.min_step_width ? `${form.min_step_width} m` : 'Chưa đặt' },
      { label: 'Tỷ lệ đổi hướng', value: form.turn_ratio || 'Chưa đặt' },
    ]
  }
  return [
    { label: 'Số giường', value: form.interior_bed_count || '0' },
    { label: 'Chiều dài bếp', value: form.kitchen_counter_length_total_m ? `${form.kitchen_counter_length_total_m} m` : '0 m' },
    { label: 'Bộ thiết bị WC', value: form.wc_fixture_set_count || '0' },
    { label: 'Tóm tắt', value: form.summary || 'Chưa có mô tả' },
  ]
}

export default function AssemblyPresetsPage() {
  const [items, setItems] = useState<TaxonomyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKind, setSelectedKind] = useState<PresetKind>('opening_preset')
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState<PresetForm>(emptyForm('opening_preset'))
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [showGuide, setShowGuide] = useState(false)

  const grouped = useMemo(() => {
    const out = {} as Record<PresetKind, TaxonomyRow[]>
    for (const kind of PRESET_KINDS) {
      out[kind] = items.filter((item) => item.kind === kind).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || a.name.localeCompare(b.name))
    }
    return out
  }, [items])

  const currentList = grouped[selectedKind] || []

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function loadData() {
    setLoading(true)
    const res = await fetch('/api/settings/estimate/taxonomies?active_only=false')
    const json = await res.json().catch(() => ({}))
    const rows = Array.isArray(json?.data) ? json.data.filter((row: TaxonomyRow) => PRESET_KINDS.includes(row.kind as PresetKind)) : []
    setItems(rows)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setForm(emptyForm(selectedKind))
      return
    }
    const hit = items.find((item) => item.id === selectedId)
    if (hit) setForm(formFromRow(hit))
  }, [items, selectedId, selectedKind])

  useEffect(() => {
    setSelectedId('')
    setForm(emptyForm(selectedKind))
  }, [selectedKind])

  async function saveForm() {
    const value = form.value.trim()
    const name = form.name.trim()
    if (!value || !name) {
      showToast('Cần nhập mã preset và tên preset')
      return
    }
    setSaving(true)
    try {
      const payload = {
        kind: form.kind,
        value,
        name,
        sort_order: Number(form.sort_order || 0) || 0,
        is_active: form.is_active,
        description: descriptionFromForm(form),
      }
      const res = await fetch(form.id ? `/api/settings/estimate/taxonomies/${form.id}` : '/api/settings/estimate/taxonomies', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(json?.error || 'Không lưu được preset')
        return
      }
      await loadData()
      const savedId = String(json?.data?.id || '')
      if (savedId) setSelectedId(savedId)
      showToast(form.id ? 'Đã cập nhật preset' : 'Đã tạo preset mới')
    } finally {
      setSaving(false)
    }
  }

  async function removeCurrent() {
    if (!form.id) return
    if (!confirm('Bạn có chắc chắn muốn xóa preset này?')) return
    await fetch(`/api/settings/estimate/taxonomies/${form.id}`, { method: 'DELETE' })
    setSelectedId('')
    setForm(emptyForm(selectedKind))
    await loadData()
    showToast('Đã xóa preset')
  }

  const meta = KIND_META[selectedKind]

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>ASSEMBLY PRESETS</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Preset dựng khối 2D / 3D</h1>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>
          Quản lý riêng preset ô mở, mái, cầu thang và nội thất để đội vận hành chỉnh nhanh mà không phải đi qua taxonomy tổng quát.
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Hướng dẫn sử dụng</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Trang này chỉ tập trung vào preset dựng hình và semantic preset cho block.</div>
          </div>
          <button className="btn btn-ghost" onClick={() => setShowGuide((v) => !v)} style={{ borderRadius: 10 }}>
            {showGuide ? 'Ẩn hướng dẫn' : 'Hiện hướng dẫn'}
          </button>
        </div>
        {showGuide && (
          <div style={{ marginTop: 12, display: 'grid', gap: 8, fontSize: 13, color: 'var(--text2)' }}>
            <div>Preset ô mở: dùng khi block chưa khai báo từng cửa/cửa sổ chi tiết, canvas sẽ hiển thị fallback bằng ký hiệu có dấu *.</div>
            <div>Preset mái và cầu thang: giúp đội sale/kỹ thuật có mô hình sơ bộ nhất quán hơn khi dựng phương án nhanh.</div>
            <div>Preset nội thất: không dựng đồ nội thất thật, nhưng giúp sinh semantic facts để dự toán và proposal hiểu đúng ngữ cảnh phòng.</div>
            <div>Nếu muốn thêm loại taxonomy khác, vẫn dùng trang Danh mục khái toán chung. Trang này chỉ dành cho các preset của assembly.</div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card" style={{ padding: 28, textAlign: 'center', color: 'var(--text3)' }}>Đang tải preset...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 14 }}>
          <div className="card" style={{ padding: 14, display: 'grid', gap: 12, alignSelf: 'start' }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Nhóm preset</label>
              <select
                className="select"
                value={selectedKind}
                onChange={(e) => setSelectedKind(e.target.value as PresetKind)}
              >
                {PRESET_KINDS.map((kind) => (
                  <option key={kind} value={kind}>{KIND_META[kind].title}</option>
                ))}
              </select>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{meta.hint}</div>

            <button
              className="btn btn-ghost"
              onClick={() => {
                setSelectedId('')
                setForm(emptyForm(selectedKind))
              }}
              style={{ borderRadius: 10 }}
            >
              + Tạo preset mới
            </button>

            <div style={{ display: 'grid', gap: 8 }}>
              {currentList.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có preset nào trong nhóm này.</div>
              ) : currentList.map((item) => (
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
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{form.id ? 'Sửa preset' : 'Tạo preset mới'}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{meta.title}</div>
              </div>
              {form.id && (
                <button className="btn btn-ghost" onClick={removeCurrent} style={{ borderRadius: 10, color: 'var(--red)' }}>
                  Xóa preset
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Mã preset</label>
                <input className="input" value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} placeholder="Ví dụ: door_single" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Tên hiển thị</label>
                <input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ví dụ: Cửa đi 1 cánh" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Mô tả ngắn</label>
                <textarea className="textarea" style={{ minHeight: 72 }} value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} placeholder="Giải thích preset này dùng trong trường hợp nào." />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Thứ tự</label>
                <input className="input" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} placeholder="0" />
              </div>
              <div style={{ display: 'flex', alignItems: 'end' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text2)' }}>
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
                  Đang kích hoạt
                </label>
              </div>

              {meta.fields.map((field) => (
                <div key={field.key} style={field.type === 'color' ? { maxWidth: 220 } : undefined}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>{field.label}</label>
                  {field.type === 'select' ? (
                    <select
                      className="select"
                      value={String(form[field.key as keyof PresetForm] || '')}
                      onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
                    >
                      <option value="">(không đặt)</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input"
                      type={field.type === 'color' ? 'color' : 'text'}
                      value={String(form[field.key as keyof PresetForm] || '')}
                      onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>Xem nhanh preset</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, .8fr)', gap: 12 }}>
                {renderPresetPreview(form)}
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'rgba(255,255,255,.02)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Thông số đang áp</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {renderPresetSummary(form).map((row) => (
                      <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, fontSize: 12 }}>
                        <div style={{ color: 'var(--text4)' }}>{row.label}</div>
                        <div style={{ color: 'var(--text2)', fontWeight: 600 }}>{row.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={saveForm} disabled={saving}>
                {saving ? 'Đang lưu...' : form.id ? 'Lưu thay đổi' : 'Tạo preset'}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setSelectedId('')
                  setForm(emptyForm(selectedKind))
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
