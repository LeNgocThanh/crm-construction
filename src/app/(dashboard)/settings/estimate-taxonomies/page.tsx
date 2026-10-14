'use client'

import { useEffect, useMemo, useState } from 'react'

type Taxonomy = {
  id: string
  kind: string
  value: string
  name: string
  description?: string | null
  sort_order: number
  is_active: boolean
}

const KINDS: Array<{ key: string; title: string; hint: string }> = [
  { key: 'house_type', title: 'Loại nhà', hint: 'Ví dụ: nhà ống, biệt thự, shophouse...' },
  { key: 'foundation_type', title: 'Loại móng', hint: 'Ví dụ: móng cọc, móng băng, móng bè...' },
  { key: 'style', title: 'Phong cách', hint: 'Ví dụ: hiện đại, tân cổ điển...' },
  { key: 'level', title: 'Mức hoàn thiện', hint: 'Ví dụ: basic, standard, premium...' },
  { key: 'supplier', title: 'Nhà cung cấp', hint: 'Nhà cung cấp vật tư hoặc dịch vụ (dùng cho chính sách giá theo NCC).' },
  { key: 'template_type', title: 'Loại Template', hint: 'Ví dụ: room, house, foundation, mep...' },
  { key: 'room_type', title: 'Loại phòng/Hạng mục', hint: 'Phạm vi: bedroom, wc, kitchen, cầu thang, móng cọc...' },
  { key: 'opening_preset', title: 'Preset ô mở', hint: 'Ví dụ: cửa đơn, cửa đôi, cửa lùa, cửa sổ lớn... Dùng cho render opening và facts preset.' },
  { key: 'roof_preset', title: 'Preset mái', hint: 'Ví dụ: mái bằng, mái lệch, mái Thái cơ bản, sân thượng...' },
  { key: 'stair_preset', title: 'Preset cầu thang', hint: 'Ví dụ: thang thẳng, chữ L, chữ U. Hiện logic dựng hình vẫn do code xử lý theo value.' },
  { key: 'interior_preset', title: 'Preset nội thất', hint: 'Ví dụ: phòng ngủ cơ bản, bếp cơ bản, WC cơ bản. Dùng cho semantic block.' },
  { key: 'scope_type', title: 'Phạm vi tính toán', hint: 'Dùng cho template item: bedroom, wc, kitchen, tum, tường, mặt tiền...' },
  { key: 'item_type', title: 'Loại Item', hint: 'Phân loại: vật tư, nhân công, máy thi công, thiết bị...' },
  { key: 'item_group', title: 'Nhóm Item', hint: 'Nhóm: kết cấu, xây tô, MEP điện, nội thất...' },
  { key: 'item_unit', title: 'Đơn vị tính', hint: 'Đơn vị chuẩn: kg, m2, m3, cái, bộ, m, viên...' },
  { key: 'fact_key', title: 'Biến đầu vào (Fact)', hint: 'Biến đầu vào được phép dùng trong Rules và Formula builder.' },
  { key: 'required_fact', title: 'Required Fact', hint: 'Danh sách trường bắt buộc cho template item apply_mode=formula.' },
  { key: 'formula_preset', title: 'Mẫu công thức', hint: 'Mẫu biểu thức. Đặt công thức tính vào phần mô tả.' },
  { key: 'quantity_basis', title: 'Quantity Basis', hint: 'Nguồn nhân số lượng cho per_area/per_unit (ví dụ wall_surface_area_total, room_count).' },
  { key: 'context_profile', title: 'Hệ số bối cảnh', hint: 'Profile hệ số bối cảnh. Mô tả có thể lưu JSON: {"geo_factor":1, "labor_factor":1,...}' },
  { key: 'assembly_component_template_map', title: 'Map Component -> TemplateType', hint: 'Dinh dang value: component|template_type (vd: wall|structure).' },
]

