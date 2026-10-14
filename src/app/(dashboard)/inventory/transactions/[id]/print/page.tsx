'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { buildPrintBaseStyles } from '@/lib/print/layout'
import { PRINT_BRAND_DEFAULT, mergePrintBrandSettings, type PrintBrandSettings } from '@/lib/print/brand'

type TxnItem = {
  material_key: string
  material_name?: string | null
  item_unit?: string | null
  quantity: number
  unit_price?: number | null
  line_total?: number | null
  note?: string | null
}

type Txn = {
  id: string
  txn_code: string
  txn_type: string
  txn_date: string
  status: string
  note?: string | null
  warehouse?: { warehouse_name?: string | null; warehouse_code?: string | null } | null
  supplier?: { supplier_name?: string | null; supplier_code?: string | null } | null
  items: TxnItem[]
}

function labelTxnType(v: string) {
  const x = String(v || '')
  if (x === 'in') return 'Nhap kho'
  if (x === 'out') return 'Xuat kho'
  if (x === 'adjust') return 'Dieu chinh'
  if (x === 'transfer_in') return 'Nhap chuyen kho'
  if (x === 'transfer_out') return 'Xuat chuyen kho'
  return x || '-'
}

export default function InventoryTransactionPrintPage() {
  const params = useParams<{ id: string }>()
  const id = String(params?.id || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [txn, setTxn] = useState<Txn | null>(null)
  const [brand, setBrand] = useState<PrintBrandSettings>(PRINT_BRAND_DEFAULT)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      setLoading(true)
      setError('')
      const res = await fetch(`/api/inventory/transactions/${id}`, { cache: 'no-store' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(String(j?.error || 'Khong tai duoc phieu kho'))
        setLoading(false)
        return
      }
      setTxn(j?.data || null)
      setLoading(false)
    })()
  }, [id])

  useEffect(() => {
    ;(async () => {
      const res = await fetch('/api/settings/print-brand', { cache: 'no-store' })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j?.data) {
        setBrand(mergePrintBrandSettings(j.data))
      }
    })()
  }, [])

  const totalQty = useMemo(() => {
    if (!txn?.items?.length) return 0
    return txn.items.reduce((acc, it) => acc + Number(it.quantity || 0), 0)
  }, [txn])

  const totalMoney = useMemo(() => {
    if (!txn?.items?.length) return 0
    return txn.items.reduce((acc, it) => {
      const line = it.line_total != null ? Number(it.line_total || 0) : Number(it.quantity || 0) * Number(it.unit_price || 0)
      return acc + (Number.isFinite(line) ? line : 0)
    }, 0)
  }, [txn])

  if (loading) return <div style={{ padding: 16 }}>Dang tai phieu...</div>
  if (error || !txn) return <div style={{ padding: 16, color: 'var(--red)' }}>{error || 'Khong tim thay phieu kho'}</div>

  return (
    <div className="print-page">
      <style>{`
        ${buildPrintBaseStyles(brand)}
        .meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 20px;
          font-size: 13px;
          margin-top: 10px;
        }
        .right { text-align: right; }
      `}</style>

      <div className="print-toolbar no-print">
        <button className="print-btn" onClick={() => window.print()}>In / Luu PDF</button>
        <Link className="btn-ghost" href="/inventory/transactions">Quay lai</Link>
      </div>

      <div className="print-sheet">
        <div className="print-header">
          <div className="print-header-row">
            <div>
              <div className="print-brand-wrap">
                <div className="print-brand-badge">
                  {brand.logoUrl ? <img src={brand.logoUrl} alt={brand.brandName} className="print-brand-logo" /> : String(brand.brandName || 'TI').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="print-brand-name">{brand.brandName}</div>
                  <div className="print-brand-legal">{brand.legalName}</div>
                  <div className="print-brand-tagline">{brand.tagline}</div>
                </div>
              </div>
              <div className="print-doc-title">Phieu kho</div>
              <div className="print-doc-subtitle">Mau in dung chung cho phieu nhap, xuat, dieu chinh va chuyen kho.</div>
            </div>
            <div className="print-meta">
              <strong>{txn.txn_code || '-'}</strong>
              <div>Loai phieu: <b>{labelTxnType(txn.txn_type)}</b></div>
              <div>Ngay phieu: {new Date(txn.txn_date).toLocaleString('vi-VN')}</div>
            </div>
          </div>
          <div className="print-scope">
            Kho: <b>{txn.warehouse?.warehouse_name || '-'}</b> |
            NCC: <b>{txn.supplier?.supplier_name || '-'}</b> |
            Trang thai: <b>{txn.status || '-'}</b>
          </div>
        </div>

        <div className="print-body">
          <div className="print-summary-grid">
            <div className="print-summary-card"><div className="print-summary-key">So dong vat tu</div><div className="print-summary-value">{txn.items.length}</div></div>
            <div className="print-summary-card"><div className="print-summary-key">Tong so luong</div><div className="print-summary-value">{Number(totalQty || 0).toLocaleString('vi-VN')}</div></div>
            <div className="print-summary-card"><div className="print-summary-key">Tong thanh tien</div><div className="print-summary-value">{Number(totalMoney || 0).toLocaleString('vi-VN')}</div></div>
            <div className="print-summary-card"><div className="print-summary-key">Kho</div><div className="print-summary-value" style={{ fontSize: 18 }}>{txn.warehouse?.warehouse_code || '-'}</div></div>
          </div>

          <div className="print-section">
            <div className="print-section-title">Thong tin phieu</div>
            <div className="meta-grid">
              <div>Loai phieu: <b>{labelTxnType(txn.txn_type)}</b></div>
              <div>Trang thai: <b>{txn.status || '-'}</b></div>
              <div>Ngay phieu: <b>{new Date(txn.txn_date).toLocaleString('vi-VN')}</b></div>
              <div>Kho: <b>{txn.warehouse?.warehouse_name || '-'}</b></div>
              <div>Nha cung cap: <b>{txn.supplier?.supplier_name || '-'}</b></div>
              <div>Ghi chu: <b>{txn.note || '-'}</b></div>
            </div>
          </div>

        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>STT</th>
              <th>Ma vat tu</th>
              <th>Ten vat tu</th>
              <th style={{ width: 80 }} className="center">DVT</th>
              <th style={{ width: 100 }} className="right">So luong</th>
              <th style={{ width: 120 }} className="right">Don gia</th>
              <th style={{ width: 140 }} className="right">Thanh tien</th>
              <th>Ghi chu</th>
            </tr>
          </thead>
          <tbody>
            {txn.items.map((it, idx) => {
              const line = it.line_total != null ? Number(it.line_total || 0) : Number(it.quantity || 0) * Number(it.unit_price || 0)
              return (
                <tr key={`${it.material_key}_${idx}`}>
                  <td>{idx + 1}</td>
                  <td>{it.material_key || '-'}</td>
                  <td>{it.material_name || '-'}</td>
                  <td className="center">{it.item_unit || '-'}</td>
                  <td className="right">{Number(it.quantity || 0).toLocaleString('vi-VN')}</td>
                  <td className="right">{it.unit_price != null ? Number(it.unit_price).toLocaleString('vi-VN') : '-'}</td>
                  <td className="right">{Number(line || 0).toLocaleString('vi-VN')}</td>
                  <td>{it.note || ''}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={4} className="right">Tong cong</th>
              <th className="right">{Number(totalQty || 0).toLocaleString('vi-VN')}</th>
              <th />
              <th className="right">{Number(totalMoney || 0).toLocaleString('vi-VN')}</th>
              <th />
            </tr>
          </tfoot>
        </table>

          <div className="print-note">Luu y: Kiem tra thong tin truoc khi ky xac nhan.</div>

          <div className="print-sign-grid">
            <div>
              <div className="print-sign-title">Nguoi lap phieu</div>
              <div className="print-sign-box">(Ky, ghi ro ho ten)</div>
            </div>
            <div>
              <div className="print-sign-title">Nguoi giao / xuat</div>
              <div className="print-sign-box">(Ky, ghi ro ho ten)</div>
            </div>
            <div>
              <div className="print-sign-title">Nguoi nhan / nhap</div>
              <div className="print-sign-box">(Ky, ghi ro ho ten)</div>
            </div>
            <div>
              <div className="print-sign-title">Quan ly kho</div>
              <div className="print-sign-box">(Ky, dong dau)</div>
            </div>
          </div>
        </div>

        <div className="print-footer">{brand.footerText}</div>
      </div>
    </div>
  )
}
