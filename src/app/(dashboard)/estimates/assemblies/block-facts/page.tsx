'use client'

import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type AssemblyRow = {
  id: string
  name: string
}

type FactPreview = {
  assembly_id: string
  assembly_name: string
  inferred_input: Record<string, any>
  assembly_summary: Record<string, any>
  block_rows: Array<Record<string, any>>
  bundle_matches: Array<{
    block_id: string
    block_name: string
    component_type: string
    matches: Array<{
      value: string
      name: string
      template_codes: string[]
      score: number
      criteria: Record<string, string>
    }>
  }>
  bundle_conflicts: Array<{
    block_id: string
    block_name: string
    component_type: string
    score: number
    rule_names: string[]
  }>
  extra_facts: Record<string, any>
  forced_template_ids_from_blocks: string[]
  forced_template_codes_from_bundles: string[]
  forced_template_ids_from_bundles: string[]
}

export default function AssemblyBlockFactsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryAssemblyId = String(searchParams.get('assembly_id') || '')

  const [assemblies, setAssemblies] = useState<AssemblyRow[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<FactPreview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const res = await fetch('/api/assemblies?limit=200')
      const json = await res.json().catch(() => ({}))
      const rows = Array.isArray(json.data) ? json.data : []
      const mapped = rows.map((row: any) => ({
        id: String(row.id || ''),
        name: String(row.name || row.id || 'Assembly'),
      })).filter((row: AssemblyRow) => row.id)
      setAssemblies(mapped)
      if (queryAssemblyId && mapped.some((row: AssemblyRow) => row.id === queryAssemblyId)) {
        setSelectedId(queryAssemblyId)
      } else if (mapped[0]?.id) {
        setSelectedId(mapped[0].id)
      }
    })()
  }, [queryAssemblyId])

  useEffect(() => {
    if (!selectedId) return
    ;(async () => {
      setLoading(true)
      setError('')
      const res = await fetch(`/api/assemblies/${selectedId}/block-facts-preview`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setData(null)
        setError(String(json.error || 'Khong tai duoc fact block'))
        setLoading(false)
        return
      }
      setData(json.data || null)
      setLoading(false)
    })()
  }, [selectedId])

  const factRows = useMemo(() => {
    const entries = Object.entries(data?.extra_facts || {})
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    return entries
  }, [data?.extra_facts])

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text4)', marginBottom: 4 }}>ASSEMBLY FACTS</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Giai thich boc tach theo block</h1>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>
            Xem moi block dang sinh ra thong so nao, preset nao, va dang ep template nao truoc khi vao du toan.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn" onClick={() => router.push('/estimates/assemblies')}>
            Ve Assemblies
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr auto auto', gap: 10, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Assembly</div>
            <select className="select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {assemblies.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={() => selectedId && window.open(`/api/assemblies/${selectedId}/block-facts-preview`, '_blank')}>
            Mo JSON
          </button>
          <button className="btn" onClick={() => selectedId && router.push(`/estimates/assemblies/designer-3d?assembly_id=${selectedId}`)}>
            Mo Designer 3D
          </button>
        </div>
      </div>

      {loading ? <div style={{ color: 'var(--text3)' }}>Dang tai fact...</div> : null}
      {error ? <div style={{ color: 'var(--red)' }}>{error}</div> : null}

      {data && !loading ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 14 }}>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text4)' }}>Assembly</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{data.assembly_name}</div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text4)' }}>So block</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{Number(data.assembly_summary?.block_count || 0)}</div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text4)' }}>Dien tich suy ra</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{Number(data.assembly_summary?.inferred_floor_area_total || 0).toLocaleString('vi-VN')} m2</div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text4)' }}>So tang suy ra</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{Number(data.assembly_summary?.inferred_floors || 0)}</div>
            </div>
          </div>

          <div className="card" style={{ padding: 14, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Input suy ra cho du toan</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {Object.entries(data.inferred_input || {}).map(([key, value]) => (
                <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 6 }}>{key}</div>
                  <div style={{ fontSize: 14, color: 'var(--text)' }}>
                    {typeof value === 'number' ? value.toLocaleString('vi-VN') : String(value || '-')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 14, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Template ep tu block</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 6 }}>
              Tu block gan truc tiep: {data.forced_template_ids_from_blocks.length || 0} template
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 6 }}>
              Tu bundle map: {data.forced_template_codes_from_bundles.length || 0} template code
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              {data.forced_template_codes_from_bundles.length
                ? data.forced_template_codes_from_bundles.join(', ')
                : 'Chua co bundle map nao match'}
            </div>
          </div>

          <div className="card" style={{ padding: 14, marginBottom: 14, overflowX: 'auto' }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Bang block va thong so sinh ra</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text4)', fontSize: 11 }}>
                  <th style={th}>Block</th>
                  <th style={th}>Loai</th>
                  <th style={th}>Tang</th>
                  <th style={th}>Dien tich</th>
                  <th style={th}>Khong gian</th>
                  <th style={th}>Preset</th>
                  <th style={th}>Openings</th>
                  <th style={th}>Template bundle</th>
                </tr>
              </thead>
              <tbody>
                {data.block_rows.map((row) => (
                  <tr key={String(row.block_id)} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 700 }}>{String(row.block_name || '-')}</div>
                      <div style={{ color: 'var(--text4)', fontSize: 11 }}>{String(row.template_name || row.template_code || '-')}</div>
                    </td>
                    <td style={td}>{String(row.component_type || '-')}</td>
                    <td style={td}>{Number(row.level_index || 0)}</td>
                    <td style={td}>{Number(row.area_m2 || 0).toLocaleString('vi-VN')} m2</td>
                    <td style={td}>
                      <div>{String(row.space_type || '-')}</div>
                      <div style={{ color: 'var(--text4)', fontSize: 11 }}>{String(row.space_profile || '-')}</div>
                    </td>
                    <td style={td}>
                      <div>opening: {String(row.opening_preset || '-')}</div>
                      <div>roof: {String(row.roof_preset || '-')}</div>
                      <div>stair: {String(row.stair_preset || '-')}</div>
                      <div>interior: {String(row.interior_preset || '-')}</div>
                    </td>
                    <td style={td}>
                      <div>tong: {Number(row.opening_count || 0)}</div>
                      <div>cua: {Number(row.door_count || 0)} | so: {Number(row.window_count || 0)} | thong gio: {Number(row.vent_count || 0)}</div>
                      <div style={{ color: 'var(--text4)', fontSize: 11 }}>{Number(row.opening_area_total || 0).toLocaleString('vi-VN')} m2</div>
                    </td>
                    <td style={td}>
                      {Array.isArray(row.bundle_template_codes) && row.bundle_template_codes.length
                        ? row.bundle_template_codes.join(', ')
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ padding: 14, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Bundle map dang match</div>
            {!data.bundle_matches.length ? (
              <div style={{ color: 'var(--text3)' }}>Chua co bundle map nao match voi block hien tai.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {data.bundle_matches.map((row) => (
                  <div key={row.block_id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                    <div style={{ fontWeight: 700 }}>{row.block_name} | {row.component_type}</div>
                    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                      {row.matches.map((match) => (
                        <div key={`${row.block_id}-${match.value}`} style={{ border: '1px dashed var(--border2)', borderRadius: 8, padding: 8 }}>
                          <div style={{ fontSize: 13, color: 'var(--text)' }}>{match.name} ({match.value})</div>
                          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                            Template: {match.template_codes.join(', ')}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text4)', marginTop: 4 }}>
                            Match {match.score} dieu kien: {Object.entries(match.criteria).map(([k, v]) => `${k}=${v}`).join(' | ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {data.bundle_conflicts?.length > 0 && (
            <div className="card" style={{ padding: 14, marginBottom: 14, border: '1px solid rgba(239,68,68,.28)', background: 'rgba(239,68,68,.06)' }}>
              <div style={{ fontWeight: 700, marginBottom: 10, color: 'var(--red)' }}>Xung dot runtime tren assembly nay</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {data.bundle_conflicts.map((row) => (
                  <div key={`${row.block_id}-${row.rule_names.join('|')}`} style={{ border: '1px solid rgba(239,68,68,.22)', borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{row.block_name} | {row.component_type}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                      Điểm đồng hạng: {row.score}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                      Rule cùng match: {row.rule_names.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Tat ca fact sinh ra</div>
            <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
              {factRows.map(([key, value]) => (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12, padding: '8px 10px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ color: 'var(--text4)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{key}</div>
                  <div style={{ color: 'var(--text2)', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

const th: CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--border)',
}

const td: CSSProperties = {
  padding: '10px',
  verticalAlign: 'top',
  fontSize: 12,
  color: 'var(--text2)',
}
