'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Warehouse = { id: string; warehouse_code: string; warehouse_name: string }
type Supplier = { id: string; supplier_code?: string; supplier_name: string }
type CatalogItem = { id: string; item_code: string; item_name: string; item_unit?: string | null }

type PriceLogRow = {
  id: string
  material_key: string
  material_name?: string | null
  item_unit?: string | null
  supplier_id?: string | null
  supplier_name?: string | null
  warehouse_id?: string | null
  warehouse_name?: string | null
  price_kind?: string | null
  unit_price: number
  quantity: number
  line_total: number
  cycle_no?: number | null
  effective_at?: string | null
  txn_code?: string | null
  source_note?: string | null
  latest_config_price?: number | null
  latest_config_valid_from?: string | null
  gap_amount?: number | null
  gap_pct?: number | null
}

type MaterialChangeRow = {
  material_key: string
  material_name?: string | null
  item_unit?: string | null
  first_price: number
  last_price: number
  change_amount: number
  change_pct?: number | null
  sample_count: number
  latest_supplier_name?: string | null
  latest_at?: string | null
}

type SupplierChangeRow = {
  supplier_id?: string | null
  supplier_name?: string | null
  material_key?: string | null
  material_name?: string | null
  item_unit?: string | null
  first_price: number
  last_price: number
  change_amount: number
  change_pct?: number | null
  sample_count: number
  latest_at?: string | null
}

type ActualVsConfigRow = {
  supplier_id?: string | null
  supplier_name?: string | null
  material_key: string
  material_name?: string | null
  item_unit?: string | null
  latest_actual_price: number
  latest_actual_at?: string | null
  latest_config_price?: number | null
  latest_config_at?: string | null
  gap_amount?: number | null
  gap_pct?: number | null
}

type DashboardData = {
  filters?: {
    warehouse_id?: string | null
    supplier_id?: string | null
    material_key?: string | null
    price_kind?: string | null
    date_from?: string | null
    date_to?: string | null
  }
  pagination?: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
  summary?: {
    log_count: number
    material_count: number
    supplier_count: number
    avg_actual_price: number
    min_actual_price: number
    max_actual_price: number
    increased_material_count: number
    decreased_material_count: number
  }
  top_material_increases: MaterialChangeRow[]
  top_material_decreases: MaterialChangeRow[]
  top_supplier_changes: SupplierChangeRow[]
  actual_vs_config: ActualVsConfigRow[]
  logs: PriceLogRow[]
}

const EMPTY_DATA: DashboardData = {
  pagination: { page: 1, page_size: 20, total: 0, total_pages: 1 },
  summary: {
    log_count: 0,
    material_count: 0,
    supplier_count: 0,
    avg_actual_price: 0,
    min_actual_price: 0,
    max_actual_price: 0,
    increased_material_count: 0,
    decreased_material_count: 0,
  },
  top_material_increases: [],
  top_material_decreases: [],
  top_supplier_changes: [],
  actual_vs_config: [],
  logs: [],
}

