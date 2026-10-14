'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Material = {
  id: string
  material_key: string
  material_name: string
  unit: string
  price_per_unit: number
  region_code?: string | null
  source_note?: string | null
  is_active: boolean
}

type RecipeItem = {
  id: string
  material_key: string
  material_name?: string | null
  ratio_percent?: number | null
  quantity_per_m2?: number | null
  waste_factor?: number | null
  note?: string | null
  sort_order: number
}

type Recipe = {
  id: string
  recipe_key: string
  recipe_name: string
  house_type?: string | null
  style?: string | null
  level?: string | null
  is_active: boolean
  items: RecipeItem[]
}

type Taxonomy = {
  id: string
  kind: 'house_type' | 'style' | 'level' | 'supplier' | 'foundation_type' | 'item_unit'
  value: string
  name: string
  sort_order: number
  is_active: boolean
}

type MissingPricePrefill = {
  material_key: string
  material_name?: string
  unit?: string
}

type RegionOption = {
  code: string
  name: string
}

export default function EstimateKnowledgePage() {
  const searchParams = useSearchParams()
  const [materials, setMaterials] = useState<Material[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([])
  const [regionOptions, setRegionOptions] = useState<RegionOption[]>([{ code: 'ALL', name: 'ALL - Toan quoc' }])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [selectedRecipeId, setSelectedRecipeId] = useState('')

  const [newMaterial, setNewMaterial] = useState({
    material_key: '',
    material_name: '',
    unit: 'kg',
    price_per_unit: '',
    region_code: 'ALL',
    supplier_key: '',
    source_note: '',
  })

  const [newRecipe, setNewRecipe] = useState({
    recipe_key: '',
    recipe_name: '',
    house_type: '',
    style: '',
    level: '',
  })

  const [newItem, setNewItem] = useState({
    material_key: '',
    material_name: '',
    ratio_percent: '',
    quantity_per_m2: '',
    waste_factor: '',
    note: '',
    sort_order: '',
  })
  const prefillRegion = useMemo(() => String(searchParams.get('region') || 'ALL'), [searchParams])
  const prefillMissingItems = useMemo(() => {
    const raw = searchParams.get('missing_items')
    if (!raw) return [] as MissingPricePrefill[]
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return [] as MissingPricePrefill[]
      return parsed
        .map((x) => ({
          material_key: String(x?.material_key || '').trim(),
          material_name: String(x?.material_name || '').trim(),
          unit: String(x?.unit || '').trim(),
        }))
        .filter((x) => x.material_key)
    } catch {
      return [] as MissingPricePrefill[]
    }
  }, [searchParams])

  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === selectedRecipeId) || null,
    [recipes, selectedRecipeId]
  )
  const activeMaterials = useMemo(
    () => materials.filter((m) => m.is_active),
    [materials]
  )
  const houseTypeOptions = useMemo(() => {
    return taxonomies.filter((x) => x.kind === 'house_type' && x.is_active)
  }, [taxonomies])
  const styleOptions = useMemo(() => {
    return taxonomies.filter((x) => x.kind === 'style' && x.is_active)
  }, [taxonomies])
  const levelOptions = useMemo(() => {
    return taxonomies.filter((x) => x.kind === 'level' && x.is_active)
  }, [taxonomies])
  const unitOptions = useMemo(() => {
    return taxonomies
      .filter((x) => x.kind === 'item_unit')
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'vi'))
  }, [taxonomies])
  const supplierOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const x of taxonomies) {
      if (x.kind !== 'supplier' || !x.is_active) continue
      map.set(x.value, x.name || x.value)
    }
    for (const m of materials) {
      const key = extractSupplierFromNote(m.source_note)
      if (key && !map.has(key)) map.set(key, key)
    }
    return Array.from(map.entries()).map(([value, name]) => ({ value, name }))
  }, [taxonomies, materials])
  const regionOptionsFor = (current: string) => {
    const code = String(current || '').trim()
    if (!code) return regionOptions
    if (regionOptions.some((x) => x.code === code)) return regionOptions
    return [{ code, name: 'Custom' }, ...regionOptions]
  }
  const selectedRecipeMaterialKeys = useMemo(() => {
    if (!selectedRecipe) return new Set<string>()
    return new Set(selectedRecipe.items.map((x) => x.material_key))
  }, [selectedRecipe])
  const hasRatioInput = newItem.ratio_percent.trim() !== ''
  const hasQtyInput = newItem.quantity_per_m2.trim() !== ''

  async function loadAll() {
    setLoading(true)
    const [mRes, rRes, tRes, gRes] = await Promise.all([
      fetch('/api/settings/estimate/materials'),
      fetch('/api/settings/estimate/recipes'),
      fetch('/api/settings/estimate/taxonomies?active_only=false'),
      fetch('/api/settings/regions?active_only=true&level=province&limit=500'),
    ])
    const mJson = await mRes.json()
    const rJson = await rRes.json()
    const tJson = await tRes.json()
    const gJson = await gRes.json().catch(() => ({}))
    const mats = mJson.data || []
    const recs = rJson.data || []
    const txs = tJson.data || []
    const regions = Array.isArray(gJson.data) ? gJson.data : []
    setMaterials(mats)
    setRecipes(recs)
    setTaxonomies(txs)
    setRegionOptions([
      { code: 'ALL', name: 'ALL - Toan quoc' },
      ...regions.map((x: any) => ({ code: String(x.code || ''), name: String(x.name || x.code || '') })).filter((x: RegionOption) => x.code),
    ])
    if (!selectedRecipeId && recs.length) setSelectedRecipeId(recs[0].id)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])
  useEffect(() => {
    if (!prefillMissingItems.length) return
    setNewMaterial((prev) => {
      if (prev.material_key) return prev
      const first = prefillMissingItems[0]
      return {
        material_key: first.material_key || '',
        material_name: first.material_name || '',
        unit: first.unit || 'kg',
        price_per_unit: '',
        region_code: prefillRegion || 'ALL',
        supplier_key: '',
        source_note: prev.source_note || 'Prefill tu /estimates/generate-v2 (thieu gia)',
      }
    })
  }, [prefillMissingItems, prefillRegion])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2300)
  }

  function applyPrefillMaterial(item: MissingPricePrefill) {
    setNewMaterial((prev) => ({
      ...prev,
      material_key: item.material_key || '',
      material_name: item.material_name || '',
      unit: item.unit || prev.unit || 'kg',
      region_code: prefillRegion || prev.region_code || 'ALL',
      price_per_unit: '',
      supplier_key: '',
      source_note: 'Prefill tu /estimates/generate-v2 (thieu gia)',
    }))
  }

  async function createMaterial() {
    if (!newMaterial.material_key || !newMaterial.material_name || !newMaterial.unit || !newMaterial.price_per_unit) {
      showToast('Thiếu dữ liệu vật tư')
      return
    }
    setSaving(true)
    const res = await fetch('/api/settings/estimate/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newMaterial,
        source_note: composeSourceNote(newMaterial.source_note, newMaterial.supplier_key),
        price_per_unit: Number(newMaterial.price_per_unit),
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json()
      showToast(`Lỗi: ${j.error || 'Không thể tạo vật tư'}`)
      return
    }
    setNewMaterial({ material_key: '', material_name: '', unit: 'kg', price_per_unit: '', region_code: 'ALL', supplier_key: '', source_note: '' })
    await loadAll()
    showToast('Đã thêm giá vật tư')
  }

  async function patchMaterial(id: string, patch: any) {
    const res = await fetch(`/api/settings/estimate/materials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const j = await res.json()
      showToast(`Lỗi: ${j.error || 'Không thể cập nhật vật tư'}`)
      return
    }
    await loadAll()
    showToast('Đã cập nhật vật tư')
  }

  async function removeMaterial(id: string) {
    if (!confirm('Xóa vật tư này?')) return
    await fetch(`/api/settings/estimate/materials/${id}`, { method: 'DELETE' })
    await loadAll()
    showToast('Đã xóa vật tư')
  }

  async function createRecipe() {
    if (!newRecipe.recipe_key || !newRecipe.recipe_name) {
      showToast('Thiếu recipe_key hoặc recipe_name')
      return
    }
    const res = await fetch('/api/settings/estimate/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRecipe),
    })
    if (!res.ok) {
      const j = await res.json()
      showToast(`Lỗi: ${j.error || 'Không thể tạo recipe'}`)
      return
    }
    const j = await res.json()
    setSelectedRecipeId(j.data.id)
    setNewRecipe({ recipe_key: '', recipe_name: '', house_type: '', style: '', level: '' })
    await loadAll()
    showToast('Đã tạo recipe')
  }

  async function patchRecipe(id: string, patch: any) {
    const res = await fetch(`/api/settings/estimate/recipes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const j = await res.json()
      showToast(`Lỗi: ${j.error || 'Không thể cập nhật recipe'}`)
      return
    }
    await loadAll()
    showToast('Đã cập nhật recipe')
  }

  async function removeRecipe(id: string) {
    if (!confirm('Xóa recipe này và toàn bộ item?')) return
    await fetch(`/api/settings/estimate/recipes/${id}`, { method: 'DELETE' })
    setSelectedRecipeId('')
    await loadAll()
    showToast('Đã xóa recipe')
  }

  async function createRecipeItem() {
    if (!selectedRecipe) return
    if (!newItem.material_key) {
      showToast('Thiếu material_key')
      return
    }
    if (selectedRecipeMaterialKeys.has(newItem.material_key)) {
      showToast('Vật tư này đã tồn tại trong recipe')
      return
    }
    if (hasRatioInput === hasQtyInput) {
      showToast('chỉ nhập 1 trong 2: % ratio hoac qty/m2')
      return
    }
    const pickedMaterial = materials.find((m) => m.material_key === newItem.material_key)
    const res = await fetch(`/api/settings/estimate/recipes/${selectedRecipe.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newItem,
        material_name: newItem.material_name || pickedMaterial?.material_name || null,
        ratio_percent: newItem.ratio_percent ? Number(newItem.ratio_percent) : null,
        quantity_per_m2: newItem.quantity_per_m2 ? Number(newItem.quantity_per_m2) : null,
        waste_factor: newItem.waste_factor ? Number(newItem.waste_factor) : null,
        sort_order: newItem.sort_order ? Number(newItem.sort_order) : 0,
      }),
    })
    if (!res.ok) {
      const j = await res.json()
      showToast(`Lỗi: ${j.error || 'Không thể thêm item'}`)
      return
    }
    setNewItem({ material_key: '', material_name: '', ratio_percent: '', quantity_per_m2: '', waste_factor: '', note: '', sort_order: '' })
    await loadAll()
    showToast('Đã thêm item công thức')
  }

  async function patchRecipeItem(itemId: string, patch: any) {
    const res = await fetch(`/api/settings/estimate/recipe-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const j = await res.json()
      showToast(`Lỗi: ${j.error || 'Không thể cập nhật item'}`)
      return
    }
    await loadAll()
    showToast('Đã cập nhật item')
  }

  async function removeRecipeItem(itemId: string) {
    if (!confirm('Xóa item công thức này?')) return
    await fetch(`/api/settings/estimate/recipe-items/${itemId}`, { method: 'DELETE' })
    await loadAll()
    showToast('Đã xóa item')
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>
          ESTIMATION KNOWLEDGE
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Quản lý nguồn dữ liệu khái toán</h1>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          Nhập giá vật tư và công thức tỷ lệ theo loại nhà.
        </div>
      </div>

      {prefillMissingItems.length > 0 && (
        <div style={{ marginBottom: 12, border: '1px solid rgba(239,68,68,.35)', background: 'rgba(239,68,68,.08)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--red)', fontWeight: 700, marginBottom: 6 }}>
            Vật tư thiếu giá từ generate-v2 ({prefillMissingItems.length}): chọn để đổ sẵn form nhập giá.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {prefillMissingItems.map((x) => (
              <button
                key={x.material_key}
                onClick={() => applyPrefillMaterial(x)}
                style={{
                  background: 'rgba(59,130,246,.12)',
                  border: '1px solid rgba(59,130,246,.35)',
                  color: 'var(--blue)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {x.material_name || x.material_key} ({x.material_key})
              </button>
            ))}
          </div>
        </div>
      )}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 70 }}>
          <span className="spinner" style={{ width: 28, height: 28 }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 14 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.4, color: 'var(--text4)', fontWeight: 700, marginBottom: 10 }}>GIÁ VẬT TƯ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.8fr 0.8fr 1fr 1fr 0.8fr', gap: 8, marginBottom: 10, alignItems: 'end' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Mã vật tư</span>
                <input className="input" placeholder="key (cat)" value={newMaterial.material_key} onChange={(e) => setNewMaterial((p) => ({ ...p, material_key: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Tên vật tư</span>
                <input className="input" placeholder="Tên vật tư" value={newMaterial.material_name} onChange={(e) => setNewMaterial((p) => ({ ...p, material_name: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Đơn vị</span>
                <select className="select" value={newMaterial.unit} onChange={(e) => setNewMaterial((p) => ({ ...p, unit: e.target.value }))}>
                  {!unitOptions.some((u) => u.value === newMaterial.unit) && newMaterial.unit && (
                    <option value={newMaterial.unit}>{newMaterial.unit}</option>
                  )}
                  {unitOptions.length > 0 ? (
                    unitOptions.map((u) => (
                      <option key={u.id} value={u.value}>
                        {u.name}
                      </option>
                    ))
                  ) : (
                    <option value="kg">kg</option>
                  )}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Đơn giá</span>
                <input className="input" placeholder="giá" value={newMaterial.price_per_unit} onChange={(e) => setNewMaterial((p) => ({ ...p, price_per_unit: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Vùng</span>
                <select className="select" value={newMaterial.region_code} onChange={(e) => setNewMaterial((p) => ({ ...p, region_code: e.target.value }))}>
                  {regionOptionsFor(newMaterial.region_code).map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.code} - {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Nhà cung cấp</span>
                <input
                  className="input"
                  list="supplier-key-options"
                  placeholder="supplier_key (optional)"
                  value={newMaterial.supplier_key}
                  onChange={(e) => setNewMaterial((p) => ({ ...p, supplier_key: e.target.value }))}
                />
              </label>
              <button className="btn-primary" onClick={createMaterial} disabled={saving} style={{ fontSize: 12, height: 36 }}>+ Thêm</button>
            </div>
            <datalist id="supplier-key-options">
              {supplierOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.name}
                </option>
              ))}
            </datalist>
            <div style={{ marginTop: -4, marginBottom: 8, fontSize: 11, color: 'var(--text3)' }}>
              supplier_key sẽ được gán source_note theo định dạng [supplier:key] dùng để làm NCC được ưu tiên.
            </div>

            <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {materials.map((m) => (
                <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 0.7fr 0.9fr 1fr auto', gap: 8, alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--blue)', fontFamily: "'JetBrains Mono',monospace" }}>{m.material_key}</div>
                  <div style={{ fontSize: 12, color: 'var(--text)' }}>{m.material_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{m.unit}</div>
                  <div style={{ fontSize: 12, color: 'var(--orange)' }}>{m.price_per_unit.toLocaleString('vi-VN')}đ</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{extractSupplierFromNote(m.source_note) || '-'}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => {
                        const next = prompt('Giá mới', String(m.price_per_unit))
                        if (!next) return
                        patchMaterial(m.id, { price_per_unit: Number(next) })
                      }}
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text3)', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => {
                        const curr = extractSupplierFromNote(m.source_note) || ''
                        const next = prompt('supplier_key', curr)
                        if (next == null) return
                        patchMaterial(m.id, { source_note: composeSourceNote(m.source_note, next) })
                      }}
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text3)', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}
                    >
                      NCC
                    </button>
                    <button
                      onClick={() => patchMaterial(m.id, { is_active: !m.is_active })}
                      style={{ background: m.is_active ? 'rgba(34,197,94,.12)' : 'rgba(100,116,139,.12)', border: '1px solid var(--border2)', color: m.is_active ? 'var(--green)' : 'var(--text3)', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}
                    >
                      {m.is_active ? 'On' : 'Off'}
                    </button>
                    <button onClick={() => removeMaterial(m.id)} style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)', color: 'var(--red)', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.4, color: 'var(--text4)', fontWeight: 700, marginBottom: 10 }}>RECIPE KHÁI TOÁN</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 10 }}>
              <input className="input" placeholder="recipe_key" value={newRecipe.recipe_key} onChange={(e) => setNewRecipe((p) => ({ ...p, recipe_key: e.target.value }))} />
              <input className="input" placeholder="recipe_name" value={newRecipe.recipe_name} onChange={(e) => setNewRecipe((p) => ({ ...p, recipe_name: e.target.value }))} />
              <select className="select" value={newRecipe.house_type} onChange={(e) => setNewRecipe((p) => ({ ...p, house_type: e.target.value }))}>
                <option value="">house_type...</option>
                {houseTypeOptions.map((opt) => (
                  <option key={opt.id} value={opt.value}>{opt.name}</option>
                ))}
              </select>
              <select className="select" value={newRecipe.style} onChange={(e) => setNewRecipe((p) => ({ ...p, style: e.target.value }))}>
                <option value="">style...</option>
                {styleOptions.map((opt) => (
                  <option key={opt.id} value={opt.value}>{opt.name}</option>
                ))}
              </select>
              <select className="select" value={newRecipe.level} onChange={(e) => setNewRecipe((p) => ({ ...p, level: e.target.value }))}>
                <option value="">level...</option>
                {levelOptions.map((opt) => (
                  <option key={opt.id} value={opt.value}>{opt.name}</option>
                ))}
              </select>
              <button className="btn-primary" style={{ fontSize: 12 }} onClick={createRecipe}>+ Tạo</button>
            </div>
            {(houseTypeOptions.length === 0 || styleOptions.length === 0 || levelOptions.length === 0) && (
              <div style={{ fontSize: 12, color: 'var(--orange)', marginTop: -4, marginBottom: 8 }}>
                Thiếu danh mục phân loại. <a href="/settings/estimate-taxonomies" style={{ color: 'var(--blue)' }}>Estimate Taxonomies</a> .
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, marginBottom: 10 }}>
              <select className="select" value={selectedRecipeId} onChange={(e) => setSelectedRecipeId(e.target.value)}>
                <option value="">Chọn recipe...</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>{r.recipe_name} ({r.recipe_key})</option>
                ))}
              </select>
              {selectedRecipe && (
                <>
                  <button
                    onClick={() => patchRecipe(selectedRecipe.id, { is_active: !selectedRecipe.is_active })}
                    style={{ background: selectedRecipe.is_active ? 'rgba(34,197,94,.12)' : 'rgba(100,116,139,.12)', border: '1px solid var(--border2)', color: selectedRecipe.is_active ? 'var(--green)' : 'var(--text3)', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
                  >
                    {selectedRecipe.is_active ? 'Đang bật' : 'Đang tắt'}
                  </button>
                  <button onClick={() => removeRecipe(selectedRecipe.id)} style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)', color: 'var(--red)', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>
                    Xóa recipe
                  </button>
                </>
              )}
            </div>

            {selectedRecipe ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.8fr 0.8fr auto', gap: 8, marginBottom: 8 }}>
                  <select
                    className="select"
                    value={newItem.material_key}
                    onChange={(e) => {
                      const nextKey = e.target.value
                      const picked = activeMaterials.find((m) => m.material_key === nextKey) || null
                      setNewItem((p) => ({
                        ...p,
                        material_key: nextKey,
                        material_name: picked?.material_name || '',
                      }))
                    }}
                  >
                    <option value="">Chọn vật tư...</option>
                    {activeMaterials.map((m) => (
                      <option
                        key={m.id}
                        value={m.material_key}
                        disabled={selectedRecipeMaterialKeys.has(m.material_key)}
                      >
                        {m.material_name} ({m.material_key}) - {m.unit}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    placeholder="% ratio"
                    value={newItem.ratio_percent}
                    disabled={hasQtyInput}
                    onChange={(e) => setNewItem((p) => ({ ...p, ratio_percent: e.target.value, quantity_per_m2: '' }))}
                  />
                  <input
                    className="input"
                    placeholder="qty/m2"
                    value={newItem.quantity_per_m2}
                    disabled={hasRatioInput}
                    onChange={(e) => setNewItem((p) => ({ ...p, quantity_per_m2: e.target.value, ratio_percent: '' }))}
                  />
                  <button className="btn-primary" style={{ fontSize: 12 }} onClick={createRecipeItem}>+ Item</button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: -2, marginBottom: 8 }}>
                  Mọi vật tư chỉ được nhập 1 lần trong 1 recipe. Chỉ nhập 1 trong 2 trường: <strong>% ratio</strong> hoac <strong>qty/m2</strong>.
                </div>

                <div style={{ maxHeight: 330, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                  {selectedRecipe.items.map((it) => (
                    <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr 0.7fr 0.7fr auto', gap: 8, alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, color: 'var(--blue)', fontFamily: "'JetBrains Mono',monospace" }}>{it.material_key}</div>
                      <div style={{ fontSize: 12, color: 'var(--text)' }}>{it.material_name || '-'}</div>
                      <div style={{ fontSize: 12, color: 'var(--orange)' }}>{it.ratio_percent != null ? `${it.ratio_percent}%` : '-'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{it.quantity_per_m2 != null ? it.quantity_per_m2 : '-'}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => {
                            const ratio = prompt('ratio_percent (%)', it.ratio_percent != null ? String(it.ratio_percent) : '')
                            const qty = prompt('quantity_per_m2', it.quantity_per_m2 != null ? String(it.quantity_per_m2) : '')
                            const nextRatio = ratio === null ? it.ratio_percent : (ratio.trim() ? Number(ratio) : null)
                            const nextQty = qty === null ? it.quantity_per_m2 : (qty.trim() ? Number(qty) : null)
                            if ((nextRatio == null && nextQty == null) || (nextRatio != null && nextQty != null)) {
                              showToast('Item phải có đúng 1 trong 2: ratio_percent hoac quantity_per_m2')
                              return
                            }
                            patchRecipeItem(it.id, {
                              ratio_percent: nextRatio,
                              quantity_per_m2: nextQty,
                            })
                          }}
                          style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text3)', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}
                        >
                          Sửa
                        </button>
                        <button onClick={() => removeRecipeItem(it.id)} style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)', color: 'var(--red)', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                Chọn recipe để quản lý tỷ lệ vật tư.
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 9, padding: '10px 16px', fontSize: 13, zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function extractSupplierFromNote(note: string | null | undefined) {
  const raw = String(note || '')
  if (!raw) return ''
  const m = raw.match(/supplier\s*[:=]\s*([a-zA-Z0-9_-]+)/i)
  return m?.[1] ? m[1] : ''
}

function stripSupplierTag(note: string | null | undefined) {
  const raw = String(note || '')
  if (!raw) return ''
  return raw
    .replace(/\[?\s*supplier\s*[:=]\s*[a-zA-Z0-9_-]+\s*\]?/ig, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function composeSourceNote(note: string | null | undefined, supplierKey: string | null | undefined) {
  const cleanNote = stripSupplierTag(note)
  const key = String(supplierKey || '').trim()
  if (!key && !cleanNote) return null
  if (!key) return cleanNote
  if (!cleanNote) return `[supplier:${key}]`
  return `[supplier:${key}] ${cleanNote}`
}
