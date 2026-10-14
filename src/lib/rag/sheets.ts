// src/lib/rag/sheets.ts — Google Sheets sync for RAG entries
// Docs: https://developers.google.com/sheets/api/quickstart/nodejs
// Auth: Service Account JSON (không cần OAuth user flow)

const SPREADSHEET_ID  = process.env.GOOGLE_SHEET_ID       || ''
const SHEET_NAME      = process.env.GOOGLE_SHEET_NAME     || 'RAG Knowledge Base'
const SERVICE_EMAIL   = process.env.GOOGLE_SERVICE_EMAIL  || ''
const SERVICE_KEY     = (process.env.GOOGLE_SERVICE_KEY   || '').replace(/\\n/g, '\n')

// Header row definition — phải khớp với order bên dưới
export const SHEET_HEADERS = [
  'ID', 'Loại', 'Danh mục', 'Câu hỏi', 'Câu trả lời', 'Tags', 'Chất lượng', 'Trạng thái', 'Người tạo', 'Ngày tạo',
]

// ─── Get Google auth token (JWT service account) ──────────────────
async function getAccessToken(): Promise<string> {
  if (!SERVICE_EMAIL || !SERVICE_KEY) {
    throw new Error('Google Service Account chưa cấu hình (GOOGLE_SERVICE_EMAIL, GOOGLE_SERVICE_KEY)')
  }

  // Import jose for JWT (available in Node 18+)
  // We'll use native crypto instead to avoid extra deps
  const now   = Math.floor(Date.now() / 1000)
  const claim = {
    iss:   SERVICE_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  }

  // Build JWT using Web Crypto API (available in Next.js edge/Node)
  const header  = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  const payload = btoa(JSON.stringify(claim)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  const sigInput = `${header}.${payload}`

  // Import private key
  const keyData = SERVICE_KEY
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const keyBuffer = Buffer.from(keyData, 'base64')

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'pkcs8', keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )
  const sigBytes = await globalThis.crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    Buffer.from(sigInput)
  )
  const sig = Buffer.from(sigBytes).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  const jwt = `${sigInput}.${sig}`

  // Exchange for access token
  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Google auth failed: ${JSON.stringify(data)}`)
  return data.access_token
}

// ─── Ensure sheet has header row ──────────────────────────────────
export async function ensureSheetHeader(): Promise<void> {
  if (!SPREADSHEET_ID) return
  try {
    const token = await getAccessToken()
    // Check if header exists
    const check = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A1:J1`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await check.json()
    if (data.values?.[0]?.length >= SHEET_HEADERS.length) return  // already has header

    // Write header
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A1:J1?valueInputOption=RAW`,
      {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ values: [SHEET_HEADERS] }),
      }
    )
    console.log('[SHEETS] Header row created')
  } catch (err) {
    console.warn('[SHEETS] ensureSheetHeader failed (non-fatal):', err)
  }
}

// ─── Append entry to sheet → returns row number ───────────────────
export async function appendEntryToSheet(entry: {
  id: string; type: string; category?: string | null;
  question?: string | null; answer: string; tags?: string[];
  quality?: number; created_by_username?: string;
}): Promise<number | null> {
  if (!SPREADSHEET_ID) {
    console.warn('[SHEETS] GOOGLE_SHEET_ID not set — skipping')
    return null
  }
  try {
    const token = await getAccessToken()
    const row = [
      entry.id,
      TYPE_LABELS[entry.type] || entry.type,
      entry.category || '',
      entry.question || '',
      entry.answer,
      (entry.tags || []).join(', '),
      entry.quality?.toString() || '5',
      'Hoạt động',
      entry.created_by_username || '',
      new Date().toLocaleDateString('vi-VN'),
    ]
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A:J:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ values: [row] }),
      }
    )
    const data = await res.json()
    // Extract row number from updatedRange like "RAG Knowledge Base!A5:J5"
    const range = data.updates?.updatedRange || ''
    const m     = range.match(/!A(\d+)/)
    return m ? parseInt(m[1]) : null
  } catch (err) {
    console.warn('[SHEETS] appendEntry failed (non-fatal):', err)
    return null
  }
}

// ─── Update row status (khi disable/delete) ───────────────────────
export async function updateSheetRow(rowNum: number, status: 'Hoạt động' | 'Đã xóa'): Promise<void> {
  if (!SPREADSHEET_ID || !rowNum) return
  try {
    const token = await getAccessToken()
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!H${rowNum}?valueInputOption=RAW`,
      {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ values: [[status]] }),
      }
    )
  } catch (err) {
    console.warn('[SHEETS] updateSheetRow failed (non-fatal):', err)
  }
}

export const TYPE_LABELS: Record<string, string> = {
  qa:        'Hỏi - Đáp',
  knowledge: 'Kiến thức',
  price:     'Bảng giá',
  process:   'Quy trình',
  policy:    'Chính sách',
}
