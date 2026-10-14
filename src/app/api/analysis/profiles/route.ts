import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireRoles } from '@/lib/authz'
import { db } from '@/lib/db'
import { ensureAnalysisProfiles } from '@/lib/analysis/store'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureAnalysisProfiles()

  const profiles = await db.analysisProfile.findMany({
    orderBy: { created_at: 'asc' },
  })

  return NextResponse.json({ data: profiles })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRoles(['admin'])
  if (auth.error) return auth.error

  const body = await req.json()
  const { key, is_active, required_fields, prompt_template, output_schema, description, name } = body || {}
  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'Thieu key' }, { status: 400 })
  }

  const profile = await db.analysisProfile.update({
    where: { key },
    data: {
      ...(typeof is_active === 'boolean' ? { is_active } : {}),
      ...(Array.isArray(required_fields) ? { required_fields: required_fields.map(String) } : {}),
      ...(prompt_template !== undefined ? { prompt_template: prompt_template || null } : {}),
      ...(output_schema !== undefined ? { output_schema: output_schema || null } : {}),
      ...(description !== undefined ? { description: description || null } : {}),
      ...(name !== undefined ? { name: String(name) } : {}),
    },
  })

  return NextResponse.json({ data: profile })
}

