import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireRoles } from '@/lib/authz'
import { db } from '@/lib/db'

function pickFileUrl(payload: any): string {
  const direct = [payload?.file_url, payload?.url, payload?.secure_url, payload?.location]
  for (const v of direct) {
    const s = String(v || '').trim()
    if (s) return s
  }
  const data = payload?.data || payload?.result || payload?.file || null
  const nested = [data?.file_url, data?.url, data?.secure_url, data?.location]
  for (const v of nested) {
    const s = String(v || '').trim()
    if (s) return s
  }
  return ''
}

function pickFileName(payload: any): string {
  const direct = [payload?.filename, payload?.file_name, payload?.name]
  for (const v of direct) {
    const s = String(v || '').trim()
    if (s) return s
  }
  const data = payload?.data || payload?.result || payload?.file || null
  const nested = [data?.filename, data?.file_name, data?.name]
  for (const v of nested) {
    const s = String(v || '').trim()
    if (s) return s
  }
  return ''
}

function pickStorageFilenameFromUrl(fileUrl: string): string {
  const raw = String(fileUrl || '').trim()
  if (!raw) return ''
  const noQuery = raw.split('?')[0] || ''
  const part = noQuery.split('/').pop() || ''
  try {
    return decodeURIComponent(part)
  } catch {
    return part
  }
}

function normalizeUploadUrl(url: string | null | undefined) {
  const raw = String(url || '').trim()
  if (!raw) return raw
  const m = raw.match(/\/api\/uploads\/([^/?#]+)/i)
  if (!m?.[1]) return raw
  const base = String(process.env.FILE_URL || process.env.UPLOAD_FILE_BASE || 'https://webhook.tidicons.online/api/uploads').trim().replace(/\/+$/, '')
  return `${base}/${m[1]}`
}

function sanitizeMetadataUrls(input: any): any {
  if (Array.isArray(input)) return input.map(sanitizeMetadataUrls)
  if (input && typeof input === 'object') {
    const out: any = {}
    for (const [k, v] of Object.entries(input)) out[k] = sanitizeMetadataUrls(v)
    return out
  }
  if (typeof input === 'string') return normalizeUploadUrl(input)
  return input
}

async function ensureUniqueStorageFilename(baseName: string) {
  const initial = String(baseName || '').trim()
  if (!initial) return null
  const dot = initial.lastIndexOf('.')
  const stem = dot > 0 ? initial.slice(0, dot) : initial
  const ext = dot > 0 ? initial.slice(dot) : ''
  let candidate = initial
  let n = 1
  while (n <= 30) {
    const existed = await (db as any).fileRecord.findFirst({
      where: { storage_filename: candidate },
      select: { id: true },
    })
    if (!existed) return candidate
    candidate = `${stem}_${n}${ext}`
    n += 1
  }
  return `${stem}_${Date.now()}${ext}`
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles(['admin', 'manager', 'sales'])
  if (auth.error) return auth.error
  const session = auth.ctx!.session

  const endpoint = String(process.env.UPLOAD_API_URL || 'https://webhook.tidicons.online/api/upload').trim()
  const token = String(process.env.UPLOAD_API_TOKEN || '').trim()
  if (!token) return NextResponse.json({ error: 'UPLOAD_API_TOKEN_chua_cau_hinh' }, { status: 500 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Thieu file' }, { status: 400 })

  const purpose = String(form.get('purpose') || '').trim() || null
  const tag = String(form.get('tag') || '').trim() || null
  const ownerType = String(form.get('owner_type') || '').trim() || null
  const ownerId = String(form.get('owner_id') || '').trim() || null

  const fd = new FormData()
  fd.append('file', file, file.name)
  for (const key of ['folder', 'bucket', 'project_id', 'customer_id', 'asset_id']) {
    const v = form.get(key)
    if (v != null && String(v).trim()) fd.append(key, String(v))
  }

  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  const upstreamJson = await upstream.json().catch(() => ({}))
  if (!upstream.ok) {
    return NextResponse.json({ error: upstreamJson?.error || 'upload_that_bai', upstream: upstreamJson }, { status: upstream.status || 500 })
  }

  let fileUrl = pickFileUrl(upstreamJson)
  let storageFilename = pickFileName(upstreamJson)
  if (!fileUrl) {
    const fileBase = String(process.env.FILE_URL || process.env.UPLOAD_FILE_BASE || 'https://webhook.tidicons.online/api/uploads').trim().replace(/\/+$/, '')
    if (storageFilename) fileUrl = `${fileBase}/${encodeURIComponent(storageFilename)}`
  }
  if (!fileUrl) return NextResponse.json({ error: 'upload_thanh_cong_nhung_khong_co_file_url', upstream: upstreamJson }, { status: 502 })
  if (!storageFilename) storageFilename = pickStorageFilenameFromUrl(fileUrl)
  const uniqueStorageFilename = await ensureUniqueStorageFilename(storageFilename)
  const fileBase = String(process.env.FILE_URL || process.env.UPLOAD_FILE_BASE || 'https://webhook.tidicons.online/api/uploads').trim().replace(/\/+$/, '')
  const normalizedFileUrl = uniqueStorageFilename ? `${fileBase}/${encodeURIComponent(uniqueStorageFilename)}` : fileUrl

  const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() || null : null
  const externalFileId = String(
    upstreamJson?.file_id ||
    upstreamJson?.id ||
    upstreamJson?.data?.file_id ||
    upstreamJson?.data?.id ||
    ''
  ).trim() || null

  const created = await (db as any).fileRecord.create({
    data: {
      storage_provider: 'external_webhook',
      external_file_id: externalFileId,
      storage_filename: uniqueStorageFilename,
      display_name: file.name,
      file_name: file.name,
      file_ext: ext,
      mime_type: file.type || null,
      file_size_bytes: Number.isFinite(file.size) ? BigInt(Math.round(file.size)) : null,
      file_url: normalizedFileUrl,
      thumbnail_url: String(upstreamJson?.thumbnail_url || upstreamJson?.data?.thumbnail_url || '').trim() || null,
      checksum: String(upstreamJson?.checksum || upstreamJson?.data?.checksum || '').trim() || null,
      bucket: String(upstreamJson?.bucket || upstreamJson?.data?.bucket || '').trim() || null,
      folder: String(upstreamJson?.folder || upstreamJson?.data?.folder || form.get('folder') || '').trim() || null,
      purpose,
      tag,
      owner_type: ownerType,
      owner_id: ownerId,
      metadata_json: sanitizeMetadataUrls(upstreamJson),
      uploaded_by: String(session.user.id || '') || null,
    },
  })

  return NextResponse.json({
    data: {
      ...created,
      file_size_bytes: created.file_size_bytes != null ? Number(created.file_size_bytes) : null,
    },
  }, { status: 201 })
}
