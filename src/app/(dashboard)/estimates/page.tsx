'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Recipe = {
  id: string
  recipe_key: string
  recipe_name: string
}

type RegionOption = {
  code: string
  name: string
}

export default function EstimatesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [regionOptions, setRegionOptions] = useState<RegionOption[]>([{ code: 'ALL', name: 'ALL - Toàn quốc' }])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [result, setResult] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [suggestedInputs, setSuggestedInputs] = useState<Record<string, string>>({})
  const [missingDetails, setMissingDetails] = useState<string[]>([])

  const [form, setForm] = useState({
    customer_id: '',
    recipe_id: '',
    region_code: 'ALL',
    floor_area_total: '',
    floors: '3',
    tum_count: '1',
    basement_count: '0',
    finish_level: 'tieu_chuan',
    base_cost_per_m2: '',
  })

  useEffect(() => {
    loadRecipes()
    loadRegions()
    loadHistory()
  }, [])

  async function loadRegions() {
    const r = await fetch('/api/settings/regions?active_only=true&level=province&limit=500')
    const j = await r.json().catch(() => ({}))
    const rows = Array.isArray(j.data) ? j.data : []
    setRegionOptions([
      { code: 'ALL', name: 'ALL - Toàn quốc' },
      ...rows.map((x: any) => ({ code: String(x.code || ''), name: String(x.name || x.code || '') })).filter((x: RegionOption) => x.code),
    ])
  }

  async function loadRecipes() {
    const r = await fetch('/api/settings/estimate/recipes')
    const j = await r.json()
    const list = (j.data || []).filter((x: any) => x.is_active)
    setRecipes(list)
    if (!form.recipe_id && list.length) {
      setForm((p) => ({ ...p, recipe_id: list[0].id }))
    }
  }

  async function loadHistory() {
    const r = await fetch('/api/estimates?limit=10')
    const j = await r.json()
    setHistory(j.data || [])
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2300)
  }

  async function generate() {
    const localMissing: string[] = []
    const hasRecipe = Boolean(form.recipe_id)
    const hasBase = Boolean(form.base_cost_per_m2 && Number(form.base_cost_per_m2) > 0)
    if (!form.floor_area_total || Number(form.floor_area_total) <= 0) localMissing.push('floor_area_total')
    if (!hasRecipe && !hasBase) localMissing.push('recipe_or_base_cost')
    setMissingFields(localMissing)
    setSuggestedInputs({})
    setMissingDetails([])
    if (localMissing.length > 0) {
      showToast('Chưa đủ dữ liệu, vui lòng bổ sung trước khi tạo khái toán')
      return
    }

    setLoading(true)
    setResult(null)
    const r = await fetch('/api/estimates/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: form.customer_id || null,
        recipe_id: form.recipe_id,
        region_code: form.region_code || 'ALL',
        floor_area_total: Number(form.floor_area_total),
        floors: Number(form.floors || 0),
        tum_count: Number(form.tum_count || 0),
        basement_count: Number(form.basement_count || 0),
        has_elevator: false,
        finish_level: form.finish_level,
        base_cost_per_m2: form.base_cost_per_m2 ? Number(form.base_cost_per_m2) : null,
      }),
    })
    const j = await r.json()
    setLoading(false)
    if (!r.ok) {
      setMissingFields(Array.isArray(j.missing_fields) ? j.missing_fields : [])
      setSuggestedInputs(j.suggested_inputs || {})
      setMissingDetails(Array.isArray(j.details) ? j.details : [])
      showToast(`Lỗi: ${j.error || 'Không thể tạo khái toán'}`)
      return
    }
    setMissingFields([])
    setSuggestedInputs({})
    setMissingDetails([])
    setResult(j.data)
    await loadHistory()
    showToast('Đã tạo và lưu khái toán')
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>
          ESTIMATION
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 5 }}>Khái toán nhanh từ tri thức chuẩn</h1>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          Sử dụng recipe + bảng giá đã nạp để tạo báo cáo tạm tính và lưu vào DB.
        </div>
        <div style={{ marginTop: 8 }}>
          <Link
            href="/estimates/extract"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              fontSize: 12,
              color: 'var(--blue)',
              marginRight: 14,
            }}
          >
            Mở bóc tách dữ liệu
          </Link>
          <Link
            href="/estimates/generate-v2"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              fontSize: 12,
              color: 'var(--blue)',
            }}
          >
            Mở Dự toán sơ bộ (case + template + rules) 
          </Link>
          <Link
            href="/estimates/assemblies"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              fontSize: 12,
              color: 'var(--blue)',
              marginTop: 8,
            }}
          >
            Mở ghép block công trình
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.3, color: 'var(--text4)', fontWeight: 700, marginBottom: 10 }}>THÔNG SỐ KHÁI TOÁN</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mã khách hàng</div>
              <input className="input" placeholder="Nhập customer_id nếu có" value={form.customer_id} onChange={(e) => setForm((p) => ({ ...p, customer_id: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Recipe áp dụng</div>
              <select className="select" value={form.recipe_id} onChange={(e) => setForm((p) => ({ ...p, recipe_id: e.target.value }))}>
                <option value="">Chọn recipe</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>{r.recipe_name} ({r.recipe_key})</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Khu vực</div>
              <select className="select" value={form.region_code} onChange={(e) => setForm((p) => ({ ...p, region_code: e.target.value }))}>
                {!regionOptions.some((r) => r.code === form.region_code) && (
                  <option value={form.region_code}>{form.region_code} - Tùy chọn riêng</option>
                )}
                {regionOptions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.code} - {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Tổng diện tích sàn (m2)</div>
              <input className="input" placeholder="Ví dụ: 250" value={form.floor_area_total} onChange={(e) => setForm((p) => ({ ...p, floor_area_total: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Số tầng</div>
              <input className="input" placeholder="Ví dụ: 3" value={form.floors} onChange={(e) => setForm((p) => ({ ...p, floors: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Số tum</div>
              <input className="input" placeholder="Ví dụ: 1" value={form.tum_count} onChange={(e) => setForm((p) => ({ ...p, tum_count: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Số hầm</div>
              <input className="input" placeholder="Ví dụ: 0" value={form.basement_count} onChange={(e) => setForm((p) => ({ ...p, basement_count: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mức hoàn thiện</div>
              <select className="select" value={form.finish_level} onChange={(e) => setForm((p) => ({ ...p, finish_level: e.target.value }))}>
                <option value="co_ban">Cơ bản</option>
                <option value="tieu_chuan">Tiêu chuẩn</option>
                <option value="cao_cap">Cao cấp</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Đơn giá cơ sở / m2</div>
              <input className="input" placeholder="Không bắt buộc" value={form.base_cost_per_m2} onChange={(e) => setForm((p) => ({ ...p, base_cost_per_m2: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
            Có 2 cách tạo: (1) chọn recipe, hoặc (2) nhập đơn giá cơ sở / m2 để tính nhanh. Luôn cần tổng diện tích sàn.
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--orange)' }}>
            Khái toán tạm tính chưa bao gồm các hạng mục phụ trợ (ví dụ: thang máy, nội thất rời, sân vườn, điện 3 pha đặc biệt...).
          </div>

          <div style={{ marginTop: 12 }}>
            <button className="btn-primary" onClick={generate} disabled={loading} style={{ minWidth: 180 }}>
              {loading ? 'Đang tính...' : 'Tạo khái toán'}
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.3, color: 'var(--text4)', fontWeight: 700, marginBottom: 10 }}>KẾT QUẢ</div>
          {!result ? (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                Chưa có kết quả. Hãy nhập thông số và bấm tạo khái toán.
              </div>
              {missingFields.length > 0 && (
                <div style={{ border: '1px solid rgba(239,68,68,.35)', background: 'rgba(239,68,68,.08)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--red)', fontWeight: 700, marginBottom: 6 }}>Đang thiếu dữ liệu:</div>
                  {missingFields.map((f) => (
                    <div key={f} style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>
                      - {f}{suggestedInputs[f] ? `: ${suggestedInputs[f]}` : ''}
                    </div>
                  ))}
                  {missingDetails.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {missingDetails.map((line, idx) => (
                        <div key={`${line}-${idx}`} style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>
                          - {line}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>
                Mã báo giá: <span style={{ color: 'var(--text)' }}>{result.id}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>
                Tổng chi phí: <span style={{ color: 'var(--green)', fontWeight: 700 }}>{Number(result.total_cost || 0).toLocaleString('vi-VN')}đ</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
                Chế độ định giá: <span style={{ color: 'var(--blue)' }}>{result.pricing_mode || '-'}</span>
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                {(result.items || []).map((it: any) => (
                  <div key={it.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 3 }}>{it.material_key} {it.material_name ? `- ${it.material_name}` : ''}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      SL: {it.quantity != null ? Number(it.quantity).toFixed(2) : '-'} | Đơn giá: {it.unit_price != null ? Number(it.unit_price).toLocaleString('vi-VN') : '-'} | Thành tiền: {Number(it.cost || 0).toLocaleString('vi-VN')}đ
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text4)' }}>{it.price_source}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 14, padding: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.3, color: 'var(--text4)', fontWeight: 700, marginBottom: 10 }}>LỊCH SỬ KHÁI TOÁN GẦN NHẤT</div>
        <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {history.length === 0 ? (
            <div style={{ padding: 12, fontSize: 12, color: 'var(--text3)' }}>Chưa có khái toán nào.</div>
          ) : history.map((q) => (
            <div key={q.id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text)' }}>{q.recipe_name || q.recipe_key || '-'}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(q.created_at).toLocaleString('vi-VN')} · {q.region_code || 'ALL'}</div>
              </div>
                <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>{Number(q.total_cost || 0).toLocaleString('vi-VN')}đ</div>
            </div>
          ))}
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
