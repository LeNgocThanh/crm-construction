'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Warehouse = { id: string; warehouse_code: string; warehouse_name: string }
type CatalogItem = { id: string; item_code: string; item_name: string; item_unit: string }
type StockRow = {
  id: string
  warehouse_id: string
  material_key: string
  material_name?: string | null
  item_unit?: string | null
  on_hand_qty: number
  reserved_qty: number
  available_qty: number
  avg_unit_cost?: number
  stock_value?: number
  min_qty?: number | null
  max_qty?: number | null
  warehouse?: Warehouse | null
}

export default function InventoryStocksPage() {
  const searchParams = useSearchParams()
  const [rows, setRows] = useState<StockRow[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    warehouse_id: String(searchParams.get('warehouse_id') || ''),
    material_key: String(searchParams.get('material_key') || ''),
    low_only: searchParams.get('low_only') === 'true',
  })

  async function loadWarehouses() {
    const res = await fetch('/api/settings/warehouses?active_only=true')
    const j = await res.json().catch(() => ({}))
    setWarehouses(Array.isArray(j?.data) ? j.data : [])
  }

  async function loadCatalog() {
    const res = await fetch('/api/settings/estimate/catalog-items?active_only=true')
    const j = await res.json().catch(() => ({}))
    setCatalog(Array.isArray(j?.data) ? j.data : [])
  }

  async function loadRows() {
    setLoading(true)
    const sp = new URLSearchParams()
    if (filter.warehouse_id) sp.set('warehouse_id', filter.warehouse_id)
    if (filter.material_key.trim()) sp.set('material_key', filter.material_key.trim())
    if (filter.low_only) sp.set('low_only', 'true')
    const res = await fetch(`/api/inventory/stocks?${sp.toString()}`)
    const j = await res.json().catch(() => ({}))
    setRows(Array.isArray(j?.data) ? j.data : [])
    setLoading(false)
  }

  useEffect(() => {
    loadWarehouses()
    loadCatalog()
  }, [])

  useEffect(() => {
    loadRows()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text4)', letterSpacing: 2, marginBottom: 4 }}>INVENTORY STOCKS</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Tồn kho</h1>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8 }}>
          <select className="select" value={filter.warehouse_id} onChange={(e) => setFilter((p) => ({ ...p, warehouse_id: e.target.value }))}>
            <option value="">Tất cả kho</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.warehouse_name} ({w.warehouse_code})
              </option>
            ))}
          </select>
          <select className="select" value={filter.material_key} onChange={(e) => setFilter((p) => ({ ...p, material_key: e.target.value }))}>
            <option value="">Tat ca vat tu</option>
            {catalog.map((m) => (
              <option key={m.id} value={m.item_code}>
                {m.item_name} ({m.item_code})
              </option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <input type="checkbox" checked={filter.low_only} onChange={(e) => setFilter((p) => ({ ...p, low_only: e.target.checked }))} />
            Chỉ dưới min
          </label>
          <button className="btn-primary" onClick={loadRows}>Lọc</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr .9fr .8fr .8fr .8fr .9fr .9fr', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
          <div>KHO</div>
          <div>VẬT TƯ</div>
          <div>TÊN</div>
          <div style={{ textAlign: 'right' }}>ON_HAND</div>
          <div style={{ textAlign: 'right' }}>AVAILABLE</div>
          <div style={{ textAlign: 'center' }}>ĐV</div>
          <div style={{ textAlign: 'right' }}>AVG COST</div>
          <div style={{ textAlign: 'right' }}>STOCK VALUE</div>
        </div>
        <div style={{ maxHeight: 620, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 14, color: 'var(--text3)' }}>Đang tải...</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 14, color: 'var(--text3)' }}>Không có dữ liệu tồn kho.</div>
          ) : (
            rows.map((x) => {
              const low = x.min_qty != null && Number(x.on_hand_qty || 0) <= Number(x.min_qty || 0)
              return (
                <div key={x.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr .9fr .8fr .8fr .8fr .9fr .9fr', gap: 8, padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                  <div>{x.warehouse?.warehouse_name || x.warehouse_id}</div>
                  <div style={{ color: 'var(--blue)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{x.material_key}</div>
                  <div style={{ color: 'var(--text3)' }}>{x.material_name || '-'}</div>
                  <div style={{ textAlign: 'right', color: low ? 'var(--red)' : 'var(--text)' }}>{Number(x.on_hand_qty || 0)}</div>
                  <div style={{ textAlign: 'right', color: low ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>{Number(x.available_qty || 0)}</div>
                  <div style={{ textAlign: 'center', color: 'var(--text3)' }}>{x.item_unit || '-'}</div>
                  <div style={{ textAlign: 'right', color: 'var(--text3)' }}>{Number(x.avg_unit_cost || 0).toLocaleString('vi-VN')}</div>
                  <div style={{ textAlign: 'right', color: 'var(--orange)' }}>{Number(x.stock_value || 0).toLocaleString('vi-VN')}</div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
