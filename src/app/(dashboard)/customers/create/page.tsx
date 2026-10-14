'use client'
// src/app/(dashboard)/customers/create/page.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CreateCustomerPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData(e.currentTarget)
    const body = {
      phone_number: fd.get('phone_number'),
      full_name:    fd.get('full_name') || undefined,
      status:       fd.get('status'),
      potential_score: fd.get('potential_score') ? Number(fd.get('potential_score')) : undefined,
      source: fd.get('source') || null,
      zalo_username: fd.get('zalo_username') || null,
      facebook: fd.get('facebook') || null,
    }

    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()

    if (!res.ok) {
      setError(json.error || 'Có lỗi xảy ra')
      setLoading(false)
      return
    }

    router.push(`/customers/${json.data.id}`)
  }

  const fieldStyle = { marginBottom: 18 }

  return (
    <div className="fade-up" style={{ maxWidth: 560 }}>
      {/* Back */}
      <Link
        href="/customers"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--text3)',
          textDecoration: 'none',
          fontSize: 13,
          marginBottom: 20,
        }}
      >
        ← Danh sách khách hàng
      </Link>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 24 }}>
        Thêm khách hàng mới
      </h1>

      <div className="card" style={{ padding: 28 }}>
        <form onSubmit={onSubmit}>
          <div style={fieldStyle}>
            <label className="label">Số điện thoại *</label>
            <input
              className="input"
              name="phone_number"
              placeholder="0901234567"
              pattern="[0-9]{9,11}"
              required
              autoFocus
            />
          </div>

          <div style={fieldStyle}>
            <label className="label">Họ và tên</label>
            <input
              className="input"
              name="full_name"
              placeholder="Nguyễn Văn A"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
            <div>
              <label className="label">Trạng thái</label>
              <select className="select" name="status" defaultValue="Mới">
                <option>Mới</option>
                <option>Đang tìm hiểu</option>
                <option>Hẹn gặp</option>
                <option>Đang thương thảo</option>
                <option>Tạm ngưng</option>
              </select>
            </div>
            <div>
              <label className="label">Potential Score (1-10)</label>
              <input
                className="input"
                name="potential_score"
                type="number"
                min="1"
                max="10"
                placeholder="5"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 18 }}>
            <div>
              <label className="label">Zalo</label>
              <input className="input" name="zalo_username" placeholder="zalo_username" />
            </div>
            <div>
              <label className="label">Facebook</label>
              <input className="input" name="facebook" placeholder="facebook_username" />
            </div>
            <div>
              <label className="label">Source</label>
              <select className="select" name="source" defaultValue="">
                <option value="">Không chọn</option>
                <option value="call">call</option>
                <option value="zalo">zalo</option>
                <option value="messenger">messenger</option>
                <option value="telegram">telegram</option>
                <option value="referral">referral</option>
                <option value="google">google</option>
                <option value="other">other</option>
              </select>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#EF444415',
                border: '1px solid #EF444430',
                color: 'var(--red)',
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <Link href="/customers" style={{ flex: 1 }}>
              <button className="btn-ghost" style={{ width: '100%' }}>Hủy</button>
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ flex: 2 }}
            >
              {loading ? 'Đang tạo...' : 'Tạo khách hàng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
