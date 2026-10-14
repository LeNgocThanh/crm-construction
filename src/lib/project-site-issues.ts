export function normalizeUploadUrl(url: string | null | undefined) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  const m = raw.match(/\/api\/uploads\/([^/?#]+)/i)
  if (!m?.[1]) return raw
  const base = String(process.env.FILE_URL || process.env.UPLOAD_FILE_BASE || 'https://webhook.tidicons.online/api/uploads').trim().replace(/\/+$/, '')
  return `${base}/${m[1]}`
}

export function genProjectSiteIssueCode(workflowType: string | null | undefined) {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const prefix = String(workflowType || '').trim() === 'hse_issue' ? 'HSI' : 'PLI'
  return `${prefix}-${y}${m}${day}-${hh}${mm}${ss}`
}

export function serializeProjectSiteIssue(row: any) {
  if (!row) return row
  return {
    ...row,
    media: Array.isArray(row?.media)
      ? row.media.map((m: any) => ({
          ...m,
          file_url: normalizeUploadUrl(m?.file_url),
          file_record: m?.file_record
            ? {
                ...m.file_record,
                file_url: normalizeUploadUrl(m.file_record.file_url),
                file_size_bytes: m.file_record.file_size_bytes != null ? Number(m.file_record.file_size_bytes) : null,
              }
            : null,
        }))
      : [],
  }
}
