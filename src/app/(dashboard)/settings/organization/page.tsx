'use client'

import { useEffect, useMemo, useState } from 'react'

type Org = {
  id: string
  parent_id?: string | null
  org_key: string
  org_name: string
  org_type?: string | null
  region_code?: string | null
  address?: string | null
  legal_name?: string | null
  tax_code?: string | null
  description?: string | null
  is_active: boolean
  parent?: { id: string; org_name: string; org_key: string } | null
  _count?: { departments?: number }
}

type RegionOption = {
  code: string
  name: string
}

type Dept = {
  id: string
  organization_id: string
  parent_id?: string | null
  dept_key: string
  dept_name: string
  description?: string | null
  sort_order: number
  is_active: boolean
  organization?: { id: string; org_name: string; org_key: string }
  parent?: { id: string; dept_name: string } | null
  _count?: { children?: number }
}

const EMPTY_ORG = { parent_id: '', org_key: '', org_name: '', org_type: '', region_code: '', address: '', legal_name: '', tax_code: '', description: '', is_active: true }
const EMPTY_DEPT = { organization_id: '', parent_id: '', dept_key: '', dept_name: '', description: '', sort_order: '0', is_active: true }

export default function SettingsOrganizationPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [depts, setDepts] = useState<Dept[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [regions, setRegions] = useState<RegionOption[]>([])

  const [orgForm, setOrgForm] = useState({ ...EMPTY_ORG })
  const [orgEditingId, setOrgEditingId] = useState<string | null>(null)

  const [deptForm, setDeptForm] = useState({ ...EMPTY_DEPT })
  const [deptEditingId, setDeptEditingId] = useState<string | null>(null)

  async function loadAll() {
    setLoading(true)
    const [oRes, dRes, rRes] = await Promise.all([
      fetch('/api/organizations'),
      fetch('/api/departments'),
      fetch('/api/settings/regions?active_only=true&level=province&limit=500'),
    ])
    const oJson = await oRes.json()
    const dJson = await dRes.json()
    const rJson = await rRes.json().catch(() => ({}))
    setOrgs(Array.isArray(oJson.data) ? oJson.data : [])
    setDepts(Array.isArray(dJson.data) ? dJson.data : [])
    setRegions(
      (Array.isArray(rJson.data) ? rJson.data : [])
        .map((x: any) => ({ code: String(x.code || ''), name: String(x.name || x.code || '') }))
        .filter((x: RegionOption) => x.code)
    )
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  const deptParentOptions = useMemo(() => {
    if (!deptForm.organization_id) return [] as Dept[]
    return depts.filter((d) => d.organization_id === deptForm.organization_id && d.id !== deptEditingId)
  }, [depts, deptForm.organization_id, deptEditingId])

  async function saveOrg() {
    const payload = {
      parent_id: orgForm.parent_id || null,
      org_key: orgForm.org_key.trim().toLowerCase(),
      org_name: orgForm.org_name.trim(),
      org_type: orgForm.org_type.trim() || null,
      region_code: orgForm.region_code.trim() || null,
      address: orgForm.address.trim() || null,
      legal_name: orgForm.legal_name.trim() || null,
      tax_code: orgForm.tax_code.trim() || null,
      description: orgForm.description.trim() || null,
      is_active: orgForm.is_active,
    }
    if (!payload.org_key || !payload.org_name) {
      showToast('Thieu org_key hoac org_name')
      return
    }
    setSaving(true)
    const r = await fetch(orgEditingId ? `/api/organizations/${orgEditingId}` : '/api/organizations', {
      method: orgEditingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await r.json().catch(() => ({}))
    setSaving(false)
    if (!r.ok) {
      showToast(j.error || 'Khong the luu organization')
      return
    }
    setOrgEditingId(null)
    setOrgForm({ ...EMPTY_ORG })
    await loadAll()
    showToast(orgEditingId ? 'Da cap nhat organization' : 'Da tao organization')
  }

  async function saveDept() {
    const payload = {
      organization_id: deptForm.organization_id,
      parent_id: deptForm.parent_id || null,
      dept_key: deptForm.dept_key.trim().toLowerCase(),
      dept_name: deptForm.dept_name.trim(),
      description: deptForm.description.trim() || null,
      sort_order: Number(deptForm.sort_order || '0') || 0,
      is_active: deptForm.is_active,
    }
    if (!payload.organization_id || !payload.dept_key || !payload.dept_name) {
      showToast('Thieu organization, dept_key hoac dept_name')
      return
    }
    setSaving(true)
    const r = await fetch(deptEditingId ? `/api/departments/${deptEditingId}` : '/api/departments', {
      method: deptEditingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await r.json().catch(() => ({}))
    setSaving(false)
    if (!r.ok) {
      showToast(j.error || 'Khong the luu department')
      return
    }
    setDeptEditingId(null)
    setDeptForm({ ...EMPTY_DEPT })
    await loadAll()
    showToast(deptEditingId ? 'Da cap nhat department' : 'Da tao department')
  }

  function beginEditOrg(o: Org) {
    setOrgEditingId(o.id)
    setOrgForm({
      parent_id: o.parent_id || '',
      org_key: o.org_key || '',
      org_name: o.org_name || '',
      org_type: o.org_type || '',
      region_code: o.region_code || '',
      address: o.address || '',
      legal_name: o.legal_name || '',
      tax_code: o.tax_code || '',
      description: o.description || '',
      is_active: Boolean(o.is_active),
    })
  }

  function beginEditDept(d: Dept) {
    setDeptEditingId(d.id)
    setDeptForm({
      organization_id: d.organization_id || '',
      parent_id: d.parent_id || '',
      dept_key: d.dept_key || '',
      dept_name: d.dept_name || '',
      description: d.description || '',
      sort_order: String(d.sort_order ?? 0),
      is_active: Boolean(d.is_active),
    })
  }

  async function deleteOrg(o: Org) {
    if (!confirm(`Xoa organization "${o.org_name}"?`)) return
    const r = await fetch(`/api/organizations/${o.id}`, { method: 'DELETE' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return showToast(j.error || 'Khong the xoa organization')
    await loadAll()
    showToast('Da xoa organization')
  }

  async function deleteDept(d: Dept) {
    if (!confirm(`Xoa department "${d.dept_name}"?`)) return
    const r = await fetch(`/api/departments/${d.id}`, { method: 'DELETE' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return showToast(j.error || 'Khong the xoa department')
    await loadAll()
    showToast('Da xoa department')
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Organization & Departments</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          Cau truc to chuc san sang cho phase gan user sau nay
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 20 }}>Dang tai...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.2, color: 'var(--text3)', marginBottom: 8 }}>
              {orgEditingId ? 'CAP NHAT ORGANIZATION' : 'TAO ORGANIZATION'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 8, marginBottom: 8 }}>
              <select className="select" value={orgForm.parent_id} onChange={(e) => setOrgForm((p) => ({ ...p, parent_id: e.target.value }))}>
                <option value="">(Khong co cong ty cha)</option>
                {orgs.filter((o) => o.id !== orgEditingId).map((o) => <option key={o.id} value={o.id}>{o.org_name}</option>)}
              </select>
              <input className="input" placeholder="org_key" value={orgForm.org_key} onChange={(e) => setOrgForm((p) => ({ ...p, org_key: e.target.value }))} />
              <input className="input" placeholder="org_name" value={orgForm.org_name} onChange={(e) => setOrgForm((p) => ({ ...p, org_name: e.target.value }))} />
              <select className="select" value={orgForm.org_type} onChange={(e) => setOrgForm((p) => ({ ...p, org_type: e.target.value }))}>
                <option value="">(org_type khong bat buoc)</option>
                <option value="holding">holding</option>
                <option value="subsidiary">subsidiary</option>
                <option value="branch">branch</option>
                <option value="legal_entity">legal_entity</option>
              </select>
              <select className="select" value={orgForm.region_code} onChange={(e) => setOrgForm((p) => ({ ...p, region_code: e.target.value }))}>
                <option value="">(region khong bat buoc)</option>
                {regions.map((r) => <option key={r.code} value={r.code}>{r.code} - {r.name}</option>)}
              </select>
              <input className="input" placeholder="address (optional)" value={orgForm.address} onChange={(e) => setOrgForm((p) => ({ ...p, address: e.target.value }))} />
              <input className="input" placeholder="legal_name" value={orgForm.legal_name} onChange={(e) => setOrgForm((p) => ({ ...p, legal_name: e.target.value }))} />
              <input className="input" placeholder="tax_code" value={orgForm.tax_code} onChange={(e) => setOrgForm((p) => ({ ...p, tax_code: e.target.value }))} />
            </div>
            <input className="input" placeholder="description" value={orgForm.description} onChange={(e) => setOrgForm((p) => ({ ...p, description: e.target.value }))} />
            <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={orgForm.is_active} onChange={(e) => setOrgForm((p) => ({ ...p, is_active: e.target.checked }))} />
                Active
              </label>
              <button className="btn-primary" disabled={saving} onClick={saveOrg}>{orgEditingId ? 'Cap nhat' : '+ Tao'}</button>
              {orgEditingId ? <button className="btn-ghost" onClick={() => { setOrgEditingId(null); setOrgForm({ ...EMPTY_ORG }) }}>Huy</button> : null}
            </div>

            <div style={{ marginTop: 10, maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {orgs.map((o) => (
                <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, borderBottom: '1px solid var(--border)', padding: '8px 10px' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{o.org_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {o.org_key}
                      {o.parent?.org_name ? ` • parent: ${o.parent.org_name}` : ''}
                      {o.region_code ? ` • region:${o.region_code}` : ''}
                      {o.org_type ? ` • type:${o.org_type}` : ''}
                      {` • depts: ${o._count?.departments || 0}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-ghost" style={{ padding: '3px 8px' }} onClick={() => beginEditOrg(o)}>Sua</button>
                    <button className="btn-danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => deleteOrg(o)}>Xoa</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.2, color: 'var(--text3)', marginBottom: 8 }}>
              {deptEditingId ? 'CAP NHAT DEPARTMENT' : 'TAO DEPARTMENT'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <select className="select" value={deptForm.organization_id} onChange={(e) => setDeptForm((p) => ({ ...p, organization_id: e.target.value }))}>
                <option value="">(Chon organization)</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.org_name}</option>)}
              </select>
              <select className="select" value={deptForm.parent_id} onChange={(e) => setDeptForm((p) => ({ ...p, parent_id: e.target.value }))}>
                <option value="">(Khong co parent)</option>
                {deptParentOptions.map((d) => <option key={d.id} value={d.id}>{d.dept_name}</option>)}
              </select>
              <input className="input" placeholder="dept_key" value={deptForm.dept_key} onChange={(e) => setDeptForm((p) => ({ ...p, dept_key: e.target.value }))} />
              <input className="input" placeholder="dept_name" value={deptForm.dept_name} onChange={(e) => setDeptForm((p) => ({ ...p, dept_name: e.target.value }))} />
              <input className="input" placeholder="sort_order" value={deptForm.sort_order} onChange={(e) => setDeptForm((p) => ({ ...p, sort_order: e.target.value }))} />
              <input className="input" placeholder="description" value={deptForm.description} onChange={(e) => setDeptForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={deptForm.is_active} onChange={(e) => setDeptForm((p) => ({ ...p, is_active: e.target.checked }))} />
                Active
              </label>
              <button className="btn-primary" disabled={saving} onClick={saveDept}>{deptEditingId ? 'Cap nhat' : '+ Tao'}</button>
              {deptEditingId ? <button className="btn-ghost" onClick={() => { setDeptEditingId(null); setDeptForm({ ...EMPTY_DEPT }) }}>Huy</button> : null}
            </div>

            <div style={{ marginTop: 10, maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {depts.map((d) => (
                <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, borderBottom: '1px solid var(--border)', padding: '8px 10px' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{d.dept_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {d.organization?.org_name || d.organization_id} • key:{d.dept_key} • sort:{d.sort_order} • child:{d._count?.children || 0}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-ghost" style={{ padding: '3px 8px' }} onClick={() => beginEditDept(d)}>Sua</button>
                    <button className="btn-danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => deleteDept(d)}>Xoa</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast ? (
        <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 1000 }} className="card">
          <div style={{ padding: '9px 12px', fontSize: 12 }}>{toast}</div>
        </div>
      ) : null}
    </div>
  )
}
