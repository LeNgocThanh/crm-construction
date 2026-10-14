'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { buildCompatibleMapFromTaxonomies, isTemplateTypeCompatibleWithMap } from '@/lib/estimate/template-compat'

type Assembly = {
  id: string
  customer_id?: string | null
  name: string
  house_type?: string | null
  style?: string | null
  level?: string | null
  region_code?: string | null
  status: string
  blocks?: Block[]
  updated_at?: string
}

type Block = {
  id: string
  component_type: string
  template_id?: string | null
  level_index: number
  block_name?: string | null
  dimensions_json?: any
  sort_order: number
  is_active: boolean
  template?: {
    id: string
    template_name: string
    template_code: string
    version?: number
  } | null
}

type Tax = { id: string; kind: string; value: string; name: string; is_active: boolean }
type Template = { id: string; template_code: string; template_name: string; template_type?: string | null; is_active: boolean }
type CustomerOption = { id: string; full_name: string | null; phone_number: string | null }
type RegionOption = { code: string; name: string }
type AssemblyPreset = {
  id: string
  name: string
  house_type?: string | null
  style?: string | null
  level?: string | null
  region_code?: string | null
  blocks?: Array<{ id: string }>
}

type PresetSummary = {
  houseTypeLabel: string
  styleLabel: string
  levelLabel: string
  regionLabel: string
  blockCount: number
  floorCount: number
}

type CompareRow = {
  assembly_id: string
  assembly_name: string
  customer_name: string
  block_count: number
  floors: number
  floor_area_total: number
  total_cost: number
  cost_per_m2: number
  status: 'ok' | 'error'
  error?: string
}

type CompareScope = {
  house_type: boolean
  style: boolean
  level: boolean
  region_code: boolean
}

type CompareBlockDiffRow = {
  key: string
  block_name: string
  component_type: string
  level_index: number
  assembly_a_cost: number
  assembly_b_cost: number
  delta_cost: number
}

