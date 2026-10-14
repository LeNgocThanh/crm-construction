import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

function ser(row: any) {
  return {
    ...row,
    file_size_bytes: row?.file_size_bytes != null ? Number(row.file_size_bytes) : null,
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = new URL(req.url).searchParams
  const q = String(sp.get('q') || '').trim()
  const purpose = String(sp.get('purpose') || '').trim()
  const ownerType = String(sp.get('owner_type') || '').trim()
  const ownerId = String(sp.get('owner_id') || '').trim()
  const activeOnly = String(sp.get('active_only') || 'true') !== 'false'
  const limitRaw = Number(sp.get('limit') || 50)
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.round(limitRaw))) : 50

  const where: any = {}
  if (activeOnly) where.is_active = true
  if (purpose) where.purpose = purpose
  if (ownerType) where.owner_type = ownerType
  if (ownerId) where.owner_id = ownerId
  if (q) {
    where.OR = [
      { display_name: { contains: q, mode: 'insensitive' } },
      { storage_filename: { contains: q, mode: 'insensitive' } },
      { file_name: { contains: q, mode: 'insensitive' } },
      { tag: { contains: q, mode: 'insensitive' } },
      { external_file_id: { contains: q, mode: 'insensitive' } },
    ]
  }

  const rows = await (db as any).fileRecord.findMany({
    where,
    orderBy: [{ uploaded_at: 'desc' }],
    take: limit,
    include: { uploader: { select: { id: true, username: true } } },
  })
  return NextResponse.json({ data: rows.map(ser) })
}
