'use client'

import { useEffect, useMemo, useState } from 'react'

type Warehouse = { id: string; warehouse_code: string; warehouse_name: string }
type Supplier = { id: string; supplier_code: string; supplier_name: string }
type CatalogItem = { id: string; item_code: string; item_name: string; item_unit?: string | null }
type SupplierPrice = {
  supplier_id: string
  material_key: string
  price_per_unit: number
  valid_from?: string | null
  valid_to?: string | null
}

type RequestItem = {
  id?: string
  catalog_item_id?: string | null
  material_key: string
  material_name?: string | null
  item_unit?: string | null
  quantity: number
  suggested_unit_price?: number | null
  note?: string | null
}

type PurchaseRequest = {
  id: string
  request_code: string
  warehouse_id: string
  supplier_id?: string | null
  request_date: string
  needed_date?: string | null
  status: string
  note?: string | null
  items: RequestItem[]
}

type OrderItem = {
  id?: string
  request_item_id?: string | null
  catalog_item_id?: string | null
  material_key: string
  material_name?: string | null
  item_unit?: string | null
  ordered_qty: number
  received_qty?: number
  draft_receipt_qty?: number
  remaining_qty?: number
  unit_price?: number | null
  note?: string | null
}

type PurchaseOrder = {
  id: string
  order_code: string
  request_id?: string | null
  warehouse_id: string
  supplier_id: string
  order_date: string
  expected_date?: string | null
  status: string
  note?: string | null
  items: OrderItem[]
}

function emptyRequestItem(): RequestItem {
  return { material_key: '', material_name: '', item_unit: '', quantity: 1, suggested_unit_price: null, note: '' }
}

function emptyOrderItem(): OrderItem {
  return { material_key: '', material_name: '', item_unit: '', ordered_qty: 1, unit_price: null, note: '' }
}

const REQUEST_STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
  ordered: 'Đã lên đơn mua',
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp',
  confirmed: 'Đã xác nhận',
  partial_received: 'Nhận một phần',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
}

