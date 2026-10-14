'use client'

import { useEffect, useState } from 'react'

type PrintBrandData = {
  id: string
  brandName: string
  legalName: string
  tagline: string
  logoUrl?: string | null
  accentColor: string
  accentSoft: string
  borderColor: string
  address?: string | null
  phone?: string | null
  email?: string | null
  taxCode?: string | null
  footerText: string
  updated_at?: string | null
  updated_by?: string | null
}

const EMPTY_FORM: PrintBrandData = {
  id: 'default',
  brandName: 'TidiCons',
  legalName: 'CRM Construction',
  tagline: 'Biểu mẫu vận hành và báo cáo nội bộ',
  logoUrl: '',
  accentColor: '#ea580c',
  accentSoft: '#fff7ed',
  borderColor: '#cbd5e1',
  address: '',
  phone: '',
  email: '',
  taxCode: '',
  footerText: 'TidiCons CRM Construction - Mẫu in dùng chung cho kho, nhân công, kế toán và dự án.',
  updated_at: null,
  updated_by: null,
}

export default function PrintBrandSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState<PrintBrandData>(EMPTY_FORM)

  async function loadData() {
    setLoading(true)
    const res = await fetch('/api/settings/print-brand', { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setToast(json?.error || 'Không tải được cấu hình mẫu in')
      setLoading(false)
      return
    }
    setForm({
      ...EMPTY_FORM,
      ...(json?.data || {}),
      logoUrl: json?.data?.logoUrl || '',
      address: json?.data?.address || '',
      phone: json?.data?.phone || '',
      email: json?.data?.email || '',
      taxCode: json?.data?.taxCode || '',
    })
    setLoading(false)
  }

  async function saveData() {
    if (!form.brandName.trim() || !form.legalName.trim()) {
      setToast('Thiếu tên thương hiệu hoặc tên pháp lý')
      return
    }
    setSaving(true)
    const res = await fetch('/api/settings/print-brand', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandName: form.brandName.trim(),
        legalName: form.legalName.trim(),
        tagline: form.tagline.trim(),
        logoUrl: form.logoUrl?.trim() || null,
        accentColor: form.accentColor.trim(),
        accentSoft: form.accentSoft.trim(),
        borderColor: form.borderColor.trim(),
        address: form.address?.trim() || null,
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        taxCode: form.taxCode?.trim() || null,
        footerText: form.footerText.trim(),
      }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setToast(json?.error || 'Không lưu được cấu hình mẫu in')
      return
    }
    setToast('Đã lưu cấu hình mẫu in')
    await loadData()
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2500)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>SETTINGS</div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Cấu hình mẫu in</h1>
        <div style={{ marginTop: 6, color: 'var(--text3)', fontSize: 13 }}>
          Đổi nhận diện phần in dùng chung cho báo cáo giá vật tư, phiếu kho và các mẫu in khác sẽ áp tiếp sau này.
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Hướng dẫn sử dụng</div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text3)' }}>
              Thay đổi ở đây sẽ ảnh hưởng toàn bộ mẫu in dùng chung của hệ thống, không chỉ một trang riêng lẻ.
            </div>
          </div>
          <button className="btn" onClick={() => setShowGuide((v) => !v)}>{showGuide ? 'Ẩn hướng dẫn' : 'Hiện hướng dẫn'}</button>
        </div>
        {showGuide ? (
          <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'rgba(255,255,255,0.02)', fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
            <div>1. Tên thương hiệu: dòng nổi bật ở phần đầu của mẫu in.</div>
            <div>2. Tên pháp lý: tên công ty hiển thị ở tiêu đề chính.</div>
            <div>3. Màu nhấn: màu viền, nút in, bảng tiêu đề và các khối nổi bật.</div>
            <div>4. Footer: dòng cuối cùng xuất hiện ở tất cả mẫu in dùng chung.</div>
            <div>5. Logo URL: nếu có ảnh logo thì hệ thống sẽ ưu tiên dùng logo đó ở phần đầu mẫu in.</div>
          </div>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Thông tin thương hiệu in</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Tên thương hiệu</div>
              <input className="input" value={form.brandName} onChange={(e) => setForm((p) => ({ ...p, brandName: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Tên pháp lý / tên hiển thị công ty</div>
              <input className="input" value={form.legalName} onChange={(e) => setForm((p) => ({ ...p, legalName: e.target.value }))} />
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Khẩu hiệu / mô tả ngắn</div>
            <input className="input" value={form.tagline} onChange={(e) => setForm((p) => ({ ...p, tagline: e.target.value }))} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Logo URL</div>
            <input className="input" placeholder="https://..." value={form.logoUrl || ''} onChange={(e) => setForm((p) => ({ ...p, logoUrl: e.target.value }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Màu nhấn chính</div>
              <input className="input" value={form.accentColor} onChange={(e) => setForm((p) => ({ ...p, accentColor: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Màu nền nhấn mềm</div>
              <input className="input" value={form.accentSoft} onChange={(e) => setForm((p) => ({ ...p, accentSoft: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Màu viền chung</div>
              <input className="input" value={form.borderColor} onChange={(e) => setForm((p) => ({ ...p, borderColor: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Số điện thoại</div>
              <input className="input" value={form.phone || ''} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Email</div>
              <input className="input" value={form.email || ''} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Mã số thuế</div>
              <input className="input" value={form.taxCode || ''} onChange={(e) => setForm((p) => ({ ...p, taxCode: e.target.value }))} />
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Địa chỉ</div>
            <textarea className="input" rows={3} value={form.address || ''} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Dòng chân trang chung</div>
            <textarea className="input" rows={3} value={form.footerText} onChange={(e) => setForm((p) => ({ ...p, footerText: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {form.updated_at ? `Cập nhật lần cuối: ${new Date(form.updated_at).toLocaleString('vi-VN')}` : 'Chưa có bản lưu riêng, đang dùng mặc định'}
              {form.updated_by ? ` | bởi ${form.updated_by}` : ''}
            </div>
            <button className="btn-primary" disabled={saving || loading} onClick={() => void saveData()}>
              {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Xem nhanh mẫu nhận diện</div>
          <div style={{ border: `1px solid ${form.borderColor}`, borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
            <div style={{ padding: 18, borderBottom: `2px solid ${form.accentColor}`, background: `linear-gradient(135deg, ${form.accentSoft} 0%, #ffffff 65%)` }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: form.accentColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, overflow: 'hidden' }}>
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt={form.brandName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    String(form.brandName || 'TI').slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 12, letterSpacing: 1.3, textTransform: 'uppercase', color: form.accentColor, fontWeight: 700 }}>{form.brandName || '-'}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{form.legalName || '-'}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{form.tagline || '-'}</div>
                </div>
              </div>
              <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 10, border: '1px solid #fdba74', background: form.accentSoft, color: '#7c2d12', fontSize: 12 }}>
                Đây là vùng thông tin phạm vi báo cáo / phiếu in.
              </div>
            </div>
            <div style={{ padding: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div style={{ border: `1px solid ${form.borderColor}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Chỉ số mẫu</div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>128</div>
                </div>
                <div style={{ border: `1px solid ${form.borderColor}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>Màu nhấn</div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, color: form.accentColor }}>#{form.accentColor.replace('#', '').toUpperCase()}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1.3 }}>Chân trang mẫu</div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>{form.footerText || '-'}</div>
            </div>
          </div>
        </div>
      </div>

      {loading ? <div style={{ marginTop: 12, color: 'var(--text3)' }}>Đang tải cấu hình mẫu in...</div> : null}
      {toast ? (
        <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', zIndex: 9999 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