export default function EstimateTaxonomiesPage() {
  const [items, setItems] = useState<Taxonomy[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [drafts, setDrafts] = useState<Record<string, { value: string; name: string; sort_order: string; description: string }>>(
    Object.fromEntries(KINDS.map((x) => [x.key, { value: '', name: '', sort_order: '', description: '' }]))
  )

  const grouped = useMemo(() => {
    const out: Record<string, Taxonomy[]> = {}
    for (const k of KINDS) out[k.key] = items.filter((x) => x.kind === k.key)
    return out
  }, [items])
  const componentTemplateMapPreview = useMemo(() => {
    const rows = items.filter((x) => x.kind === 'assembly_component_template_map' && x.is_active)
    const box: Record<string, Set<string>> = {}
    for (const row of rows) {
      const raw = String(row.value || '').trim()
      if (!raw) continue
      const parts = raw
        .split(/[\|:=>]/)
        .map((x) => String(x || '').trim().toLowerCase().replace(/\s+/g, '_'))
        .filter(Boolean)
      if (parts.length < 2) continue
      const comp = parts[0]
      const tType = parts[1]
      if (!box[comp]) box[comp] = new Set<string>()
      box[comp].add(tType)
    }
    return Object.entries(box)
      .map(([component, types]) => ({ component, templateTypes: Array.from(types).sort() }))
      .sort((a, b) => a.component.localeCompare(b.component))
  }, [items])
  const assemblyComponentTypeOptions = useMemo(
    () =>
      items
        .filter((x) => x.kind === 'assembly_component_type' && x.is_active)
        .map((x) => ({ value: x.value, name: x.name || x.value })),
    [items]
  )
  const templateTypeOptions = useMemo(
    () =>
      items
        .filter((x) => x.kind === 'template_type' && x.is_active)
        .map((x) => ({ value: x.value, name: x.name || x.value })),
    [items]
  )

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function loadAll() {
    setLoading(true)
    const res = await fetch('/api/settings/estimate/taxonomies?active_only=false')
    const json = await res.json()
    setItems(json.data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function createItem(kind: string) {
    const d = drafts[kind] || { value: '', name: '', sort_order: '', description: '' }
    const value = d.value.trim()
    const name = d.name.trim()
    if (!value || !name) {
      showToast('Thiếu mã (value) hoặc tên hiển thị (name)')
      return
    }

    const res = await fetch('/api/settings/estimate/taxonomies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        value,
        name,
        sort_order: d.sort_order ? Number(d.sort_order) : 0,
        description: d.description?.trim() || null,
      }),
    })
    if (!res.ok) {
      const j = await res.json()
      showToast(`Lỗi: ${j.error || 'Không thể tạo danh mục'}`)
      return
    }

    setDrafts((prev) => ({ ...prev, [kind]: { value: '', name: '', sort_order: '', description: '' } }))
    await loadAll()
    showToast('Đã thêm danh mục thành công')
  }

  async function patchItem(id: string, patch: Partial<Taxonomy>) {
    const res = await fetch(`/api/settings/estimate/taxonomies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const j = await res.json()
      showToast(`Lỗi: ${j.error || 'Không thể cập nhật'}`)
      return
    }
    await loadAll()
    showToast('Đã cập nhật')
  }

  async function removeItem(id: string) {
    if (!confirm('Bạn có chắc chắn muốn xóa danh mục này?')) return
    await fetch(`/api/settings/estimate/taxonomies/${id}`, { method: 'DELETE' })
    await loadAll()
    showToast('Đã xóa')
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>
          ESTIMATION TAXONOMIES
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Hệ thống Danh mục Khái toán</h1>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          Quản lý dữ liệu chuẩn hóa để dùng làm danh sách chọn cho các công thức và bảng tính khái toán.
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 70 }}>
          <span className="spinner" style={{ width: 28, height: 28 }} />
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.4, color: 'var(--text4)', fontWeight: 700, marginBottom: 6 }}>
              MAPPING PREVIEW (COMPONENT -&gt; TEMPLATE_TYPE[])
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
              Du lieu lay tu taxonomy kind <strong>assembly_component_template_map</strong>, value theo dang <strong>component|template_type</strong>.
            </div>
            {componentTemplateMapPreview.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chua co mapping active.</div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                {componentTemplateMapPreview.map((row) => (
                  <div key={row.component} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--blue)' }}>{row.component}</div>
                    <div style={{ fontSize: 12, color: 'var(--text)' }}>{row.templateTypes.join(', ')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            {KINDS.map((kind) => (
            <div key={kind.key} className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, letterSpacing: 1.4, color: 'var(--text4)', fontWeight: 700, marginBottom: 6 }}>{kind.title.toUpperCase()}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>{kind.hint}</div>
              {kind.key === 'assembly_component_template_map' && (
                <div style={{ border: '1px dashed var(--border2)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 6 }}>Nhap nhanh theo chon lua:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 6 }}>
                    <select
                      className="select"
                      value={(drafts[kind.key].value.split('|')[0] || '').trim()}
                      onChange={(e) => {
                        const left = String(e.target.value || '').trim()
                        const right = String((drafts[kind.key].value.split('|')[1] || '')).trim()
                        const nextValue = left && right ? `${left}|${right}` : left
                        const leftName = assemblyComponentTypeOptions.find((x) => x.value === left)?.name || left
                        const rightName = templateTypeOptions.find((x) => x.value === right)?.name || right
                        const nextName = left && right ? `${leftName} -> ${rightName}` : drafts[kind.key].name
                        setDrafts((p) => ({ ...p, [kind.key]: { ...p[kind.key], value: nextValue, name: nextName } }))
                      }}
                    >
                      <option value="">(chon component)</option>
                      {assemblyComponentTypeOptions.map((x) => (
                        <option key={x.value} value={x.value}>{x.name} ({x.value})</option>
                      ))}
                    </select>
                    <select
                      className="select"
                      value={(drafts[kind.key].value.split('|')[1] || '').trim()}
                      onChange={(e) => {
                        const right = String(e.target.value || '').trim()
                        const left = String((drafts[kind.key].value.split('|')[0] || '')).trim()
                        const nextValue = left && right ? `${left}|${right}` : `${left}${right ? `|${right}` : ''}`
                        const leftName = assemblyComponentTypeOptions.find((x) => x.value === left)?.name || left
                        const rightName = templateTypeOptions.find((x) => x.value === right)?.name || right
                        const nextName = left && right ? `${leftName} -> ${rightName}` : drafts[kind.key].name
                        setDrafts((p) => ({ ...p, [kind.key]: { ...p[kind.key], value: nextValue, name: nextName } }))
                      }}
                    >
                      <option value="">(chon template_type)</option>
                      {templateTypeOptions.map((x) => (
                        <option key={x.value} value={x.value}>{x.name} ({x.value})</option>
                      ))}
                    </select>
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        const v = drafts[kind.key].value.trim()
                        const parts = v.split('|').map((x) => x.trim())
                        if (parts.length < 2 || !parts[0] || !parts[1]) return
                        const leftName = assemblyComponentTypeOptions.find((x) => x.value === parts[0])?.name || parts[0]
                        const rightName = templateTypeOptions.find((x) => x.value === parts[1])?.name || parts[1]
                        setDrafts((p) => ({ ...p, [kind.key]: { ...p[kind.key], name: `${leftName} -> ${rightName}` } }))
                      }}
                      style={{ borderRadius: 8, fontSize: 12 }}
                    >
                      Gan ten
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text4)' }}>
                    Vi du: <code>wall|wall</code>, <code>wall|structure</code>, <code>room|room</code>, <code>stair|structure</code>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.8fr auto', gap: 8, marginBottom: 8 }}>
                <input
                  className="input"
                  placeholder="Mã (value)"
                  value={drafts[kind.key].value}
                  onChange={(e) => setDrafts((p) => ({ ...p, [kind.key]: { ...p[kind.key], value: e.target.value } }))}
                />
                <input
                  className="input"
                  placeholder="Tên hiển thị"
                  value={drafts[kind.key].name}
                  onChange={(e) => setDrafts((p) => ({ ...p, [kind.key]: { ...p[kind.key], name: e.target.value } }))}
                />
                <input
                  className="input"
                  placeholder="Sắp xếp"
                  value={drafts[kind.key].sort_order}
                  onChange={(e) => setDrafts((p) => ({ ...p, [kind.key]: { ...p[kind.key], sort_order: e.target.value } }))}
                />
                <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => createItem(kind.key)}>
                  + Thêm
                </button>
              </div>
              <input
                className="input"
                style={{ marginBottom: 10 }}
                placeholder={kind.key === 'context_profile' ? 'Mô tả hoặc JSON profile hệ số' : 'Mô tả thêm (không bắt buộc)'}
                value={drafts[kind.key].description}
                onChange={(e) => setDrafts((p) => ({ ...p, [kind.key]: { ...p[kind.key], description: e.target.value } }))}
              />

              <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                {grouped[kind.key].length === 0 ? (
                  <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>Chưa có dữ liệu</div>
                ) : (
                  grouped[kind.key].map((it) => (
                    <div
                      key={it.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1.2fr 0.55fr 1.4fr auto',
                        gap: 8,
                        alignItems: 'center',
                        padding: '8px 10px',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--blue)' }}>{it.value}</div>
                      <div style={{ fontSize: 12, color: 'var(--text)' }}>{it.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{it.sort_order}</div>
                      <div style={{ fontSize: 11, color: 'var(--text4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.description || '-'}</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => {
                            const next = prompt('Tên hiển thị mới', it.name)
                            if (!next || !next.trim()) return
                            patchItem(it.id, { name: next.trim() })
                          }}
                          style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text3)', borderRadius: 6, padding: '3px 6px', fontSize: 11, cursor: 'pointer' }}
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => {
                            const next = prompt('Mô tả mới', it.description || '')
                            if (next === null) return
                            patchItem(it.id, { description: next })
                          }}
                          style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text3)', borderRadius: 6, padding: '3px 6px', fontSize: 11, cursor: 'pointer' }}
                        >
                          Mô tả
                        </button>
                        <button
                          onClick={() => patchItem(it.id, { is_active: !it.is_active })}
                          style={{ background: it.is_active ? 'rgba(34,197,94,.12)' : 'rgba(100,116,139,.12)', border: '1px solid var(--border2)', color: it.is_active ? 'var(--green)' : 'var(--text3)', borderRadius: 6, padding: '3px 6px', fontSize: 11, cursor: 'pointer' }}
                        >
                          {it.is_active ? 'Bật' : 'Tắt'}
                        </button>
                        <button
                          onClick={() => removeItem(it.id)}
                          style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)', color: 'var(--red)', borderRadius: 6, padding: '3px 6px', fontSize: 11, cursor: 'pointer' }}
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            ))}
          </div>
        </>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 9, padding: '10px 16px', fontSize: 13, zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