export default function InventoryPurchasesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [requestSupplierPrices, setRequestSupplierPrices] = useState<SupplierPrice[]>([])
  const [supplierPrices, setSupplierPrices] = useState<SupplierPrice[]>([])

  const [requestRows, setRequestRows] = useState<PurchaseRequest[]>([])
  const [orderRows, setOrderRows] = useState<PurchaseOrder[]>([])
  const [selectedRequestId, setSelectedRequestId] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [toast, setToast] = useState('')
  const [savingRequest, setSavingRequest] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [creatingReceipt, setCreatingReceipt] = useState(false)

  const [requestFilter, setRequestFilter] = useState({
    q: '',
    warehouse_id: '',
    supplier_id: '',
    status: '',
  })
  const [orderFilter, setOrderFilter] = useState({
    q: '',
    warehouse_id: '',
    supplier_id: '',
    status: '',
  })

  const [requestForm, setRequestForm] = useState({
    request_code: '',
    warehouse_id: '',
    supplier_id: '',
    request_date: '',
    needed_date: '',
    note: '',
  })
  const [requestItems, setRequestItems] = useState<RequestItem[]>([emptyRequestItem()])

  const [orderForm, setOrderForm] = useState({
    order_code: '',
    request_id: '',
    warehouse_id: '',
    supplier_id: '',
    order_date: '',
    expected_date: '',
    note: '',
  })
  const [orderItems, setOrderItems] = useState<OrderItem[]>([emptyOrderItem()])
  const [receiptDraftMap, setReceiptDraftMap] = useState<Record<string, number>>({})

  const selectedRequest = useMemo(() => requestRows.find((x) => x.id === selectedRequestId) || null, [requestRows, selectedRequestId])
  const selectedOrder = useMemo(() => orderRows.find((x) => x.id === selectedOrderId) || null, [orderRows, selectedOrderId])
  const requestReadonly = !!selectedRequestId && selectedRequest?.status !== 'draft'
  const orderReadonly = !!selectedOrderId && selectedOrder?.status !== 'draft'
  const sourceRequests = useMemo(
    () => requestRows.filter((x) => ['approved', 'ordered'].includes(String(x.status || ''))),
    [requestRows],
  )

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2500)
  }

  async function loadMasters() {
    const [wRes, sRes, cRes] = await Promise.all([
      fetch('/api/settings/warehouses?active_only=true', { cache: 'no-store' }),
      fetch('/api/settings/suppliers?active_only=true', { cache: 'no-store' }),
      fetch('/api/settings/estimate/catalog-items?active_only=true', { cache: 'no-store' }),
    ])
    const [wJson, sJson, cJson] = await Promise.all([
      wRes.json().catch(() => ({})),
      sRes.json().catch(() => ({})),
      cRes.json().catch(() => ({})),
    ])
    const warehouseRows = Array.isArray(wJson?.data) ? wJson.data : []
    setWarehouses(warehouseRows)
    setSuppliers(Array.isArray(sJson?.data) ? sJson.data : [])
    setCatalog(Array.isArray(cJson?.data) ? cJson.data : [])
    setRequestForm((prev) => ({ ...prev, warehouse_id: prev.warehouse_id || warehouseRows[0]?.id || '' }))
    setOrderForm((prev) => ({ ...prev, warehouse_id: prev.warehouse_id || warehouseRows[0]?.id || '' }))
  }

  async function loadRequests() {
    const sp = new URLSearchParams()
    if (requestFilter.q.trim()) sp.set('q', requestFilter.q.trim())
    if (requestFilter.warehouse_id) sp.set('warehouse_id', requestFilter.warehouse_id)
    if (requestFilter.supplier_id) sp.set('supplier_id', requestFilter.supplier_id)
    if (requestFilter.status) sp.set('status', requestFilter.status)
    const res = await fetch(`/api/inventory/purchase-requests?${sp.toString()}`, { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    setRequestRows(Array.isArray(json?.data) ? json.data : [])
  }

  async function loadOrders() {
    const sp = new URLSearchParams()
    if (orderFilter.q.trim()) sp.set('q', orderFilter.q.trim())
    if (orderFilter.warehouse_id) sp.set('warehouse_id', orderFilter.warehouse_id)
    if (orderFilter.supplier_id) sp.set('supplier_id', orderFilter.supplier_id)
    if (orderFilter.status) sp.set('status', orderFilter.status)
    const res = await fetch(`/api/inventory/purchase-orders?${sp.toString()}`, { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    setOrderRows(Array.isArray(json?.data) ? json.data : [])
  }

  useEffect(() => {
    loadMasters()
    loadRequests()
    loadOrders()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const supplierId = String(requestForm.supplier_id || '').trim()
    if (!supplierId) {
      setRequestSupplierPrices([])
      return
    }
    ;(async () => {
      const res = await fetch(`/api/settings/supplier-prices?active_only=true&supplier_id=${encodeURIComponent(supplierId)}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      setRequestSupplierPrices(Array.isArray(json?.data) ? json.data : [])
    })()
  }, [requestForm.supplier_id])

  useEffect(() => {
    const supplierId = String(orderForm.supplier_id || '').trim()
    if (!supplierId) {
      setSupplierPrices([])
      return
    }
    ;(async () => {
      const res = await fetch(`/api/settings/supplier-prices?active_only=true&supplier_id=${encodeURIComponent(supplierId)}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      setSupplierPrices(Array.isArray(json?.data) ? json.data : [])
    })()
  }, [orderForm.supplier_id])

  function findRequestSuggestedPrice(materialKey: string) {
    const key = String(materialKey || '').trim()
    if (!key) return null
    const now = Date.now()
    const matched = requestSupplierPrices
      .filter((x) => String(x.material_key || '').trim() === key)
      .filter((x) => {
        const fromOk = !x.valid_from || new Date(String(x.valid_from)).getTime() <= now
        const toOk = !x.valid_to || new Date(String(x.valid_to)).getTime() >= now
        return fromOk && toOk
      })
      .sort((a, b) => new Date(String(b.valid_from || 0)).getTime() - new Date(String(a.valid_from || 0)).getTime())
    if (!matched.length) return null
    const price = Number(matched[0].price_per_unit || 0)
    return Number.isFinite(price) && price > 0 ? price : null
  }

  useEffect(() => {
    if (!requestSupplierPrices.length) return
    setRequestItems((prev) => prev.map((item) => {
      if (item.suggested_unit_price != null && Number(item.suggested_unit_price) > 0) return item
      const nextPrice = findRequestSuggestedPrice(item.material_key)
      if (nextPrice == null) return item
      return { ...item, suggested_unit_price: nextPrice }
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestSupplierPrices])

  useEffect(() => {
    if (!supplierPrices.length) return
    setOrderItems((prev) => prev.map((item) => {
      if (item.unit_price != null && Number(item.unit_price) > 0) return item
      const nextPrice = findSuggestedPrice(item.material_key)
      if (nextPrice == null) return item
      return { ...item, unit_price: nextPrice }
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierPrices])

  useEffect(() => {
    if (!selectedOrder) {
      setReceiptDraftMap({})
      return
    }
    const nextMap: Record<string, number> = {}
    for (const item of selectedOrder.items || []) {
      nextMap[item.material_key] = Number(item.remaining_qty || 0)
    }
    setReceiptDraftMap(nextMap)
  }, [selectedOrder])

  function resetRequestEditor() {
    setSelectedRequestId('')
    setRequestForm({
      request_code: '',
      warehouse_id: warehouses[0]?.id || '',
      supplier_id: '',
      request_date: '',
      needed_date: '',
      note: '',
    })
    setRequestItems([emptyRequestItem()])
  }

  function resetOrderEditor() {
    setSelectedOrderId('')
    setOrderForm({
      order_code: '',
      request_id: '',
      warehouse_id: warehouses[0]?.id || '',
      supplier_id: '',
      order_date: '',
      expected_date: '',
      note: '',
    })
    setOrderItems([emptyOrderItem()])
  }

  function pickCatalogForRequest(index: number, itemId: string) {
    const item = catalog.find((x) => x.id === itemId)
    if (!item) return
    const suggestedPrice = findRequestSuggestedPrice(item.item_code)
    setRequestItems((prev) => prev.map((row, idx) => idx === index ? ({
      ...row,
      catalog_item_id: item.id,
      material_key: item.item_code,
      material_name: item.item_name,
      item_unit: item.item_unit || '',
      suggested_unit_price: suggestedPrice != null ? suggestedPrice : row.suggested_unit_price,
    }) : row))
  }

  function findSuggestedPrice(materialKey: string) {
    const key = String(materialKey || '').trim()
    if (!key) return null
    const now = Date.now()
    const matched = supplierPrices
      .filter((x) => String(x.material_key || '').trim() === key)
      .filter((x) => {
        const fromOk = !x.valid_from || new Date(String(x.valid_from)).getTime() <= now
        const toOk = !x.valid_to || new Date(String(x.valid_to)).getTime() >= now
        return fromOk && toOk
      })
      .sort((a, b) => new Date(String(b.valid_from || 0)).getTime() - new Date(String(a.valid_from || 0)).getTime())
    if (!matched.length) return null
    const price = Number(matched[0].price_per_unit || 0)
    return Number.isFinite(price) && price > 0 ? price : null
  }

  function pickCatalogForOrder(index: number, itemId: string) {
    const item = catalog.find((x) => x.id === itemId)
    if (!item) return
    const suggested = findSuggestedPrice(item.item_code)
    setOrderItems((prev) => prev.map((row, idx) => idx === index ? ({
      ...row,
      catalog_item_id: item.id,
      material_key: item.item_code,
      material_name: item.item_name,
      item_unit: item.item_unit || '',
      unit_price: suggested != null ? suggested : row.unit_price,
    }) : row))
  }

  function beginEditRequest(row: PurchaseRequest) {
    setSelectedRequestId(row.id)
    setRequestForm({
      request_code: row.request_code || '',
      warehouse_id: row.warehouse_id || '',
      supplier_id: row.supplier_id || '',
      request_date: row.request_date ? new Date(row.request_date).toISOString().slice(0, 10) : '',
      needed_date: row.needed_date ? new Date(row.needed_date).toISOString().slice(0, 10) : '',
      note: row.note || '',
    })
    setRequestItems((row.items || []).map((item) => ({
      id: item.id,
      catalog_item_id: item.catalog_item_id || null,
      material_key: item.material_key || '',
      material_name: item.material_name || '',
      item_unit: item.item_unit || '',
      quantity: Number(item.quantity || 0),
      suggested_unit_price: item.suggested_unit_price != null ? Number(item.suggested_unit_price) : null,
      note: item.note || '',
    })))
  }

  function fillOrderFromRequest(requestId: string) {
    if (!requestId) {
      setOrderForm((prev) => ({ ...prev, request_id: '' }))
      return
    }
    const source = requestRows.find((x) => x.id === requestId)
    if (!source) return
    setOrderForm((prev) => ({
      ...prev,
      request_id: source.id,
      warehouse_id: source.warehouse_id || prev.warehouse_id,
      supplier_id: source.supplier_id || prev.supplier_id,
    }))
    setOrderItems((source.items || []).map((item) => ({
      request_item_id: item.id || null,
      catalog_item_id: item.catalog_item_id || null,
      material_key: item.material_key || '',
      material_name: item.material_name || '',
      item_unit: item.item_unit || '',
      ordered_qty: Number(item.quantity || 0),
      unit_price: item.suggested_unit_price != null ? Number(item.suggested_unit_price) : null,
      note: item.note || '',
    })))
  }

  function beginEditOrder(row: PurchaseOrder) {
    setSelectedOrderId(row.id)
    setOrderForm({
      order_code: row.order_code || '',
      request_id: row.request_id || '',
      warehouse_id: row.warehouse_id || '',
      supplier_id: row.supplier_id || '',
      order_date: row.order_date ? new Date(row.order_date).toISOString().slice(0, 10) : '',
      expected_date: row.expected_date ? new Date(row.expected_date).toISOString().slice(0, 10) : '',
      note: row.note || '',
    })
    setOrderItems((row.items || []).map((item) => ({
      id: item.id,
      request_item_id: item.request_item_id || null,
      catalog_item_id: item.catalog_item_id || null,
      material_key: item.material_key || '',
      material_name: item.material_name || '',
      item_unit: item.item_unit || '',
      ordered_qty: Number(item.ordered_qty || 0),
      received_qty: Number(item.received_qty || 0),
      draft_receipt_qty: Number(item.draft_receipt_qty || 0),
      remaining_qty: Number(item.remaining_qty || 0),
      unit_price: item.unit_price != null ? Number(item.unit_price) : null,
      note: item.note || '',
    })))
  }

  async function saveRequest() {
    if (!requestForm.warehouse_id) return showToast('Chưa chọn kho')
    const lines = requestItems
      .map((item) => ({
        catalog_item_id: item.catalog_item_id || null,
        material_key: String(item.material_key || '').trim(),
        material_name: String(item.material_name || '').trim() || null,
        item_unit: String(item.item_unit || '').trim() || null,
        quantity: Number(item.quantity || 0),
        suggested_unit_price: item.suggested_unit_price != null ? Number(item.suggested_unit_price) : null,
        note: String(item.note || '').trim() || null,
      }))
      .filter((item) => item.material_key && item.quantity > 0)
    if (!lines.length) return showToast('Cần ít nhất 1 vật tư hợp lệ')

    setSavingRequest(true)
    const url = selectedRequestId ? `/api/inventory/purchase-requests/${selectedRequestId}` : '/api/inventory/purchase-requests'
    const method = selectedRequestId ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_code: requestForm.request_code || null,
        warehouse_id: requestForm.warehouse_id,
        supplier_id: requestForm.supplier_id || null,
        request_date: requestForm.request_date || null,
        needed_date: requestForm.needed_date || null,
        note: requestForm.note || null,
        items: lines,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setSavingRequest(false)
    if (!res.ok) return showToast(json?.error || 'Không lưu được đề nghị mua')
    await loadRequests()
    showToast(selectedRequestId ? 'Đã cập nhật đề nghị mua' : 'Đã tạo đề nghị mua')
    if (selectedRequestId) beginEditRequest(json.data)
    else resetRequestEditor()
  }

  async function saveOrder() {
    if (!orderForm.warehouse_id || !orderForm.supplier_id) return showToast('Đơn mua cần kho và nhà cung cấp')
    const lines = orderItems
      .map((item) => ({
        request_item_id: item.request_item_id || null,
        catalog_item_id: item.catalog_item_id || null,
        material_key: String(item.material_key || '').trim(),
        material_name: String(item.material_name || '').trim() || null,
        item_unit: String(item.item_unit || '').trim() || null,
        ordered_qty: Number(item.ordered_qty || 0),
        unit_price: item.unit_price != null ? Number(item.unit_price) : null,
        note: String(item.note || '').trim() || null,
      }))
      .filter((item) => item.material_key && item.ordered_qty > 0)
    if (!lines.length) return showToast('Cần ít nhất 1 dòng vật tư đặt mua')

    setSavingOrder(true)
    const url = selectedOrderId ? `/api/inventory/purchase-orders/${selectedOrderId}` : '/api/inventory/purchase-orders'
    const method = selectedOrderId ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_code: orderForm.order_code || null,
        request_id: orderForm.request_id || null,
        warehouse_id: orderForm.warehouse_id,
        supplier_id: orderForm.supplier_id,
        order_date: orderForm.order_date || null,
        expected_date: orderForm.expected_date || null,
        note: orderForm.note || null,
        items: lines,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setSavingOrder(false)
    if (!res.ok) return showToast(json?.error || 'Không lưu được đơn mua')
    await Promise.all([loadOrders(), loadRequests()])
    showToast(selectedOrderId ? 'Đã cập nhật đơn mua' : 'Đã tạo đơn mua')
    if (selectedOrderId) beginEditOrder(json.data)
    else resetOrderEditor()
  }

  async function requestAction(action: 'submit' | 'approve' | 'reject' | 'cancel') {
    if (!selectedRequestId) return
    const res = await fetch(`/api/inventory/purchase-requests/${selectedRequestId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(json?.error || 'Không xử lý được đề nghị mua')
    await loadRequests()
    showToast('Đã cập nhật trạng thái đề nghị mua')
    beginEditRequest(json.data)
  }

  async function orderAction(action: 'confirm' | 'cancel' | 'sync_receipts') {
    if (!selectedOrderId) return
    const res = await fetch(`/api/inventory/purchase-orders/${selectedOrderId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return showToast(json?.error || 'Không xử lý được đơn mua')
    await loadOrders()
    showToast(action === 'sync_receipts' ? 'Đã đồng bộ số nhận hàng' : 'Đã cập nhật trạng thái đơn mua')
    beginEditOrder(json.data)
  }

  async function createReceiptDraft() {
    if (!selectedOrderId || !selectedOrder) return
    setCreatingReceipt(true)
    const items = (selectedOrder.items || [])
      .map((item) => ({
        material_key: item.material_key,
        quantity: Number(receiptDraftMap[item.material_key] || 0),
      }))
      .filter((item) => item.quantity > 0)
    const res = await fetch(`/api/inventory/purchase-orders/${selectedOrderId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_receipt_draft', items }),
    })
    const json = await res.json().catch(() => ({}))
    setCreatingReceipt(false)
    if (!res.ok) return showToast(json?.error || 'Không tạo được phiếu nhận hàng nháp')
    await loadOrders()
    beginEditOrder(json.data)
    showToast(`Đã tạo phiếu nhận hàng nháp ${json?.receipt_draft?.txn_code || ''}`.trim())
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>INVENTORY PROCUREMENT</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Đề nghị mua - Đơn mua - Nhận hàng</h1>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Luồng vận hành</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
          1. Tạo đề nghị mua để chốt nhu cầu vật tư.
          <br />
          2. Duyệt đề nghị rồi mới tạo đơn mua.
          <br />
          3. Khi hàng về, tạo phiếu nhận hàng nháp từ đơn mua. Chỉ khi ghi sổ phiếu kho thì mới tăng tồn kho thật.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text4)', letterSpacing: 1.2 }}>
                {selectedRequestId ? 'SỬA / XEM ĐỀ NGHỊ MUA' : 'TẠO ĐỀ NGHỊ MUA'}
              </div>
              {selectedRequestId ? <button className="btn-ghost" onClick={resetRequestEditor}>Tạo mới</button> : null}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Mã đề nghị</div>
                <input disabled={requestReadonly} className="input" placeholder="Tự sinh nếu để trống" value={requestForm.request_code} onChange={(e) => setRequestForm((p) => ({ ...p, request_code: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Kho nhận</div>
                <select disabled={requestReadonly} className="select" value={requestForm.warehouse_id} onChange={(e) => setRequestForm((p) => ({ ...p, warehouse_id: e.target.value }))}>
                  <option value="">Chọn kho</option>
                  {warehouses.map((row) => <option key={row.id} value={row.id}>{row.warehouse_name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Nhà cung cấp dự kiến</div>
                <select disabled={requestReadonly} className="select" value={requestForm.supplier_id} onChange={(e) => setRequestForm((p) => ({ ...p, supplier_id: e.target.value }))}>
                  <option value="">Chưa chốt</option>
                  {suppliers.map((row) => <option key={row.id} value={row.id}>{row.supplier_name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Ngày đề nghị</div>
                <input disabled={requestReadonly} className="input" type="date" value={requestForm.request_date} onChange={(e) => setRequestForm((p) => ({ ...p, request_date: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Ngày cần hàng</div>
                <input disabled={requestReadonly} className="input" type="date" value={requestForm.needed_date} onChange={(e) => setRequestForm((p) => ({ ...p, needed_date: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Ghi chú đề nghị</div>
                <input disabled={requestReadonly} className="input" value={requestForm.note} onChange={(e) => setRequestForm((p) => ({ ...p, note: e.target.value }))} />
              </div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr .8fr .7fr .9fr auto', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
                <div>Vật tư</div>
                <div>Tên hiển thị</div>
                <div>Số lượng</div>
                <div>Đơn vị</div>
                <div>Giá dự kiến</div>
                <div />
              </div>
              {requestItems.map((item, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr .8fr .7fr .9fr auto', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                  <select disabled={requestReadonly} className="select" value={item.catalog_item_id || ''} onChange={(e) => pickCatalogForRequest(index, e.target.value)}>
                    <option value="">Chọn vật tư...</option>
                    {catalog.map((row) => <option key={row.id} value={row.id}>{row.item_name} ({row.item_code})</option>)}
                  </select>
                  <input disabled={requestReadonly} className="input" value={item.material_name || ''} onChange={(e) => setRequestItems((prev) => prev.map((row, idx) => idx === index ? { ...row, material_name: e.target.value } : row))} />
                  <input disabled={requestReadonly} className="input" type="number" min="0" step="0.01" value={String(item.quantity ?? '')} onChange={(e) => setRequestItems((prev) => prev.map((row, idx) => idx === index ? { ...row, quantity: Number(e.target.value || 0) } : row))} />
                  <input disabled={requestReadonly} className="input" value={item.item_unit || ''} onChange={(e) => setRequestItems((prev) => prev.map((row, idx) => idx === index ? { ...row, item_unit: e.target.value } : row))} />
                  <input disabled={requestReadonly} className="input" type="number" min="0" step="1" value={item.suggested_unit_price ?? ''} onChange={(e) => setRequestItems((prev) => prev.map((row, idx) => idx === index ? { ...row, suggested_unit_price: e.target.value ? Number(e.target.value) : null } : row))} />
                  <button disabled={requestReadonly} className="btn-ghost" onClick={() => setRequestItems((prev) => prev.filter((_, idx) => idx !== index))}>X</button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button disabled={requestReadonly} className="btn-ghost" onClick={() => setRequestItems((prev) => [...prev, emptyRequestItem()])}>+ Thêm dòng</button>
              {!requestReadonly ? <button className="btn-primary" disabled={savingRequest} onClick={saveRequest}>{selectedRequestId ? 'Lưu đề nghị' : 'Tạo đề nghị'}</button> : null}
              {selectedRequest?.status === 'draft' ? <button className="btn-ghost" onClick={() => requestAction('submit')}>Gửi duyệt</button> : null}
              {selectedRequest && ['draft', 'submitted'].includes(selectedRequest.status) ? <button className="btn-ghost" onClick={() => requestAction('approve')}>Duyệt</button> : null}
              {selectedRequest && ['submitted', 'approved'].includes(selectedRequest.status) ? <button className="btn-ghost" onClick={() => requestAction('reject')}>Từ chối</button> : null}
              {selectedRequest && !['cancelled', 'ordered'].includes(selectedRequest.status) ? <button className="btn-ghost" onClick={() => requestAction('cancel')}>Hủy đề nghị</button> : null}
            </div>
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)', letterSpacing: 1.2, marginBottom: 8 }}>DANH SÁCH ĐỀ NGHỊ MUA</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
              <input className="input" placeholder="Tìm mã đề nghị / vật tư..." value={requestFilter.q} onChange={(e) => setRequestFilter((p) => ({ ...p, q: e.target.value }))} />
              <select className="select" value={requestFilter.warehouse_id} onChange={(e) => setRequestFilter((p) => ({ ...p, warehouse_id: e.target.value }))}>
                <option value="">Tất cả kho</option>
                {warehouses.map((row) => <option key={row.id} value={row.id}>{row.warehouse_name}</option>)}
              </select>
              <select className="select" value={requestFilter.supplier_id} onChange={(e) => setRequestFilter((p) => ({ ...p, supplier_id: e.target.value }))}>
                <option value="">Tất cả nhà cung cấp</option>
                {suppliers.map((row) => <option key={row.id} value={row.id}>{row.supplier_name}</option>)}
              </select>
              <select className="select" value={requestFilter.status} onChange={(e) => setRequestFilter((p) => ({ ...p, status: e.target.value }))}>
                <option value="">Tất cả trạng thái</option>
                {Object.entries(REQUEST_STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <button className="btn-primary" onClick={loadRequests}>Lọc</button>
            </div>

            <div style={{ maxHeight: 480, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {requestRows.map((row) => (
                <div key={row.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: selectedRequestId === row.id ? 'rgba(59,130,246,.08)' : 'transparent', cursor: 'pointer' }} onClick={() => beginEditRequest(row)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{row.request_code}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{REQUEST_STATUS_LABEL[row.status] || row.status} | {row.items?.length || 0} dòng</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'right' }}>
                      {row.request_date ? new Date(row.request_date).toLocaleDateString('vi-VN') : '-'}
                    </div>
                  </div>
                </div>
              ))}
              {!requestRows.length ? <div style={{ padding: 12, color: 'var(--text3)' }}>Chưa có đề nghị mua.</div> : null}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text4)', letterSpacing: 1.2 }}>
                {selectedOrderId ? 'SỬA / XEM ĐƠN MUA' : 'TẠO ĐƠN MUA'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {selectedOrderId ? <button className="btn-ghost" onClick={resetOrderEditor}>Tạo mới</button> : null}
                {selectedRequest && ['approved', 'ordered'].includes(selectedRequest.status) ? <button className="btn-ghost" onClick={() => fillOrderFromRequest(selectedRequest.id)}>Nạp từ đề nghị đang chọn</button> : null}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Mã đơn mua</div>
                <input disabled={orderReadonly} className="input" placeholder="Tự sinh nếu để trống" value={orderForm.order_code} onChange={(e) => setOrderForm((p) => ({ ...p, order_code: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Đề nghị nguồn</div>
                <select disabled={orderReadonly} className="select" value={orderForm.request_id} onChange={(e) => fillOrderFromRequest(e.target.value)}>
                  <option value="">Không lấy từ đề nghị nào</option>
                  {sourceRequests.map((row) => <option key={row.id} value={row.id}>{row.request_code}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Kho nhận</div>
                <select disabled={orderReadonly} className="select" value={orderForm.warehouse_id} onChange={(e) => setOrderForm((p) => ({ ...p, warehouse_id: e.target.value }))}>
                  <option value="">Chọn kho</option>
                  {warehouses.map((row) => <option key={row.id} value={row.id}>{row.warehouse_name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Nhà cung cấp</div>
                <select disabled={orderReadonly} className="select" value={orderForm.supplier_id} onChange={(e) => setOrderForm((p) => ({ ...p, supplier_id: e.target.value }))}>
                  <option value="">Chọn nhà cung cấp</option>
                  {suppliers.map((row) => <option key={row.id} value={row.id}>{row.supplier_name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Ngày đặt mua</div>
                <input disabled={orderReadonly} className="input" type="date" value={orderForm.order_date} onChange={(e) => setOrderForm((p) => ({ ...p, order_date: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Ngày dự kiến nhận</div>
                <input disabled={orderReadonly} className="input" type="date" value={orderForm.expected_date} onChange={(e) => setOrderForm((p) => ({ ...p, expected_date: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Ghi chú đơn mua</div>
                <input disabled={orderReadonly} className="input" value={orderForm.note} onChange={(e) => setOrderForm((p) => ({ ...p, note: e.target.value }))} />
              </div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr .8fr .7fr .9fr auto', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
                <div>Vật tư</div>
                <div>Tên hiển thị</div>
                <div>Số lượng đặt</div>
                <div>Đơn vị</div>
                <div>Đơn giá</div>
                <div />
              </div>
              {orderItems.map((item, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr .8fr .7fr .9fr auto', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                  <select disabled={orderReadonly} className="select" value={item.catalog_item_id || ''} onChange={(e) => pickCatalogForOrder(index, e.target.value)}>
                    <option value="">Chọn vật tư...</option>
                    {catalog.map((row) => <option key={row.id} value={row.id}>{row.item_name} ({row.item_code})</option>)}
                  </select>
                  <input disabled={orderReadonly} className="input" value={item.material_name || ''} onChange={(e) => setOrderItems((prev) => prev.map((row, idx) => idx === index ? { ...row, material_name: e.target.value } : row))} />
                  <input disabled={orderReadonly} className="input" type="number" min="0" step="0.01" value={String(item.ordered_qty ?? '')} onChange={(e) => setOrderItems((prev) => prev.map((row, idx) => idx === index ? { ...row, ordered_qty: Number(e.target.value || 0) } : row))} />
                  <input disabled={orderReadonly} className="input" value={item.item_unit || ''} onChange={(e) => setOrderItems((prev) => prev.map((row, idx) => idx === index ? { ...row, item_unit: e.target.value } : row))} />
                  <input disabled={orderReadonly} className="input" type="number" min="0" step="1" value={item.unit_price ?? ''} onChange={(e) => setOrderItems((prev) => prev.map((row, idx) => idx === index ? { ...row, unit_price: e.target.value ? Number(e.target.value) : null } : row))} />
                  <button disabled={orderReadonly} className="btn-ghost" onClick={() => setOrderItems((prev) => prev.filter((_, idx) => idx !== index))}>X</button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: selectedOrder ? 10 : 0 }}>
              <button disabled={orderReadonly} className="btn-ghost" onClick={() => setOrderItems((prev) => [...prev, emptyOrderItem()])}>+ Thêm dòng</button>
              {!orderReadonly ? <button className="btn-primary" disabled={savingOrder} onClick={saveOrder}>{selectedOrderId ? 'Lưu đơn mua' : 'Tạo đơn mua'}</button> : null}
              {selectedOrder?.status === 'draft' ? <button className="btn-ghost" onClick={() => orderAction('confirm')}>Xác nhận đơn mua</button> : null}
              {selectedOrder && selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'completed' ? <button className="btn-ghost" onClick={() => orderAction('cancel')}>Hủy đơn mua</button> : null}
              {selectedOrder ? <button className="btn-ghost" onClick={() => orderAction('sync_receipts')}>Đồng bộ nhận hàng</button> : null}
            </div>

            {selectedOrder && ['confirmed', 'partial_received'].includes(selectedOrder.status) ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Tạo phiếu nhận hàng nháp</div>
                <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
                  {(selectedOrder.items || []).map((item) => (
                    <div key={item.material_key} style={{ display: 'grid', gridTemplateColumns: '1.2fr .7fr .7fr .7fr .8fr', gap: 8, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{item.material_name || item.material_key}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{item.material_key}</div>
                      </div>
                      <div style={{ fontSize: 12 }}>Đặt: {Number(item.ordered_qty || 0)}</div>
                      <div style={{ fontSize: 12 }}>Đã nhận: {Number(item.received_qty || 0)}</div>
                      <div style={{ fontSize: 12 }}>Nháp: {Number(item.draft_receipt_qty || 0)}</div>
                      <input className="input" type="number" min="0" step="0.01" value={String(receiptDraftMap[item.material_key] ?? item.remaining_qty ?? 0)} onChange={(e) => setReceiptDraftMap((prev) => ({ ...prev, [item.material_key]: Number(e.target.value || 0) }))} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" disabled={creatingReceipt} onClick={createReceiptDraft}>Tạo phiếu nhận hàng nháp</button>
                  <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>
                    Hàng chưa về hết có thể tạo nhiều phiếu nháp theo từng đợt nhận.
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text4)', letterSpacing: 1.2, marginBottom: 8 }}>DANH SÁCH ĐƠN MUA</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
              <input className="input" placeholder="Tìm mã đơn / vật tư..." value={orderFilter.q} onChange={(e) => setOrderFilter((p) => ({ ...p, q: e.target.value }))} />
              <select className="select" value={orderFilter.warehouse_id} onChange={(e) => setOrderFilter((p) => ({ ...p, warehouse_id: e.target.value }))}>
                <option value="">Tất cả kho</option>
                {warehouses.map((row) => <option key={row.id} value={row.id}>{row.warehouse_name}</option>)}
              </select>
              <select className="select" value={orderFilter.supplier_id} onChange={(e) => setOrderFilter((p) => ({ ...p, supplier_id: e.target.value }))}>
                <option value="">Tất cả nhà cung cấp</option>
                {suppliers.map((row) => <option key={row.id} value={row.id}>{row.supplier_name}</option>)}
              </select>
              <select className="select" value={orderFilter.status} onChange={(e) => setOrderFilter((p) => ({ ...p, status: e.target.value }))}>
                <option value="">Tất cả trạng thái</option>
                {Object.entries(ORDER_STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <button className="btn-primary" onClick={loadOrders}>Lọc</button>
            </div>

            <div style={{ maxHeight: 480, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {orderRows.map((row) => (
                <div key={row.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: selectedOrderId === row.id ? 'rgba(59,130,246,.08)' : 'transparent', cursor: 'pointer' }} onClick={() => beginEditOrder(row)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{row.order_code}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{ORDER_STATUS_LABEL[row.status] || row.status} | {row.items?.length || 0} dòng</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'right' }}>
                      {row.order_date ? new Date(row.order_date).toLocaleDateString('vi-VN') : '-'}
                    </div>
                  </div>
                </div>
              ))}
              {!orderRows.length ? <div style={{ padding: 12, color: 'var(--text3)' }}>Chưa có đơn mua.</div> : null}
            </div>
          </div>
        </div>
      </div>

      {toast ? (
        <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 9999, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px' }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
