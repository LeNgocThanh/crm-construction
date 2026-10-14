// src/app/api/rag/search/route.ts — Test RAG search
import { NextRequest, NextResponse } from 'next/server'
import { searchSimilar } from '@/lib/rag/qdrant'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.settingsRead)
  if (auth.error) return auth.error

  const q         = new URL(req.url).searchParams.get('q') || ''
  const threshold = parseFloat(new URL(req.url).searchParams.get('threshold') || '0.60')

  if (!q) return NextResponse.json({ error: 'Thiếu query' }, { status: 400 })

  try {
    const results = await searchSimilar(q, 5, threshold)
    return NextResponse.json({ data: results, query: q })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
