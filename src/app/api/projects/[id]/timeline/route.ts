import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requirePermission(PERMISSIONS.projectsRead)
    if (auth.error) return auth.error

    const projectId = String(params.id || '').trim()
    if (!projectId) return NextResponse.json({ error: 'project_id_required' }, { status: 400 })
    const sp = new URL(_req.url).searchParams
    const milestoneId = String(sp.get('milestone_id') || '').trim()

    const rows = await db.projectTimelineEvent.findMany({
      where: { project_id: projectId, ...(milestoneId ? { milestone_id: milestoneId } : {}) },
      orderBy: [{ happened_at: 'desc' }, { created_at: 'desc' }],
      take: 200,
      include: {
        actor: { select: { id: true, username: true } },
        milestone: { select: { id: true, milestone_name: true } },
      },
    })

    return NextResponse.json({ data: rows })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'internal_error' }, { status: 500 })
  }
}
