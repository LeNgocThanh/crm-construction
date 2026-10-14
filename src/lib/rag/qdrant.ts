// src/lib/rag/qdrant.ts — Qdrant vector store client

const QDRANT_URL = 'http://100.84.109.121:6333'
const COLLECTION  = process.env.QDRANT_COLLECTION || 'crm_rag'
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL   || 'http://100.84.109.121:11434'
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text'
const VECTOR_DIM  = 768  // nomic-embed-text dimension

// ─── Embedding via Ollama ─────────────────────────────────────────
export async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_BASE}/api/embeddings`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`Embedding failed: ${res.status}`)
  const data = await res.json()
  if (!data.embedding) throw new Error('No embedding returned')
  return data.embedding
}

// ─── Ensure collection exists ─────────────────────────────────────
export async function ensureCollection(): Promise<void> {
  // Check if exists
  const check = await fetch(`${QDRANT_URL}/collections/${COLLECTION}`)
  if (check.ok) return

  // Create collection
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vectors: {
        size:     VECTOR_DIM,
        distance: 'Cosine',
      },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Create collection failed: ${err}`)
  }
  console.log(`[QDRANT] Collection '${COLLECTION}' created`)
}

// ─── Upsert point ─────────────────────────────────────────────────
export async function upsertPoint(opts: {
  id:       string    // UUID from PostgreSQL
  text:     string    // text to embed
  payload:  Record<string, unknown>
}): Promise<void> {
  const vector = await embed(opts.text)
  // Use UUID string ID to avoid hash collision/overwrite between entries.
  const pointId = opts.id

  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      points: [{
        id:      pointId,
        vector,
        payload: { ...opts.payload, pg_id: opts.id },
      }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Upsert failed: ${err}`)
  }
}

// ─── Delete point ─────────────────────────────────────────────────
export async function deletePoint(pgId: string): Promise<void> {
  const numId = uuidToNumId(pgId)
  // Delete both legacy numeric id and new UUID string id.
  await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/delete`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points: [pgId, numId] }),
  })
}

// ─── Search similar ───────────────────────────────────────────────
export interface SearchResult {
  pg_id:    string
  score:    number
  type:     string
  category: string | null
  question: string | null
  answer:   string
  tags:     string[]
}

export interface QdrantPointSnapshot {
  id: string
  payload: Record<string, unknown>
}

export async function searchSimilar(
  query:     string,
  topK:      number  = 5,
  threshold: number  = 0.65,
): Promise<SearchResult[]> {
  const vector = await embed(query)

  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/search`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vector,
      limit:        topK,
      score_threshold: threshold,
      with_payload: true,
    }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Search failed: ${res.status}`)
  const data = await res.json()

  return (data.result || []).map((r: any) => ({
    pg_id:    r.payload?.pg_id    || '',
    score:    r.score,
    type:     r.payload?.type     || 'knowledge',
    category: r.payload?.category || null,
    question: r.payload?.question || null,
    answer:   r.payload?.answer   || '',
    tags:     r.payload?.tags     || [],
  }))
}

export async function scrollPoints(opts?: {
  limit?: number
}): Promise<QdrantPointSnapshot[]> {
  const all: QdrantPointSnapshot[] = []
  const max = Math.max(1, Number(opts?.limit || 20000))
  let offset: unknown = null

  while (all.length < max) {
    const take = Math.min(256, max - all.length)
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        with_payload: true,
        with_vector: false,
        limit: take,
        ...(offset !== null ? { offset } : {}),
      }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) throw new Error(`Scroll failed: ${res.status}`)
    const data = await res.json()
    const pts = Array.isArray(data?.result?.points) ? data.result.points : []
    for (const p of pts) {
      all.push({
        id: String(p?.id ?? ''),
        payload: (p?.payload && typeof p.payload === 'object') ? p.payload : {},
      })
    }
    offset = data?.result?.next_page_offset ?? null
    if (!offset || pts.length === 0) break
  }
  return all
}

// ─── Helper: UUID → stable numeric ID ────────────────────────────
// Qdrant supports u64 IDs — convert UUID hex to number
function uuidToNumId(uuid: string): number {
  const hex = uuid.replace(/-/g, '').slice(0, 13)  // 52 bits fits in JS number
  return parseInt(hex, 16) % Number.MAX_SAFE_INTEGER
}

// ─── Sync all active entries from DB to Qdrant ───────────────────
export async function syncAllEntriesToQdrant(): Promise<{
  synced: number
  errors: number
  error_items: Array<{ id: string; message: string }>
}> {
  const { db } = await import('@/lib/db')
  await ensureCollection()

  const entries = await db.ragEntry.findMany({ where: { is_active: true } })
  let synced = 0, errors = 0
  const errorItems: Array<{ id: string; message: string }> = []

  for (const entry of entries) {
    try {
      const embedText = buildEmbedText(entry)
      // Best effort cleanup legacy numeric point id (old scheme) before upsert UUID id.
      const legacyNumId = uuidToNumId(entry.id)
      await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: [legacyNumId] }),
      }).catch(() => {})
      await upsertPoint({
        id:      entry.id,
        text:    embedText,
        payload: {
          type:     entry.type,
          category: entry.category,
          question: entry.question,
          answer:   entry.answer,
          tags:     entry.tags,
        },
      })
      // Update qdrant_id in DB
      await db.ragEntry.update({
        where: { id: entry.id },
        data:  { qdrant_id: entry.id },
      })
      synced++
    } catch (err: any) {
      console.error(`[QDRANT] Failed to sync ${entry.id}:`, err)
      errors++
      errorItems.push({
        id: entry.id,
        message: String(err?.message || 'sync_failed'),
      })
    }
  }
  return { synced, errors, error_items: errorItems.slice(0, 30) }
}

// Text to embed — mỗi type embed khác nhau để tối ưu vector search
export function buildEmbedText(entry: {
  type: string; question?: string | null
  answer: string; tags?: string[]; category?: string | null
}): string {
  const cat  = entry.category ? `[${entry.category}] ` : ''
  const tags = entry.tags?.length ? `\nTừ khóa: ${entry.tags.join(', ')}` : ''

  switch (entry.type) {
    case 'qa':
      // Embed câu hỏi + trả lời — vector gần với câu hỏi khách nhất
      return [
        entry.question ? `Câu hỏi: ${entry.question}` : '',
        `Trả lời: ${entry.answer}`,
        tags,
      ].filter(Boolean).join('\n')

    case 'price':
      // Prefix giá/chi phí — match khi khách hỏi về giá
      return `${cat}Bảng giá và chi phí:\n${entry.answer}${tags}`

    case 'process':
      // Prefix quy trình — match khi khách hỏi "làm thế nào", "các bước"
      return `${cat}Quy trình thực hiện:\n${entry.answer}${tags}`

    case 'policy':
      // Prefix chính sách — match khi khách hỏi "bảo hành", "điều khoản"
      return `${cat}Chính sách và cam kết:\n${entry.answer}${tags}`

    case 'knowledge':
    default:
      // Kiến thức chung — embed trực tiếp không prefix
      return `${cat}${entry.answer}${tags}`
  }
}