export default function EstimateAssembliesPage() {
  const router = useRouter()
  const [assemblies, setAssemblies] = useState<Assembly[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [taxonomies, setTaxonomies] = useState<Tax[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([])
  const [regionOptions, setRegionOptions] = useState<RegionOption[]>([{ code: 'ALL', name: 'ALL - Toàn quốc' }])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [preview, setPreview] = useState<any>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [compareBusy, setCompareBusy] = useState(false)
  const [compareRows, setCompareRows] = useState<CompareRow[]>([])
  const [compareBlockDiffRows, setCompareBlockDiffRows] = useState<CompareBlockDiffRow[]>([])
  const [compareBlockPair, setCompareBlockPair] = useState<{ a: string; b: string } | null>(null)
  const [compareScope, setCompareScope] = useState<CompareScope>({
    house_type: true,
    style: false,
    level: true,
    region_code: true,
  })
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [presets, setPresets] = useState<AssemblyPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [presetName, setPresetName] = useState('')
  const [cloneForm, setCloneForm] = useState({
    from_level_index: '0',
    to_level_index: '1',
    overwrite_target: false,
  })
  const [replaceForm, setReplaceForm] = useState({
    component_type: 'wall',
    level_index: '',
    from_template_id: '',
    to_template_id: '',
  })
  const [replaceMatchedCount, setReplaceMatchedCount] = useState<number | null>(null)

  const [assemblyForm, setAssemblyForm] = useState({
    name: '',
    customer_id: '',
    house_type: '',
    style: '',
    level: 'tieu_chuan',
    region_code: 'ALL',
  })

  const [blockForm, setBlockForm] = useState({
    component_type: 'foundation',
    template_id: '',
    level_index: '0',
    block_name: '',
    length_m: '15',
    width_m: '5',
    height_m: '',
    area_m2: '',
    count: '1',
    wall_area_m2: '',
    wall_length_m: '',
    room_type: '',
    foundation_type: '',
    extra_json_text: '',
    sort_order: '0',
  })

  const selectedAssembly = useMemo(
    () => assemblies.find((x) => x.id === selectedId) || null,
    [assemblies, selectedId]
  )

  const componentTypeOptions = useMemo(() => {
    return taxonomies
      .filter((x) => x.kind === 'assembly_component_type' && x.is_active)
      .map((x) => ({ value: x.value, name: x.name || x.value }))
  }, [taxonomies])
  const roomTypeOptions = useMemo(
    () => taxonomies.filter((x) => x.kind === 'room_type' && x.is_active).map((x) => ({ value: x.value, name: x.name || x.value })),
    [taxonomies]
  )
  const foundationTypeOptions = useMemo(
    () => taxonomies.filter((x) => x.kind === 'foundation_type' && x.is_active).map((x) => ({ value: x.value, name: x.name || x.value })),
    [taxonomies]
  )
  const houseTypeOptions = useMemo(
    () => taxonomies.filter((x) => x.kind === 'house_type' && x.is_active).map((x) => ({ value: x.value, name: x.name || x.value })),
    [taxonomies]
  )
  const styleOptions = useMemo(
    () => taxonomies.filter((x) => x.kind === 'style' && x.is_active).map((x) => ({ value: x.value, name: x.name || x.value })),
    [taxonomies]
  )
  const levelOptions = useMemo(
    () => taxonomies.filter((x) => x.kind === 'level' && x.is_active).map((x) => ({ value: x.value, name: x.name || x.value })),
    [taxonomies]
  )
  const assemblyLevels = useMemo(() => {
    const set = new Set<number>()
    for (const b of selectedAssembly?.blocks || []) {
      const v = Number(b?.level_index)
      if (Number.isFinite(v)) set.add(Math.max(0, Math.trunc(v)))
    }
    return Array.from(set.values()).sort((a, b) => a - b)
  }, [selectedAssembly?.blocks])
  const componentTemplateCompatMap = useMemo(
    () => buildCompatibleMapFromTaxonomies(taxonomies as any),
    [taxonomies]
  )
  const compatibleTemplates = useMemo(() => {
    return templates.filter((t) =>
      isTemplateTypeCompatibleWithMap(blockForm.component_type, t.template_type || '', componentTemplateCompatMap)
    )
  }, [templates, blockForm.component_type, componentTemplateCompatMap])
  const replaceTemplateOptions = useMemo(() => {
    return templates.filter((t) =>
      isTemplateTypeCompatibleWithMap(replaceForm.component_type, t.template_type || '', componentTemplateCompatMap)
    )
  }, [templates, replaceForm.component_type, componentTemplateCompatMap])
  const selectedPreset = useMemo(
    () => presets.find((p) => p.id === selectedPresetId) || null,
    [presets, selectedPresetId]
  )
  const selectedPresetSummary = useMemo<PresetSummary | null>(() => {
    if (!selectedPreset) return null
    const houseTypeLabel = houseTypeOptions.find((x) => x.value === String(selectedPreset.house_type || ''))?.name || String(selectedPreset.house_type || '-')
    const styleLabel = styleOptions.find((x) => x.value === String(selectedPreset.style || ''))?.name || String(selectedPreset.style || '-')
    const levelLabel = levelOptions.find((x) => x.value === String(selectedPreset.level || ''))?.name || String(selectedPreset.level || '-')
    const regionLabel = regionOptions.find((x) => x.code === String(selectedPreset.region_code || 'ALL'))?.name || String(selectedPreset.region_code || 'ALL')
    const blockCount = Array.isArray(selectedPreset.blocks) ? selectedPreset.blocks.length : 0
    const floorSet = new Set<number>()
    for (const block of selectedPreset.blocks || []) {
      const level = Number((block as any)?.level_index)
      if (Number.isFinite(level)) floorSet.add(Math.max(0, Math.trunc(level)))
    }
    return {
      houseTypeLabel,
      styleLabel,
      levelLabel,
      regionLabel,
      blockCount,
      floorCount: floorSet.size,
    }
  }, [selectedPreset, houseTypeOptions, styleOptions, levelOptions, regionOptions])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) => (
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    ))
  }

  function isAssemblyMatchCompareScope(assembly: Assembly, base: Assembly | null) {
    if (!base) return true
    if (compareScope.house_type && String(assembly.house_type || '') !== String(base.house_type || '')) return false
    if (compareScope.style && String(assembly.style || '') !== String(base.style || '')) return false
    if (compareScope.level && String(assembly.level || '') !== String(base.level || '')) return false
    if (compareScope.region_code && String(assembly.region_code || 'ALL') !== String(base.region_code || 'ALL')) return false
    return true
  }

  const compareCandidateAssemblies = useMemo(() => {
    return assemblies.filter((assembly) => isAssemblyMatchCompareScope(assembly, selectedAssembly))
  }, [assemblies, selectedAssembly, compareScope])

  async function loadAll() {
    setLoading(true)
    const [aRes, tRes, tplRes, cRes, rRes, pRes] = await Promise.all([
      fetch('/api/assemblies?limit=100'),
      fetch('/api/settings/estimate/taxonomies?active_only=false'),
      fetch('/api/settings/estimate/templates?active_only=true'),
      fetch('/api/customers?limit=300&sort=updated_at&dir=desc'),
      fetch('/api/settings/regions?active_only=true&level=province&limit=500'),
      fetch('/api/assembly-presets?active_only=true&limit=200'),
    ])
    const aJson = await aRes.json().catch(() => ({}))
    const tJson = await tRes.json().catch(() => ({}))
    const tplJson = await tplRes.json().catch(() => ({}))
    const cJson = await cRes.json().catch(() => ({}))
    const rJson = await rRes.json().catch(() => ({}))
    const pJson = await pRes.json().catch(() => ({}))
    const rows = Array.isArray(aJson.data) ? aJson.data : []
    const txs = Array.isArray(tJson.data) ? tJson.data : []
    const tpls = Array.isArray(tplJson.data) ? tplJson.data : []
    const customers = Array.isArray(cJson.data) ? cJson.data : []
    const regions = Array.isArray(rJson.data) ? rJson.data : []
    const presetRows = Array.isArray(pJson.data) ? pJson.data : []
    setAssemblies(rows)
    setTaxonomies(txs)
    setTemplates(tpls.filter((x: any) => x?.is_active))
    setCustomerOptions(
      customers
        .map((x: any) => ({
          id: String(x.id || ''),
          full_name: x.full_name ? String(x.full_name) : null,
          phone_number: x.phone_number ? String(x.phone_number) : null,
        }))
        .filter((x: CustomerOption) => x.id)
    )
    setRegionOptions([
      { code: 'ALL', name: 'ALL - Toàn quốc' },
      ...regions
        .map((x: any) => ({ code: String(x.code || ''), name: String(x.name || x.code || '') }))
        .filter((x: RegionOption) => x.code),
    ])
    setPresets(presetRows)
    if (!selectedPresetId && presetRows.length) setSelectedPresetId(String(presetRows[0].id))
    if (!selectedId && rows.length) setSelectedId(rows[0].id)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])
  useEffect(() => {
    if (!componentTypeOptions.length) return
    setBlockForm((p) => ({ ...p, component_type: p.component_type || componentTypeOptions[0].value }))
  }, [componentTypeOptions])
  useEffect(() => {
    if (!componentTypeOptions.length) return
    const fallback = componentTypeOptions[0]?.value || 'wall'
    setReplaceForm((p) => ({
      ...p,
      component_type: p.component_type || fallback,
    }))
  }, [componentTypeOptions])
  useEffect(() => {
    if (!selectedAssembly) return
    setAssemblyForm({
      name: String(selectedAssembly.name || ''),
      customer_id: String(selectedAssembly.customer_id || ''),
      house_type: String(selectedAssembly.house_type || ''),
      style: String(selectedAssembly.style || ''),
      level: String(selectedAssembly.level || 'tieu_chuan'),
      region_code: String(selectedAssembly.region_code || 'ALL'),
    })
  }, [selectedAssembly?.id])
  useEffect(() => {
    if (!blockForm.template_id) return
    const current = templates.find((x) => x.id === blockForm.template_id) || null
    if (!current) return
    if (isTemplateTypeCompatibleWithMap(blockForm.component_type, current.template_type || '', componentTemplateCompatMap)) return
    setBlockForm((p) => ({ ...p, template_id: '' }))
  }, [blockForm.component_type, blockForm.template_id, templates, componentTemplateCompatMap])
  useEffect(() => {
    if (!selectedAssembly) return
    const levels = Array.from(
      new Set((selectedAssembly.blocks || []).map((b) => Math.max(0, Math.trunc(Number(b.level_index || 0)))))
    ).sort((a, b) => a - b)
    const from = levels[0] ?? 0
    const toCandidate = levels.find((x) => x !== from)
    const to = toCandidate ?? (from + 1)
    setCloneForm({
      from_level_index: String(from),
      to_level_index: String(to),
      overwrite_target: false,
    })
  }, [selectedAssembly?.id])
  useEffect(() => {
    setCompareRows([])
  }, [selectedAssembly?.id, compareScope.house_type, compareScope.style, compareScope.level, compareScope.region_code])

  async function createAssembly() {
    if (!assemblyForm.name.trim()) return showToast('Thiếu tên assembly')
    setSaving(true)
    const r = await fetch('/api/assemblies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...assemblyForm,
        customer_id: assemblyForm.customer_id.trim() || null,
      }),
    })
    setSaving(false)
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      return showToast(`Lỗi: ${j.error || 'Không tạo được assembly'}`)
    }
    const j = await r.json()
    const created = j.data
    await loadAll()
    setSelectedId(created.id)
    setAssemblyForm((p) => ({ ...p, name: '' }))
    showToast('Đã tạo assembly')
  }

  async function updateAssembly() {
    if (!selectedAssembly) return showToast('Chọn assembly để cập nhật')
    if (!assemblyForm.name.trim()) return showToast('Thiếu tên assembly')
    const ok = confirm('Bạn có chắc muốn cập nhật thông tin assembly này?')
    if (!ok) return
    setSaving(true)
    const r = await fetch(`/api/assemblies/${selectedAssembly.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...assemblyForm,
        customer_id: assemblyForm.customer_id.trim() || null,
      }),
    })
    setSaving(false)
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      return showToast(`Lỗi: ${j.error || 'Không cập nhật được assembly'}`)
    }
    await loadAll()
    setSelectedId(selectedAssembly.id)
    showToast('Đã cập nhật assembly')
  }

  async function removeAssembly(id: string, name: string) {
    const ok = confirm(`Xóa assembly "${name}"? Hành động này không thể hoàn tác.`)
    if (!ok) return
    const r = await fetch(`/api/assemblies/${id}`, { method: 'DELETE' })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      return showToast(`Lỗi: ${j.error || 'Không xóa được assembly'}`)
    }
    const nextRows = assemblies.filter((x) => x.id !== id)
    const nextId = selectedId === id ? (nextRows[0]?.id || '') : selectedId
    await loadAll()
    setSelectedId(nextId)
    if (selectedId === id && !nextId) {
      setAssemblyForm({
        name: '',
        customer_id: '',
        house_type: '',
        style: '',
        level: 'tieu_chuan',
        region_code: 'ALL',
      })
    }
    showToast('Đã xóa assembly')
  }

  async function addBlock() {
    if (!selectedAssembly) return
    let dims: any = {}
    const length = parsePosNum(blockForm.length_m)
    const width = parsePosNum(blockForm.width_m)
    const height = parsePosNum(blockForm.height_m)
    const area = parsePosNum(blockForm.area_m2)
    const count = parsePosNum(blockForm.count)

    if (length != null) dims.length_m = length
    if (width != null) dims.width_m = width
    if (height != null) dims.height_m = height
    if (area != null) dims.area_m2 = area
    if (count != null) dims.count = Math.max(1, Math.trunc(count))
    if (blockForm.component_type === 'wall') {
      const wallArea = parsePosNum(blockForm.wall_area_m2)
      const wallLength = parsePosNum(blockForm.wall_length_m)
      if (wallArea != null) dims.wall_area_m2 = wallArea
      if (wallLength != null) dims.wall_length_m = wallLength
    }
    if (blockForm.component_type === 'room' && blockForm.room_type) dims.room_type = blockForm.room_type
    if (blockForm.component_type === 'foundation' && blockForm.foundation_type) dims.foundation_type = blockForm.foundation_type

    const rawExtra = blockForm.extra_json_text.trim()
    if (rawExtra) {
      try {
        const extraObj = JSON.parse(rawExtra)
        if (!extraObj || typeof extraObj !== 'object' || Array.isArray(extraObj)) {
          return showToast('JSON nang cao phai la object')
        }
        dims = { ...dims, ...extraObj }
      } catch {
        return showToast('JSON nang cao khong hop le')
      }
    }
    if (Object.keys(dims).length === 0) dims = null

    const isEditing = Boolean(editingBlockId)
    const endpoint = isEditing
      ? `/api/assemblies/blocks/${editingBlockId}`
      : `/api/assemblies/${selectedAssembly.id}/blocks`
    const r = await fetch(endpoint, {
      method: isEditing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        component_type: blockForm.component_type,
        template_id: blockForm.template_id || null,
        level_index: Number(blockForm.level_index || 0),
        block_name: blockForm.block_name || null,
        dimensions_json: dims,
        sort_order: Number(blockForm.sort_order || 0),
      }),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      return showToast(`Lỗi: ${j.error || (isEditing ? 'Không sửa được block' : 'Không tạo được block')}`)
    }
    await loadAll()
    resetBlockForm()
    showToast(isEditing ? 'Đã cập nhật block' : 'Đã thêm block')
  }

  async function removeBlock(blockId: string) {
    if (!confirm('Xóa block này?')) return
    await fetch(`/api/assemblies/blocks/${blockId}`, { method: 'DELETE' })
    await loadAll()
    showToast('Đã xóa block')
  }

  async function cloneBlock(blockId: string) {
    const ok = confirm('Clone block này?')
    if (!ok) return
    const r = await fetch(`/api/assemblies/blocks/${blockId}/clone`, { method: 'POST' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return showToast(`Lỗi: ${j.error || 'Không clone được block'}`)
    const cloned = (j?.data || null) as Block | null
    await loadAll()
    if (selectedAssembly?.id) setSelectedId(selectedAssembly.id)
    if (cloned) beginEditBlock(cloned)
    showToast('Đã clone block')
  }

  async function cloneLevelBlocks() {
    if (!selectedAssembly) return
    const fromLevel = Number(cloneForm.from_level_index || 0)
    const toLevel = Number(cloneForm.to_level_index || 0)
    if (!Number.isFinite(fromLevel) || !Number.isFinite(toLevel)) return showToast('Tầng clone không hợp lệ')
    if (fromLevel === toLevel) return showToast('Tầng nguồn và tầng đích phải khác nhau')
    const ok = confirm(
      `Clone toàn bộ block từ tầng ${fromLevel} sang tầng ${toLevel}${cloneForm.overwrite_target ? ' (sẽ xóa block tầng đích trước)' : ''}?`
    )
    if (!ok) return
    setSaving(true)
    const r = await fetch(`/api/assemblies/${selectedAssembly.id}/clone-level`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_level_index: fromLevel,
        to_level_index: toLevel,
        overwrite_target: cloneForm.overwrite_target,
      }),
    })
    setSaving(false)
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return showToast(`Lỗi: ${j.error || 'Clone tầng thất bại'}`)
    await loadAll()
    setSelectedId(selectedAssembly.id)
    showToast(`Đã clone ${Number(j?.created_count || 0)} block`)
  }

  async function dryRunReplaceTemplate() {
    if (!selectedAssembly) return
    if (!replaceForm.component_type) return showToast('Thiếu component_type')
    if (!replaceForm.to_template_id) return showToast('Chọn template mới')
    const r = await fetch(`/api/assemblies/${selectedAssembly.id}/bulk-replace-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        component_type: replaceForm.component_type,
        level_index: replaceForm.level_index.trim() === '' ? null : Number(replaceForm.level_index),
        from_template_id: replaceForm.from_template_id || null,
        to_template_id: replaceForm.to_template_id,
        dry_run: true,
      }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return showToast(`Lỗi: ${j.error || 'Không dry-run được'}`)
    setReplaceMatchedCount(Number(j?.matched_count || 0))
    showToast(`Match ${Number(j?.matched_count || 0)} block`)
  }

  async function applyReplaceTemplate() {
    if (!selectedAssembly) return
    if (!replaceForm.component_type) return showToast('Thiếu component_type')
    if (!replaceForm.to_template_id) return showToast('Chọn template mới')
    const ok = confirm('Áp dụng đổi template hàng loạt cho các block match điều kiện?')
    if (!ok) return
    setSaving(true)
    const r = await fetch(`/api/assemblies/${selectedAssembly.id}/bulk-replace-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        component_type: replaceForm.component_type,
        level_index: replaceForm.level_index.trim() === '' ? null : Number(replaceForm.level_index),
        from_template_id: replaceForm.from_template_id || null,
        to_template_id: replaceForm.to_template_id,
        dry_run: false,
      }),
    })
    const j = await r.json().catch(() => ({}))
    setSaving(false)
    if (!r.ok) return showToast(`Lỗi: ${j.error || 'Không replace được'}`)
    const updated = Number(j?.updated_count || 0)
    setReplaceMatchedCount(Number(j?.matched_count || 0))
    await loadAll()
    if (selectedAssembly?.id) setSelectedId(selectedAssembly.id)
    if (updated > 0) {
      await runPreview()
      showToast(`Đã đổi template ${updated} block và đã preview lại`)
      return
    }
    showToast('Không có block nào được cập nhật')
  }

  function resetBlockForm() {
    setEditingBlockId(null)
    setBlockForm({
      component_type: componentTypeOptions[0]?.value || 'foundation',
      template_id: '',
      level_index: '0',
      block_name: '',
      length_m: '15',
      width_m: '5',
      height_m: '',
      area_m2: '',
      count: '1',
      wall_area_m2: '',
      wall_length_m: '',
      room_type: '',
      foundation_type: '',
      extra_json_text: '',
      sort_order: '0',
    })
  }

  function beginEditBlock(b: Block) {
    const dims = b?.dimensions_json && typeof b.dimensions_json === 'object' ? b.dimensions_json : {}
    const knownKeys = new Set(['length_m', 'length', 'build_length_m', 'width_m', 'width', 'build_width_m', 'height_m', 'height', 'floor_height_m', 'area_m2', 'area', 'floor_area', 'footprint_area', 'count', 'room_count', 'qty', 'room_type', 'foundation_type', 'wall_area_m2', 'wall_length_m'])
    const extra: Record<string, any> = {}
    for (const [k, v] of Object.entries(dims)) {
      if (!knownKeys.has(k)) extra[k] = v
    }
    const length = firstNum(dims, ['length_m', 'length', 'build_length_m'])
    const width = firstNum(dims, ['width_m', 'width', 'build_width_m'])
    const height = firstNum(dims, ['height_m', 'height', 'floor_height_m'])
    const area = firstNum(dims, ['area_m2', 'area', 'floor_area', 'footprint_area'])
    const count = firstNum(dims, ['count', 'room_count', 'qty'])
    const wallArea = firstNum(dims, ['wall_area_m2'])
    const wallLength = firstNum(dims, ['wall_length_m'])

    setEditingBlockId(b.id)
    setBlockForm({
      component_type: String(b.component_type || 'foundation'),
      template_id: String(b.template_id || ''),
      level_index: String(Number.isFinite(Number(b.level_index)) ? b.level_index : 0),
      block_name: String(b.block_name || ''),
      length_m: length != null ? String(length) : '',
      width_m: width != null ? String(width) : '',
      height_m: height != null ? String(height) : '',
      area_m2: area != null ? String(area) : '',
      count: count != null ? String(Math.max(1, Math.trunc(count))) : '1',
      wall_area_m2: wallArea != null ? String(wallArea) : '',
      wall_length_m: wallLength != null ? String(wallLength) : '',
      room_type: String((dims as any).room_type || ''),
      foundation_type: String((dims as any).foundation_type || ''),
      extra_json_text: Object.keys(extra).length ? JSON.stringify(extra, null, 2) : '',
      sort_order: String(Number.isFinite(Number(b.sort_order)) ? b.sort_order : 0),
    })
  }

  async function runPreview() {
    if (!selectedAssembly) return
    setLoading(true)
    setPreview(null)
    const r = await fetch(`/api/assemblies/${selectedAssembly.id}/estimate-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const j = await r.json().catch(() => ({}))
    setLoading(false)
    if (!r.ok) {
      setPreview(j)
      return showToast(`Lỗi: ${j.error || 'Không preview được'}`)
    }
    setPreview(j)
    showToast('Đã tính preview')
  }

  async function saveAsPreset() {
    if (!selectedAssembly) return showToast('Chọn assembly trước')
    const name = presetName.trim() || `${selectedAssembly.name} - preset`
    const r = await fetch('/api/assembly-presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        source_assembly_id: selectedAssembly.id,
        house_type: selectedAssembly.house_type || null,
        style: selectedAssembly.style || null,
        level: selectedAssembly.level || null,
        region_code: selectedAssembly.region_code || 'ALL',
      }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return showToast(`Lỗi: ${j.error || 'Không lưu được preset'}`)
    setPresetName('')
    await loadAll()
    setSelectedPresetId(String(j?.data?.id || selectedPresetId))
    showToast('Đã lưu assembly thành preset')
  }

  async function applyPresetToNewAssembly() {
    if (!selectedPresetId) return showToast('Chọn preset trước')
    const preset = presets.find((p) => p.id === selectedPresetId) || null
    const r = await fetch(`/api/assembly-presets/${selectedPresetId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: assemblyForm.customer_id.trim() || null,
        name: `${preset?.name || 'Preset'} - ${new Date().toLocaleDateString('vi-VN')}`,
        house_type: assemblyForm.house_type || preset?.house_type || null,
        style: assemblyForm.style || preset?.style || null,
        level: assemblyForm.level || preset?.level || null,
        region_code: assemblyForm.region_code || preset?.region_code || 'ALL',
      }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return showToast(`Lỗi: ${j.error || 'Không áp được preset'}`)
    await loadAll()
    setSelectedId(String(j?.data?.id || ''))
    showToast('Đã tạo assembly mới từ preset')
  }

  function openAssemblyResultPage() {
    if (!selectedAssembly || !preview?.data) {
      showToast('Chưa có dữ liệu preview để mở trang kết quả')
      return
    }
    const payload = preview?.inferred_input || {}
    const customer = customerOptions.find((x) => x.id === (selectedAssembly.customer_id || ''))
    const customerName = customer?.full_name?.trim() || null
    const context = {
      preview_result: preview.data,
      input_payload: payload,
      assembly: {
        id: selectedAssembly.id,
        name: selectedAssembly.name,
        customer_id: selectedAssembly.customer_id || null,
        customer_name: customerName,
        house_type: selectedAssembly.house_type || null,
        style: selectedAssembly.style || null,
        level: selectedAssembly.level || null,
        region_code: selectedAssembly.region_code || 'ALL',
      },
      blocks: selectedAssembly.blocks || [],
      assembly_summary: preview?.assembly_summary || null,
      created_at: new Date().toISOString(),
    }
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('assembly_estimate_preview_context_v1', JSON.stringify(context))
    }
    router.push('/estimates/assemblies/result-v2')
  }

  async function runCompareAssemblies() {
    if (compareIds.length < 2) return showToast('Chọn ít nhất 2 phương án để so sánh')
    setCompareBusy(true)
    try {
      const details = await Promise.all(compareIds.map(async (assemblyId) => {
        const assembly = assemblies.find((x) => x.id === assemblyId) || null
        const customer = customerOptions.find((x) => x.id === (assembly?.customer_id || ''))
        try {
          const r = await fetch(`/api/assemblies/${assemblyId}/estimate-preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
          const j = await r.json().catch(() => ({}))
          if (!r.ok) {
            return {
              row: {
                assembly_id: assemblyId,
                assembly_name: assembly?.name || assemblyId,
                customer_name: customer?.full_name?.trim() || '-',
                block_count: Number(assembly?.blocks?.length || 0),
                floors: 0,
                floor_area_total: 0,
                total_cost: 0,
                cost_per_m2: 0,
                status: 'error' as const,
                error: String(j?.error || 'Không preview được'),
              },
              blockGroups: [],
            }
          }
          const totalCost = Number(j?.data?.total_cost || 0)
          const area = Number(j?.assembly_summary?.inferred_floor_area_total || 0)
          return {
            row: {
              assembly_id: assemblyId,
              assembly_name: assembly?.name || assemblyId,
              customer_name: customer?.full_name?.trim() || '-',
              block_count: Number(j?.assembly_summary?.block_count || assembly?.blocks?.length || 0),
              floors: Number(j?.assembly_summary?.inferred_floors || 0),
              floor_area_total: area,
              total_cost: totalCost,
              cost_per_m2: area > 0 ? Math.round(totalCost / area) : 0,
              status: 'ok' as const,
            },
            blockGroups: buildBlockGroups(assembly?.blocks || [], Array.isArray(j?.data?.items) ? j.data.items : []),
          }
        } catch (error: any) {
          return {
            row: {
              assembly_id: assemblyId,
              assembly_name: assembly?.name || assemblyId,
              customer_name: customer?.full_name?.trim() || '-',
              block_count: Number(assembly?.blocks?.length || 0),
              floors: 0,
              floor_area_total: 0,
              total_cost: 0,
              cost_per_m2: 0,
              status: 'error' as const,
                error: String(error?.message || 'Không preview được'),
            },
            blockGroups: [],
          }
        }
      }))
      const rows = details.map((item) => item.row)
      setCompareRows(rows)
      if (details.length === 2 && details.every((item) => item.row.status === 'ok')) {
        const [a, b] = details
        const mapA = new Map<string, any>()
        const mapB = new Map<string, any>()
        for (const group of a.blockGroups) mapA.set(`${group.level_index}__${group.component_type}__${group.block_name}`, group)
        for (const group of b.blockGroups) mapB.set(`${group.level_index}__${group.component_type}__${group.block_name}`, group)
        const keys = Array.from(new Set([...mapA.keys(), ...mapB.keys()]))
        const diffRows: CompareBlockDiffRow[] = keys.map((key) => {
          const groupA = mapA.get(key)
          const groupB = mapB.get(key)
          const levelIndex = Number(groupA?.level_index ?? groupB?.level_index ?? 0)
          const componentType = String(groupA?.component_type || groupB?.component_type || '')
          const blockName = String(groupA?.block_name || groupB?.block_name || componentType || key)
          const costA = Number(groupA?.total || 0)
          const costB = Number(groupB?.total || 0)
          return {
            key,
            block_name: blockName,
            component_type: componentType,
            level_index: levelIndex,
            assembly_a_cost: costA,
            assembly_b_cost: costB,
            delta_cost: costB - costA,
          }
        }).sort((x, y) => Math.abs(y.delta_cost) - Math.abs(x.delta_cost))
        setCompareBlockDiffRows(diffRows)
        setCompareBlockPair({ a: a.row.assembly_name, b: b.row.assembly_name })
      } else {
        setCompareBlockDiffRows([])
        setCompareBlockPair(null)
      }
      showToast('Da cap nhat bang so sanh')
    } finally {
      setCompareBusy(false)
    }
  }

  function selectCompareCandidates() {
    const ids = compareCandidateAssemblies.map((assembly) => assembly.id)
    setCompareIds(ids)
    setCompareRows([])
    setCompareBlockDiffRows([])
    setCompareBlockPair(null)
    if (ids.length < 2) {
      showToast('Bộ lọc hiện tại chưa đủ 2 phương án cùng nhóm')
      return
    }
    showToast(`Đã chọn ${ids.length} phương án cùng nhóm`)
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>
          ASSEMBLY BUILDER
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Ghép công trình theo block</h1>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          Tạo phương án theo từng khối (móng, sàn, tường...) và xem trước giá trị dự toán sơ bộ.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 14 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.2, color: 'var(--text4)', fontWeight: 700, marginBottom: 8 }}>TẠO ASSEMBLY</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tên phương án</div>
              <input className="input" placeholder="Nhập tên phương án" value={assemblyForm.name} onChange={(e) => setAssemblyForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Khách hàng</div>
              <select className="select" value={assemblyForm.customer_id} onChange={(e) => setAssemblyForm((p) => ({ ...p, customer_id: e.target.value }))}>
              <option value="">(Không chọn khách hàng)</option>
              {customerOptions.map((c) => (
                <option key={c.id} value={c.id}>{(c.full_name?.trim() || 'Khách hàng')} - {c.phone_number || c.id}</option>
              ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Loại nhà</div>
              <select className="select" value={assemblyForm.house_type} onChange={(e) => setAssemblyForm((p) => ({ ...p, house_type: e.target.value }))}>
              <option value="">(Không chọn loại nhà)</option>
              {houseTypeOptions.map((x) => (
                <option key={x.value} value={x.value}>{x.name}</option>
              ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Phong cách</div>
              <select className="select" value={assemblyForm.style} onChange={(e) => setAssemblyForm((p) => ({ ...p, style: e.target.value }))}>
              <option value="">(Không chọn phong cách)</option>
              {styleOptions.map((x) => (
                <option key={x.value} value={x.value}>{x.name}</option>
              ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mức hoàn thiện</div>
              <select className="select" value={assemblyForm.level} onChange={(e) => setAssemblyForm((p) => ({ ...p, level: e.target.value }))}>
              {levelOptions.map((x) => (
                <option key={x.value} value={x.value}>{x.name}</option>
              ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Khu vực</div>
              <select className="select" value={assemblyForm.region_code} onChange={(e) => setAssemblyForm((p) => ({ ...p, region_code: e.target.value }))}>
              {regionOptions.map((r) => (
                <option key={r.code} value={r.code}>{r.code} - {r.name}</option>
              ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn-primary" disabled={saving} onClick={selectedAssembly ? updateAssembly : createAssembly}>
                {saving ? 'Đang lưu...' : selectedAssembly ? 'Cập nhật assembly' : 'Tạo assembly'}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setSelectedId('')
                  setAssemblyForm({
                    name: '',
                    customer_id: '',
                    house_type: '',
                    style: '',
                    level: 'tieu_chuan',
                    region_code: 'ALL',
                  })
                }}
                style={{ borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}
              >
                Tạo mới
              </button>
            </div>
          </div>

          <div style={{ fontSize: 11, letterSpacing: 1.2, color: 'var(--text4)', fontWeight: 700, margin: '14px 0 8px' }}>LƯU THÀNH PRESET</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: -2 }}>Tên preset</div>
            <input
              className="input"
              placeholder="Tên preset, ví dụ: Nhà phố tân cổ điển mẫu 1"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
            />
            <button className="btn-primary" onClick={saveAsPreset} disabled={!selectedAssembly}>
              Lưu assembly hiện tại thành preset
            </button>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: -2 }}>Preset có sẵn</div>
            <select className="select" value={selectedPresetId} onChange={(e) => setSelectedPresetId(e.target.value)}>
              <option value="">(Chọn preset để áp dụng)</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({Array.isArray(p.blocks) ? p.blocks.length : 0} blocks)
                </option>
              ))}
            </select>
            {selectedPresetSummary ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: 'rgba(59,130,246,.06)', display: 'grid', gap: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{selectedPreset?.name}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="chip">{selectedPresetSummary.houseTypeLabel}</span>
                  <span className="chip">{selectedPresetSummary.styleLabel}</span>
                  <span className="chip">{selectedPresetSummary.levelLabel}</span>
                  <span className="chip">{selectedPresetSummary.regionLabel}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {selectedPresetSummary.floorCount > 0 ? `${selectedPresetSummary.floorCount} tầng / cấp độ` : 'Chưa rõ số tầng'}
                  {' | '}
                  {selectedPresetSummary.blockCount} block
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {String(selectedPreset?.house_type || '').includes('biet_thu')
                    ? 'Hợp với khách cần phương án biệt thự mini, cần nhìn tổng thể mặt tiền và không gian rộng.'
                    : String(selectedPreset?.name || '').toLowerCase().includes('2 mat tien')
                      ? 'Hợp với lô đất góc hoặc nhà có 2 hướng thoáng, cần nhấn mạnh ánh sáng và mặt đứng.'
                      : String(selectedPreset?.name || '').toLowerCase().includes('lech tang')
                        ? 'Hợp với lô đất dài, cần tạo trải nghiệm không gian lệch cốt và thông tầng linh hoạt.'
                        : String(selectedPreset?.house_type || '').includes('nha_cap_4')
                          ? 'Hợp với khách ưu tiên ở một tầng, thi công gọn, dễ hình dung và dễ chốt không gian.'
                          : 'Hợp với khách cần phương án phổ thông để chốt nhanh quy mô, công năng và mặt tiền.'}
                </div>
              </div>
            ) : null}
            <button className="btn btn-ghost" onClick={applyPresetToNewAssembly} disabled={!selectedPresetId} style={{ borderRadius: 10, padding: '10px 14px', cursor: !selectedPresetId ? 'not-allowed' : 'pointer' }}>
              Tạo assembly mới từ preset
            </button>
          </div>

          <div style={{ fontSize: 11, letterSpacing: 1.2, color: 'var(--text4)', fontWeight: 700, margin: '14px 0 8px' }}>DANH SÁCH</div>
          <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            {assemblies.map((a) => {
              const matchedScope = isAssemblyMatchCompareScope(a, selectedAssembly)
              return (
              <div
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: selectedId === a.id ? 'rgba(59,130,246,.12)' : 'transparent',
                  borderBottom: '1px solid var(--border)',
                  color: matchedScope ? 'var(--text)' : 'var(--text3)',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  opacity: matchedScope ? 1 : 0.58,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={compareIds.includes(a.id)}
                      onChange={(e) => {
                        e.stopPropagation()
                        toggleCompare(a.id)
                      }}
                    />
                    <div style={{ fontSize: 13, fontWeight: 700, minWidth: 0 }}>{a.name}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeAssembly(a.id, a.name)
                    }}
                    style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)', color: 'var(--red)', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
                  >
                    Xóa
                  </button>
                </div>
                <div style={{ fontSize: 11, color: matchedScope ? 'var(--text3)' : 'var(--text4)' }}>
                  {a.id} | blocks: {a.blocks?.length || 0}
                  {!matchedScope ? ' | khác nhóm so sánh' : ''}
                </div>
              </div>
            )})}
          </div>

          <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.2, color: 'var(--text4)', fontWeight: 700, marginBottom: 8 }}>SO SÁNH PHƯƠNG ÁN</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)' }}>
                <input
                  type="checkbox"
                  checked={compareScope.house_type}
                  onChange={(e) => setCompareScope((prev) => ({ ...prev, house_type: e.target.checked }))}
                />
                Cùng loại nhà
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)' }}>
                <input
                  type="checkbox"
                  checked={compareScope.style}
                  onChange={(e) => setCompareScope((prev) => ({ ...prev, style: e.target.checked }))}
                />
                Cùng phong cách
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)' }}>
                <input
                  type="checkbox"
                  checked={compareScope.level}
                  onChange={(e) => setCompareScope((prev) => ({ ...prev, level: e.target.checked }))}
                />
                Cùng mức hoàn thiện
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)' }}>
                <input
                  type="checkbox"
                  checked={compareScope.region_code}
                  onChange={(e) => setCompareScope((prev) => ({ ...prev, region_code: e.target.checked }))}
                />
                Cùng vùng địa lý
              </label>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
              Đang thao tác theo phương án gốc: <strong>{selectedAssembly?.name || '(chưa chọn)'}</strong> | Ứng viên cùng nhóm: <strong>{compareCandidateAssemblies.length}</strong>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <button className="btn btn-ghost" onClick={selectCompareCandidates} disabled={!selectedAssembly} style={{ borderRadius: 10, padding: '10px 14px', cursor: !selectedAssembly ? 'not-allowed' : 'pointer' }}>
                Chọn nhanh cùng nhóm
              </button>
              <button className="btn-primary" onClick={runCompareAssemblies} disabled={compareBusy || compareIds.length < 2}>
                {compareBusy ? 'Đang so sánh...' : 'Cập nhật bảng so sánh'}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setCompareIds([])
                  setCompareRows([])
                }}
                style={{ borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}
              >
                Bỏ chọn / xóa bảng
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
              Tick tay nếu cần, hoặc dùng bộ lọc để chọn nhanh các phương án cùng nhóm rồi cập nhật bảng so sánh.
            </div>
            {compareRows.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: 'var(--text3)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Phương án</th>
                        <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Khách hàng</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Block</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Tầng</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Diện tích</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Tổng chi phí</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Đơn giá/m2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map((row) => (
                      <tr key={`compare-${row.assembly_id}`}>
                        <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(148,163,184,.12)' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{row.assembly_name}</div>
                          {row.status === 'error' && <div style={{ color: 'var(--red)', fontSize: 11 }}>{row.error || 'Lỗi preview'}</div>}
                        </td>
                        <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(148,163,184,.12)', color: 'var(--text2)' }}>{row.customer_name}</td>
                        <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(148,163,184,.12)', textAlign: 'right' }}>{row.block_count}</td>
                        <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(148,163,184,.12)', textAlign: 'right' }}>{row.floors}</td>
                        <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(148,163,184,.12)', textAlign: 'right' }}>{row.floor_area_total.toLocaleString('vi-VN')}</td>
                        <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(148,163,184,.12)', textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>{row.total_cost.toLocaleString('vi-VN')}đ</td>
                        <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(148,163,184,.12)', textAlign: 'right' }}>{row.cost_per_m2.toLocaleString('vi-VN')}đ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {compareBlockPair && compareBlockDiffRows.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                  Chênh lệch theo từng block: {compareBlockPair.a} {'->'} {compareBlockPair.b}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
                  Cột chênh lệch = chi phí phương án sau trừ phương án trước. Số dương là tăng, số âm là giảm.
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: 'var(--text3)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Block</th>
                        <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Loại</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Tầng</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>{compareBlockPair.a}</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>{compareBlockPair.b}</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Chênh lệch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareBlockDiffRows.map((row) => (
                        <tr key={row.key}>
                          <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(148,163,184,.12)', color: 'var(--text)' }}>{row.block_name}</td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(148,163,184,.12)', color: 'var(--text2)' }}>{row.component_type}</td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(148,163,184,.12)', textAlign: 'right' }}>{row.level_index + 1}</td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(148,163,184,.12)', textAlign: 'right' }}>{row.assembly_a_cost.toLocaleString('vi-VN')}d</td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(148,163,184,.12)', textAlign: 'right' }}>{row.assembly_b_cost.toLocaleString('vi-VN')}d</td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px solid rgba(148,163,184,.12)', textAlign: 'right', fontWeight: 700, color: row.delta_cost >= 0 ? 'var(--orange)' : 'var(--green)' }}>
                            {row.delta_cost >= 0 ? '+' : ''}{row.delta_cost.toLocaleString('vi-VN')}d
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.2, color: 'var(--text4)', fontWeight: 700, marginBottom: 8 }}>BLOCK</div>
          {!selectedAssembly ? (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chọn assembly bên trái.</div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
                Đang thao tác: <strong>{selectedAssembly.name}</strong>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text4)', fontWeight: 700, marginBottom: 6 }}>THAY TEMPLATE NHANH</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr', gap: 8, marginBottom: 8 }}>
                  <select
                    className="select"
                    value={replaceForm.component_type}
                    onChange={(e) => {
                      const next = e.target.value
                      setReplaceMatchedCount(null)
                      setReplaceForm((p) => ({ ...p, component_type: next, from_template_id: '', to_template_id: '' }))
                    }}
                  >
                    {componentTypeOptions.map((x) => (
                      <option key={`replace-component-${x.value}`} value={x.value}>{x.name}</option>
                    ))}
                  </select>
                  <input
                    className="input"
                    placeholder="level_index (bỏ trống = tất cả)"
                    value={replaceForm.level_index}
                    onChange={(e) => {
                      setReplaceMatchedCount(null)
                      setReplaceForm((p) => ({ ...p, level_index: e.target.value }))
                    }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <select
                    className="select"
                    value={replaceForm.from_template_id}
                    onChange={(e) => {
                      setReplaceMatchedCount(null)
                      setReplaceForm((p) => ({ ...p, from_template_id: e.target.value }))
                    }}
                  >
                    <option value="">(template hiện tại: tất cả)</option>
                    {replaceTemplateOptions.map((t) => (
                      <option key={`replace-from-${t.id}`} value={t.id}>{t.template_name} ({t.template_code})</option>
                    ))}
                  </select>
                  <select
                    className="select"
                    value={replaceForm.to_template_id}
                    onChange={(e) => {
                      setReplaceMatchedCount(null)
                      setReplaceForm((p) => ({ ...p, to_template_id: e.target.value }))
                    }}
                  >
                    <option value="">(chọn template mới)</option>
                    {replaceTemplateOptions.map((t) => (
                      <option key={`replace-to-${t.id}`} value={t.id}>{t.template_name} ({t.template_code})</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    className="btn btn-ghost"
                    onClick={dryRunReplaceTemplate}
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}
                  >
                    Xem trước số block
                  </button>
                  <button className="btn-primary" onClick={applyReplaceTemplate} disabled={saving}>
                    {saving ? 'Đang áp dụng...' : 'Áp dụng + xem trước'}
                  </button>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    Match: <strong style={{ color: 'var(--text2)' }}>{replaceMatchedCount == null ? '-' : replaceMatchedCount}</strong>
                  </div>
                </div>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text4)', fontWeight: 700, marginBottom: 6 }}>CLONE TẦNG</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, alignItems: 'center' }}>
                  <select
                    className="select"
                    value={cloneForm.from_level_index}
                    onChange={(e) => setCloneForm((p) => ({ ...p, from_level_index: e.target.value }))}
                  >
                    {assemblyLevels.length ? assemblyLevels.map((lv) => <option key={`from-${lv}`} value={String(lv)}>Từ tầng {lv}</option>) : <option value="0">Từ tầng 0</option>}
                  </select>
                  <input
                    className="input"
                    placeholder="Sang tầng"
                    value={cloneForm.to_level_index}
                    onChange={(e) => setCloneForm((p) => ({ ...p, to_level_index: e.target.value }))}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)' }}>
                    <input
                      type="checkbox"
                      checked={cloneForm.overwrite_target}
                      onChange={(e) => setCloneForm((p) => ({ ...p, overwrite_target: e.target.checked }))}
                    />
                    Ghi đè tầng đích
                  </label>
                  <button className="btn-primary" onClick={cloneLevelBlocks} disabled={saving}>
                    {saving ? 'Đang clone...' : 'Clone tầng'}
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select className="select" value={blockForm.component_type} onChange={(e) => setBlockForm((p) => ({ ...p, component_type: e.target.value }))}>
                  {componentTypeOptions.map((x) => (
                    <option key={x.value} value={x.value}>{x.name}</option>
                  ))}
                </select>
                <select className="select" value={blockForm.template_id} onChange={(e) => setBlockForm((p) => ({ ...p, template_id: e.target.value }))}>
                  <option value="">(không chọn template)</option>
                  {compatibleTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.template_name} ({t.template_code})</option>
                  ))}
                </select>
                <input className="input" placeholder="level_index" value={blockForm.level_index} onChange={(e) => setBlockForm((p) => ({ ...p, level_index: e.target.value }))} />
                <input className="input" placeholder="sort_order" value={blockForm.sort_order} onChange={(e) => setBlockForm((p) => ({ ...p, sort_order: e.target.value }))} />
              </div>
              <input className="input" style={{ marginTop: 8 }} placeholder="Tên block" value={blockForm.block_name} onChange={(e) => setBlockForm((p) => ({ ...p, block_name: e.target.value }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                <input className="input" placeholder="Chiều dài (m)" value={blockForm.length_m} onChange={(e) => setBlockForm((p) => ({ ...p, length_m: e.target.value }))} />
                <input className="input" placeholder="Chiều rộng (m)" value={blockForm.width_m} onChange={(e) => setBlockForm((p) => ({ ...p, width_m: e.target.value }))} />
                <input className="input" placeholder="Chiều cao (m)" value={blockForm.height_m} onChange={(e) => setBlockForm((p) => ({ ...p, height_m: e.target.value }))} />
                <input className="input" placeholder="Diện tích (m2)" value={blockForm.area_m2} onChange={(e) => setBlockForm((p) => ({ ...p, area_m2: e.target.value }))} />
                <input className="input" placeholder="Số lượng" value={blockForm.count} onChange={(e) => setBlockForm((p) => ({ ...p, count: e.target.value }))} />
                {blockForm.component_type === 'room' ? (
                  <select className="select" value={blockForm.room_type} onChange={(e) => setBlockForm((p) => ({ ...p, room_type: e.target.value }))}>
                    <option value="">(Loại phòng)</option>
                    {roomTypeOptions.map((x) => <option key={x.value} value={x.value}>{x.name}</option>)}
                  </select>
                ) : blockForm.component_type === 'wall' ? (
                  <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>
                    Nhập thông số tường ở dòng bên dưới.
                  </div>
                ) : blockForm.component_type === 'foundation' ? (
                  <select className="select" value={blockForm.foundation_type} onChange={(e) => setBlockForm((p) => ({ ...p, foundation_type: e.target.value }))}>
                    <option value="">(Loại móng)</option>
                    {foundationTypeOptions.map((x) => <option key={x.value} value={x.value}>{x.name}</option>)}
                  </select>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>
                    Loại phòng chỉ dùng cho block phòng.
                  </div>
                )}
              </div>
              {blockForm.component_type === 'wall' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  <input className="input" placeholder="wall_area_m2 (nếu có)" value={blockForm.wall_area_m2} onChange={(e) => setBlockForm((p) => ({ ...p, wall_area_m2: e.target.value }))} />
                  <input className="input" placeholder="wall_length_m (nếu có)" value={blockForm.wall_length_m} onChange={(e) => setBlockForm((p) => ({ ...p, wall_length_m: e.target.value }))} />
                </div>
              )}
              <textarea
                className="textarea"
                style={{ marginTop: 8, minHeight: 72 }}
                placeholder='JSON nâng cao (không bắt buộc), ví dụ: {"pile_depth_m":3}'
                value={blockForm.extra_json_text}
                onChange={(e) => setBlockForm((p) => ({ ...p, extra_json_text: e.target.value }))}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn-primary" onClick={addBlock}>{editingBlockId ? 'Lưu sửa block' : 'Thêm block'}</button>
                {editingBlockId && (
                  <button
                    className="btn btn-ghost"
                    onClick={resetBlockForm}
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}
                  >
                    Hủy sửa
                  </button>
                )}
                <button className="btn-primary" onClick={runPreview} disabled={loading}>{loading ? 'Đang tính...' : 'Xem trước dự toán'}</button>
                <button
                  className="btn btn-ghost"
                  onClick={() => router.push(`/estimates/assemblies/block-facts?assembly_id=${selectedAssembly.id}`)}
                  style={{ background: 'rgba(59,130,246,.10)', border: '1px solid rgba(59,130,246,.22)', color: 'var(--blue)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}
                >
                  Xem fact block
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => router.push(`/estimates/assemblies/designer-2d?assembly_id=${selectedAssembly.id}`)}
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}
                >
                  Designer 2D
                </button>
              </div>

              <div style={{ marginTop: 10, maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                {(selectedAssembly.blocks || []).map((b) => (
                  <div key={b.id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)' }}>
                        <strong>{b.block_name || b.component_type}</strong> | tầng {b.level_index}
                      </div>
                      <button
                        onClick={() => beginEditBlock(b)}
                        style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => cloneBlock(b.id)}
                        style={{ background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.25)', color: 'var(--blue)', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
                      >
                        Clone
                      </button>
                      <button
                        onClick={() => removeBlock(b.id)}
                        style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)', color: 'var(--red)', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
                      >
                        Xóa
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      template: {b.template?.template_name || '-'} | thứ tự: {b.sort_order}
                    </div>
                    {!!b.dimensions_json && (
                      <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 2, fontFamily: "'JetBrains Mono',monospace" }}>
                        {JSON.stringify(b.dimensions_json)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 14, padding: 14 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.2, color: 'var(--text4)', fontWeight: 700, marginBottom: 8 }}>PREVIEW</div>
        {!preview ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có kết quả preview.</div>
        ) : preview?.data ? (
          <div>
            <div style={{ marginBottom: 8 }}>
              <button className="btn-primary" onClick={openAssemblyResultPage}>
                Mở trang kết quả chi tiết theo block
              </button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>
              Tổng chi phí: <strong style={{ color: 'var(--green)' }}>{Number(preview.data.total_cost || 0).toLocaleString('vi-VN')}đ</strong>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
              Số dòng vật tư: {Array.isArray(preview.data.items) ? preview.data.items.length : 0}
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {(preview.data.items || []).map((it: any) => (
                <div key={it.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text)' }}>{it.material_name || it.material_key}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    SL: {it.quantity != null ? Number(it.quantity).toFixed(2) : '-'} | Thành tiền: {Number(it.cost || 0).toLocaleString('vi-VN')}đ
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', background: 'rgba(59,130,246,.10)', fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
                Tách theo từng Template + Items
              </div>
              {buildTemplateGroups(Array.isArray(preview?.data?.items) ? preview.data.items : []).length === 0 ? (
                <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>
                  Không có dòng nào gắn template.
                </div>
              ) : (
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {buildTemplateGroups(preview.data.items).map((g) => (
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
                            SL: {it.quantity != null ? Number(it.quantity).toFixed(2) : '-'} | Thành tiền: {Number(it.cost || 0).toLocaleString('vi-VN')}đ
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', background: 'rgba(59,130,246,.10)', fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
                Tách theo từng Block (theo template gắn cho block)
              </div>
              {buildBlockGroups(selectedAssembly?.blocks || [], Array.isArray(preview?.data?.items) ? preview.data.items : []).length === 0 ? (
                <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>
                  Chưa có block gắn template hoặc chưa map được dữ liệu item theo template.
                </div>
              ) : (
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {buildBlockGroups(selectedAssembly?.blocks || [], preview.data.items).map((g) => (
                    <div key={g.block_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <div style={{ padding: '8px 10px', background: 'rgba(148,163,184,.06)' }}>
                        <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700 }}>
                          {g.block_name} | {g.component_type} | lvl {g.level_index}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                          Template: {g.template_label || '(không template)'} | Tổng block: {Number(g.total || 0).toLocaleString('vi-VN')}đ
                        </div>
                      </div>
                      {g.items.map((it: any, idx: number) => (
                        <div key={`${g.block_id}-${it.id || idx}`} style={{ padding: '8px 10px', borderTop: '1px solid rgba(148,163,184,.12)' }}>
                          <div style={{ fontSize: 12, color: 'var(--text)' }}>{it.material_key} {it.material_name ? `- ${it.material_name}` : ''}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                            SL: {it.quantity != null ? Number(it.quantity).toFixed(2) : '-'} | Thành tiền: {Number(it.cost || 0).toLocaleString('vi-VN')}đ
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: 'var(--text3)' }}>{JSON.stringify(preview, null, 2)}</pre>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 9, padding: '10px 16px', fontSize: 13, zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function parsePosNum(v: string) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function firstNum(obj: any, keys: string[]) {
  for (const k of keys) {
    const n = Number(obj?.[k])
    if (Number.isFinite(n)) return n
  }
  return null
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
  return { key: `${code}${version}`, code, version, label }
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

function blockTemplateKey(block: Block) {
  const code = String(block?.template?.template_code || '').trim()
  if (!code) return ''
  const v = Number(block?.template?.version || 1)
  return `${code}@v${v}`
}

function buildBlockGroups(blocks: Block[], items: any[]) {
  const groupsByTemplate = new Map<string, any[]>()
  for (const it of items || []) {
    const parsed = parseTemplateNote(it?.note)
    if (!parsed) continue
    const key = `${parsed.code}${parsed.version || ''}`
    const list = groupsByTemplate.get(key) || []
    list.push(it)
    groupsByTemplate.set(key, list)
  }

  const out: Array<{
    block_id: string
    block_name: string
    component_type: string
    level_index: number
    template_label: string
    items: any[]
    total: number
  }> = []

  for (const b of blocks || []) {
    const code = String(b?.template?.template_code || '').trim()
    if (!code) continue
    const keyWithVersion = blockTemplateKey(b)
    const keyNoVersion = code
    const hit = groupsByTemplate.get(keyWithVersion) || groupsByTemplate.get(keyNoVersion) || []
    if (!hit.length) continue
    out.push({
      block_id: b.id,
      block_name: b.block_name || b.component_type,
      component_type: b.component_type,
      level_index: b.level_index || 0,
      template_label: b.template?.template_name
        ? `${b.template.template_name} (${keyWithVersion})`
        : keyWithVersion,
      items: hit,
      total: hit.reduce((s, x) => s + Number(x?.cost || 0), 0),
    })
  }
  return out
}