function toInputDate(value: Date) {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatMoney(value?: number | null) {
  return `${Number(value || 0).toLocaleString('vi-VN')} vnd`
}

function formatNumber(value?: number | null) {
  return Number(value || 0).toLocaleString('vi-VN')
}

function formatPercent(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return '-'
  const n = Number(value)
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function formatDeltaMoney(value?: number | null) {
  if (value == null) return '-'
  const n = Number(value || 0)
  return `${n >= 0 ? '+' : ''}${n.toLocaleString('vi-VN')} vnd`
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

function priceKindLabel(value?: string | null) {
  switch (value) {
    case 'inventory_in': return 'Nhập kho thực tế'
    case 'transfer_in': return 'Nhập chuyển kho'
    case 'direct_purchase': return 'Mua trực tiếp'
    case 'supplier_quote': return 'Giá NCC'
    case 'manual': return 'Điều chỉnh tay'
    default: return value || '-'
  }
}

export default function InventoryPricesPage() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [data, setData] = useState<DashboardData>(EMPTY_DATA)
  const [filters, setFilters] = useState({
    warehouse_id: String(searchParams.get('warehouse_id') || ''),
    supplier_id: String(searchParams.get('supplier_id') || ''),
    material_key: String(searchParams.get('material_key') || ''),
    price_kind: String(searchParams.get('price_kind') || ''),
    date_from: String(searchParams.get('date_from') || toInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))),
    date_to: String(searchParams.get('date_to') || toInputDate(new Date())),
    page: Number(searchParams.get('page') || '1') || 1,
  })

  async function loadLookups() {
    const [warehouseRes, supplierRes, catalogRes] = await Promise.all([
      fetch('/api/settings/warehouses?active_only=true', { cache: 'no-store' }),
      fetch('/api/settings/suppliers?active_only=true', { cache: 'no-store' }),
      fetch('/api/settings/estimate/catalog-items?active_only=true', { cache: 'no-store' }),
    ])
    const warehouseJson = await warehouseRes.json().catch(() => ({}))
    const supplierJson = await supplierRes.json().catch(() => ({}))
    const catalogJson = await catalogRes.json().catch(() => ({}))
    setWarehouses(Array.isArray(warehouseJson?.data) ? warehouseJson.data : [])
    setSuppliers(Array.isArray(supplierJson?.data) ? supplierJson.data : [])
    setCatalog(Array.isArray(catalogJson?.data) ? catalogJson.data : [])
  }

  async function loadData(nextFilters = filters) {
    setLoading(true)
    try {
      const sp = new URLSearchParams()
      if (nextFilters.warehouse_id) sp.set('warehouse_id', nextFilters.warehouse_id)
      if (nextFilters.supplier_id) sp.set('supplier_id', nextFilters.supplier_id)
      if (nextFilters.material_key) sp.set('material_key', nextFilters.material_key)
      if (nextFilters.price_kind) sp.set('price_kind', nextFilters.price_kind)
      if (nextFilters.date_from) sp.set('date_from', new Date(nextFilters.date_from).toISOString())
      if (nextFilters.date_to) sp.set('date_to', new Date(nextFilters.date_to).toISOString())
      sp.set('page', String(nextFilters.page || 1))
      sp.set('page_size', '20')
      const res = await fetch(`/api/inventory/prices?${sp.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast(json?.error || 'Không tải được dữ liệu biến động giá')
        return
      }
      setData({
        filters: json?.filters || {},
        pagination: json?.pagination || EMPTY_DATA.pagination,
        summary: json?.summary || EMPTY_DATA.summary,
        top_material_increases: Array.isArray(json?.top_material_increases) ? json.top_material_increases : [],
        top_material_decreases: Array.isArray(json?.top_material_decreases) ? json.top_material_decreases : [],
        top_supplier_changes: Array.isArray(json?.top_supplier_changes) ? json.top_supplier_changes : [],
        actual_vs_config: Array.isArray(json?.actual_vs_config) ? json.actual_vs_config : [],
        logs: Array.isArray(json?.logs) ? json.logs : [],
      })
    } finally {
      setLoading(false)
    }
  }

  function buildExportUrl(nextFilters = filters) {
    const sp = new URLSearchParams()
    if (nextFilters.warehouse_id) sp.set('warehouse_id', nextFilters.warehouse_id)
    if (nextFilters.supplier_id) sp.set('supplier_id', nextFilters.supplier_id)
    if (nextFilters.material_key) sp.set('material_key', nextFilters.material_key)
    if (nextFilters.price_kind) sp.set('price_kind', nextFilters.price_kind)
    if (nextFilters.date_from) sp.set('date_from', new Date(nextFilters.date_from).toISOString())
    if (nextFilters.date_to) sp.set('date_to', new Date(nextFilters.date_to).toISOString())
    return `/api/inventory/prices/export?${sp.toString()}`
  }

  function buildPrintUrl(nextFilters = filters) {
    const sp = new URLSearchParams()
    if (nextFilters.warehouse_id) sp.set('warehouse_id', nextFilters.warehouse_id)
    if (nextFilters.supplier_id) sp.set('supplier_id', nextFilters.supplier_id)
    if (nextFilters.material_key) sp.set('material_key', nextFilters.material_key)
    if (nextFilters.price_kind) sp.set('price_kind', nextFilters.price_kind)
    if (nextFilters.date_from) sp.set('date_from', new Date(nextFilters.date_from).toISOString())
    if (nextFilters.date_to) sp.set('date_to', new Date(nextFilters.date_to).toISOString())
    sp.set('print', '1')
    return `/api/inventory/prices/print?${sp.toString()}`
  }

  useEffect(() => {
    void loadLookups()
    void loadData()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const summary = data.summary || EMPTY_DATA.summary!
  const pagination = data.pagination || EMPTY_DATA.pagination!

  const selectedWarehouseName = useMemo(
    () => warehouses.find((row) => row.id === filters.warehouse_id)?.warehouse_name || 'Tất cả kho',
    [warehouses, filters.warehouse_id]
  )

  const selectedSupplierName = useMemo(
    () => suppliers.find((row) => row.id === filters.supplier_id)?.supplier_name || 'Tất cả NCC',
    [suppliers, filters.supplier_id]
  )

  const cardStyle: React.CSSProperties = {
    padding: 12,
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: 'var(--panel)',
  }

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    fontSize: 11,
    padding: '10px 12px',
    position: 'sticky',
    top: 0,
    background: 'var(--panel)',
    zIndex: 1,
    borderBottom: '1px solid var(--border)',
  }

  const tdStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'top',
    fontSize: 13,
  }

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text4)', letterSpacing: 2, marginBottom: 4 }}>KHO / GIA VAT TU</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Biến động giá vật tư</h1>
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text3)' }}>
            Theo dõi giá nhập thực tế, biến động theo NCC và so sánh với giá cấu hình hiện tại.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <a href={buildExportUrl(filters)} className="btn">Xuat Excel</a>
          <a href={buildPrintUrl(filters)} target="_blank" rel="noreferrer" className="btn">In / PDF</a>
          <Link href="/inventory" className="btn">Mở tổng quan kho</Link>
          <Link href="/settings/suppliers-pricing" className="btn">Mở NCC & bảng giá</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Kho</div>
            <select className="select" value={filters.warehouse_id} onChange={(e) => setFilters((prev) => ({ ...prev, warehouse_id: e.target.value, page: 1 }))}>
              <option value="">Tất cả kho</option>
              {warehouses.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.warehouse_name} ({row.warehouse_code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Nhà cung cấp</div>
            <select className="select" value={filters.supplier_id} onChange={(e) => setFilters((prev) => ({ ...prev, supplier_id: e.target.value, page: 1 }))}>
              <option value="">Tất cả NCC</option>
              {suppliers.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.supplier_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Vật tư</div>
            <select className="select" value={filters.material_key} onChange={(e) => setFilters((prev) => ({ ...prev, material_key: e.target.value, page: 1 }))}>
              <option value="">Tất cả vật tư</option>
              {catalog.map((row) => (
                <option key={row.id} value={row.item_code}>
                  {row.item_name} ({row.item_code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Loại giá</div>
            <select className="select" value={filters.price_kind} onChange={(e) => setFilters((prev) => ({ ...prev, price_kind: e.target.value, page: 1 }))}>
              <option value="">Tất cả loại giá</option>
              <option value="inventory_in">Nhập kho thực tế</option>
              <option value="transfer_in">Nhập chuyển kho</option>
              <option value="direct_purchase">Mua trực tiếp</option>
              <option value="supplier_quote">Giá NCC</option>
              <option value="manual">Điều chỉnh tay</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Từ ngày</div>
            <input className="input" type="date" value={filters.date_from} onChange={(e) => setFilters((prev) => ({ ...prev, date_from: e.target.value, page: 1 }))} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Đến ngày</div>
            <input className="input" type="date" value={filters.date_to} onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value, page: 1 }))} />
          </div>
          <button className="btn-primary" onClick={() => void loadData(filters)}>Xem biến động giá</button>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
          Phạm vi hiện tại: <b>{selectedWarehouseName}</b> | <b>{selectedSupplierName}</b>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Dòng giá trong kỳ</div><div style={{ fontSize: 22, fontWeight: 800 }}>{formatNumber(summary.log_count)}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Mã vật tư có biến động</div><div style={{ fontSize: 22, fontWeight: 800 }}>{formatNumber(summary.material_count)}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Nhà cung cấp có phát sinh</div><div style={{ fontSize: 22, fontWeight: 800 }}>{formatNumber(summary.supplier_count)}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Đơn giá thực tế bình quân</div><div style={{ fontSize: 22, fontWeight: 800 }}>{formatMoney(summary.avg_actual_price)}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Đơn giá thấp nhất</div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{formatMoney(summary.min_actual_price)}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Đơn giá cao nhất</div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--orange)' }}>{formatMoney(summary.max_actual_price)}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Vật tư tăng giá</div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--orange)' }}>{formatNumber(summary.increased_material_count)}</div></div>
        <div style={cardStyle}><div style={{ fontSize: 11, color: 'var(--text4)' }}>Vật tư giảm giá</div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{formatNumber(summary.decreased_material_count)}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Vật tư tăng giá mạnh trong kỳ</div>
          <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Vật tư</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Đầu kỳ</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Cuối kỳ</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Biến động</th>
                </tr>
              </thead>
              <tbody>
                {data.top_material_increases.map((row) => (
                  <tr key={row.material_key}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>{row.material_name || row.material_key}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.material_key} | {row.item_unit || '-'}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{formatMoney(row.first_price)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{formatMoney(row.last_price)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--orange)' }}>
                      <div style={{ fontWeight: 700 }}>{formatDeltaMoney(row.change_amount)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatPercent(row.change_pct)}</div>
                    </td>
                  </tr>
                ))}
                {!data.top_material_increases.length ? <tr><td style={tdStyle} colSpan={4}>Chưa có vật tư tăng giá đủ dữ liệu trong kỳ.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Vật tư giảm giá mạnh trong kỳ</div>
          <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Vật tư</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Đầu kỳ</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Cuối kỳ</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Biến động</th>
                </tr>
              </thead>
              <tbody>
                {data.top_material_decreases.map((row) => (
                  <tr key={row.material_key}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>{row.material_name || row.material_key}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.material_key} | {row.item_unit || '-'}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{formatMoney(row.first_price)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{formatMoney(row.last_price)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--green)' }}>
                      <div style={{ fontWeight: 700 }}>{formatDeltaMoney(row.change_amount)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatPercent(row.change_pct)}</div>
                    </td>
                  </tr>
                ))}
                {!data.top_material_decreases.length ? <tr><td style={tdStyle} colSpan={4}>Chưa có vật tư giảm giá đủ dữ liệu trong kỳ.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>NCC / vật tư biến động mạnh</div>
          <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>NCC / vật tư</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Đầu kỳ</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Cuối kỳ</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Biến động</th>
                </tr>
              </thead>
              <tbody>
                {data.top_supplier_changes.map((row, idx) => (
                  <tr key={`${row.supplier_id || 'na'}-${row.material_key || 'na'}-${idx}`}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>{row.supplier_name || 'Không gắn NCC'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.material_name || row.material_key} | {row.item_unit || '-'}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{formatMoney(row.first_price)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{formatMoney(row.last_price)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: Number(row.change_amount || 0) >= 0 ? 'var(--orange)' : 'var(--green)' }}>
                      <div style={{ fontWeight: 700 }}>{formatDeltaMoney(row.change_amount)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatPercent(row.change_pct)}</div>
                    </td>
                  </tr>
                ))}
                {!data.top_supplier_changes.length ? <tr><td style={tdStyle} colSpan={4}>Chưa có đủ dữ liệu biến động theo NCC trong kỳ.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>So sánh giá cấu hình và giá thực nhập gần nhất</div>
          <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>NCC / vật tư</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Giá thực tế</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Giá cấu hình</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Lệch</th>
                </tr>
              </thead>
              <tbody>
                {data.actual_vs_config.map((row, idx) => (
                  <tr key={`${row.supplier_id || 'na'}-${row.material_key}-${idx}`}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>{row.supplier_name || 'Không gắn NCC'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.material_name || row.material_key}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ fontWeight: 700 }}>{formatMoney(row.latest_actual_price)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatDateTime(row.latest_actual_at)}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ fontWeight: 700 }}>{row.latest_config_price != null ? formatMoney(row.latest_config_price) : '-'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatDateTime(row.latest_config_at)}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: Number(row.gap_amount || 0) >= 0 ? 'var(--orange)' : 'var(--green)' }}>
                      <div style={{ fontWeight: 700 }}>{formatDeltaMoney(row.gap_amount)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatPercent(row.gap_pct)}</div>
                    </td>
                  </tr>
                ))}
                {!data.actual_vs_config.length ? <tr><td style={tdStyle} colSpan={4}>Chưa có dữ liệu để so sánh giá thực tế và giá cấu hình.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700 }}>Lịch sử giá thực tế</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
              Trang {pagination.page} / {pagination.total_pages} | Tổng dòng: {formatNumber(pagination.total)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" disabled={pagination.page <= 1 || loading} onClick={() => {
              const next = { ...filters, page: Math.max(1, pagination.page - 1) }
              setFilters(next)
              void loadData(next)
            }}>
              Trang trước
            </button>
            <button className="btn" disabled={pagination.page >= pagination.total_pages || loading} onClick={() => {
              const next = { ...filters, page: Math.min(pagination.total_pages, pagination.page + 1) }
              setFilters(next)
              void loadData(next)
            }}>
              Trang sau
            </button>
          </div>
        </div>

        <div style={{ maxHeight: 620, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Thời điểm</th>
                <th style={thStyle}>Vật tư</th>
                <th style={thStyle}>NCC / kho</th>
                <th style={thStyle}>Loại giá</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>SL / tiền</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Đơn giá thực tế</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Giá cấu hình</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Lệch</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 700 }}>{formatDateTime(row.effective_at)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.txn_code || '-'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Vòng giá: {row.cycle_no ?? '-'}</div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 700 }}>{row.material_name || row.material_key}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.material_key} | {row.item_unit || '-'}</div>
                  </td>
                  <td style={tdStyle}>
                    <div>{row.supplier_name || 'Không gắn NCC'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.warehouse_name || '-'}</div>
                  </td>
                  <td style={tdStyle}>
                    <div>{priceKindLabel(row.price_kind)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.source_note || '-'}</div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{formatNumber(row.quantity)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatMoney(row.line_total)}</div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{formatMoney(row.unit_price)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{row.latest_config_price != null ? formatMoney(row.latest_config_price) : '-'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatDateTime(row.latest_config_valid_from)}</div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: Number(row.gap_amount || 0) >= 0 ? 'var(--orange)' : 'var(--green)' }}>
                    <div style={{ fontWeight: 700 }}>{formatDeltaMoney(row.gap_amount)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatPercent(row.gap_pct)}</div>
                  </td>
                </tr>
              ))}
              {!data.logs.length ? <tr><td style={tdStyle} colSpan={8}>Chưa có lịch sử giá trong kỳ đã chọn.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      {loading ? <div style={{ marginTop: 12, color: 'var(--text3)' }}>Đang tải biến động giá vật tư...</div> : null}
      {toast ? (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
