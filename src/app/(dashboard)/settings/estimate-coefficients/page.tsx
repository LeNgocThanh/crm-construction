'use client'

import { useEffect, useState } from 'react'

type CoeffConfig = {
  id: string
  floors_threshold: number
  floors_coeff_per_extra: number
  tum_coeff: number
  basement_coeff: number
  elevator_coeff: number
  finish_co_ban_multiplier: number
  finish_tieu_chuan_multiplier: number
  finish_cao_cap_multiplier: number
}

type CoefficientInputProps = {
  label: string
  sub: string
  value: string
  onChange: (value: string) => void
}

const CoefficientInput = ({ label, sub, value, onChange }: CoefficientInputProps) => (
  <div>
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text4)', marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>{sub}</div>
    <input 
      type="number"
      step="0.01"
      className="input" 
      style={{ fontWeight: 600, fontSize: 14 }}
      placeholder="0.00" 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
    />
  </div>
);

export default function EstimateCoefficientsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({
    floors_threshold: '3',
    floors_coeff_per_extra: '0.02',
    tum_coeff: '0.03',
    basement_coeff: '0.08',
    elevator_coeff: '0.06',
    finish_co_ban_multiplier: '1',
    finish_tieu_chuan_multiplier: '1.08',
    finish_cao_cap_multiplier: '1.18',
  })

  useEffect(() => {
    loadData()
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2300)
  }

  async function loadData() {
    setLoading(true)
    const res = await fetch('/api/settings/estimate/coefficients')
    const json = await res.json()
    const data: CoeffConfig | null = json.data || null
    if (data) {
      setForm({
        floors_threshold: String(data.floors_threshold),
        floors_coeff_per_extra: String(data.floors_coeff_per_extra),
        tum_coeff: String(data.tum_coeff),
        basement_coeff: String(data.basement_coeff),
        elevator_coeff: String(data.elevator_coeff),
        finish_co_ban_multiplier: String(data.finish_co_ban_multiplier),
        finish_tieu_chuan_multiplier: String(data.finish_tieu_chuan_multiplier),
        finish_cao_cap_multiplier: String(data.finish_cao_cap_multiplier),
      })
    }
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/settings/estimate/coefficients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        floors_threshold: Number(form.floors_threshold),
        floors_coeff_per_extra: Number(form.floors_coeff_per_extra),
        tum_coeff: Number(form.tum_coeff),
        basement_coeff: Number(form.basement_coeff),
        elevator_coeff: Number(form.elevator_coeff),
        finish_co_ban_multiplier: Number(form.finish_co_ban_multiplier),
        finish_tieu_chuan_multiplier: Number(form.finish_tieu_chuan_multiplier),
        finish_cao_cap_multiplier: Number(form.finish_cao_cap_multiplier),
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json()
      showToast(`Loi: ${j.error || 'Không thể lưu cấu hình'}`)
      return
    }
    showToast('Đã cập nhật hệ số')
    await loadData()
  }
  

  return (
    <div className="fade-up">
      {/* Header Section */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 10,
          letterSpacing: 2,
          color: 'var(--blue)', // Đổi sang màu nhấn để nổi bật
          fontFamily: "'JetBrains Mono',monospace",
          marginBottom: 4,
          fontWeight: 700
        }}>
          ESTIMATE COEFFICIENTS
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
          Cấu hình hệ số đặc tính công trình
        </h1>
        <div style={{ fontSize: 14, color: 'var(--text3)', maxWidth: 700, lineHeight: 1.5 }}>
          Quản trị viên có thể thay đổi hệ số tầng, tum, hầm, thang máy và hệ số hoàn thiện để điều chỉnh đơn giá dự toán tự động.
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 70 }}>
          <span className="spinner" style={{ width: 28, height: 28 }} />
        </div>
      ) : (
        <div className="card" style={{ padding: 20, maxWidth: 1000, border: '1px solid var(--border)' }}>
          {/* Grid System: Responsive tự động */}
          <div style={{
            display: 'grid',
            // Tự động chia cột dựa trên chiều rộng: tối thiểu 220px mỗi ô
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 20
          }}>

            {/* Nhóm Hệ số tầng & Quy mô */}
            <div style={{ gridColumn: '1 / -1', marginTop: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>
              QUY MÔ & TẦNG
            </div>

            <CoefficientInput
              label="floors_threshold"
              sub="Ngưỡng số tầng"
              value={form.floors_threshold}
              onChange={(val) => setForm(p => ({ ...p, floors_threshold: val }))}
            />
            <CoefficientInput
              label="floors_coeff_per_extra"
              sub="Hệ số tầng vượt ngưỡng"
              value={form.floors_coeff_per_extra}
              onChange={(val) => setForm(p => ({ ...p, floors_coeff_per_extra: val }))}
            />
            <CoefficientInput
              label="tum_coeff"
              sub="Hệ số mỗi tum"
              value={form.tum_coeff}
              onChange={(val) => setForm(p => ({ ...p, tum_coeff: val }))}
            />
            <CoefficientInput
              label="basement_coeff"
              sub="Hệ số mỗi hầm"
              value={form.basement_coeff}
              onChange={(val) => setForm(p => ({ ...p, basement_coeff: val }))}
            />
            <CoefficientInput
              label="elevator_coeff"
              sub="Hệ số thang máy"
              value={form.elevator_coeff}
              onChange={(val) => setForm(p => ({ ...p, elevator_coeff: val }))}
            />

            {/* Nhóm Hệ số hoàn thiện */}
            <div style={{ gridColumn: '1 / -1', marginTop: 20, paddingBottom: 8, borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--orange)' }}>
              MỨC ĐỘ HOÀN THIỆN
            </div>

            <CoefficientInput
              label="finish_co_ban"
              sub="Mức cơ bản"
              value={form.finish_co_ban_multiplier}
              onChange={(val) => setForm(p => ({ ...p, finish_co_ban_multiplier: val }))}
            />
            <CoefficientInput
              label="finish_tieu_chuan"
              sub="Mức tiêu chuẩn"
              value={form.finish_tieu_chuan_multiplier}
              onChange={(val) => setForm(p => ({ ...p, finish_tieu_chuan_multiplier: val }))}
            />
            <CoefficientInput
              label="finish_cao_cap"
              sub="Mức cao cấp"
              value={form.finish_cao_cap_multiplier}
              onChange={(val) => setForm(p => ({ ...p, finish_cao_cap_multiplier: val }))}
            />
          </div>

          {/* Logic Formula Box */}
          <div style={{
            marginTop: 30,
            padding: 16,
            background: 'var(--bg2, rgba(0,0,0,0.03))',
            borderRadius: 8,
            border: '1px dashed var(--border)'
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--blue)' }}>ℹ</span> CÔNG THỨC ĐANG ÁP DỤNG
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'monospace', lineHeight: 1.6 }}>
              coeff = 1 + max(0, floors - <span style={{ color: 'var(--blue)' }}>threshold</span>) * <span style={{ color: 'var(--blue)' }}>extra_coeff</span> + (tum * tum_coeff) + (hầm * hầm_coeff) + elevator
              <br />
              <span style={{ color: 'var(--text4)' }}>Final Price = Base Price * coeff * finish_multiplier</span>
            </div>
          </div>

          {/* Save Button */}
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn-primary"
              style={{ padding: '12px 32px', fontSize: 14, fontWeight: 600 }}
              onClick={save}
              disabled={saving}
            >
              {saving ? 'Đang lưu...' : 'Lưu cấu hình hệ số'}
            </button>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toast && (
        <div className="fade-in" style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'var(--surface)',
          border: '1px solid var(--border2)',
          color: 'var(--text)',
          borderRadius: 12,
          padding: '12px 20px',
          fontSize: 14,
          boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
          {toast}
        </div>
      )}
    </div>
  )
}
