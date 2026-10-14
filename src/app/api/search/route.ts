// src/app/api/search/route.ts — V2.0 Prisma
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hasPermission, requireInternalUser } from '@/lib/authz'
import { PERMISSIONS } from '@/lib/permissions'
import { BASIC_USER_WITH_ROLE_SELECT, mapBasicUserWithRole } from '@/lib/user-profiles'

export async function GET(req: NextRequest) {
  const auth = await requireInternalUser()
  if (auth.error || !auth.ctx) return auth.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ customers: [], projects: [], users: [] })

  const canReadCustomers = hasPermission(auth.ctx, PERMISSIONS.customersRead)
  const canReadProjects = hasPermission(auth.ctx, PERMISSIONS.projectsRead)
  const canReadUsers = hasPermission(auth.ctx, PERMISSIONS.usersRead)

  const [customers, projects, users] = await Promise.all([
    canReadCustomers ? db.customer.findMany({
      where: { OR: [
        { phone_number: { contains: q } },
        { full_name:    { contains: q, mode: 'insensitive' } },
      ]},
      take: 5,
      select: { id: true, phone_number: true, full_name: true, status: true, potential_score: true },
    }) : Promise.resolve([]),
    canReadProjects ? db.constructionProject.findMany({
      where: { address: { contains: q, mode: 'insensitive' } },
      take: 4,
      include: { customer: { select: { phone_number: true, full_name: true } } },
    }) : Promise.resolve([]),
    canReadUsers ? db.user.findMany({
      where: { OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { full_name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone:    { contains: q } },
      ]},
      take: 3,
      select: BASIC_USER_WITH_ROLE_SELECT,
    }) : Promise.resolve([]),
  ])

  return NextResponse.json({ customers, projects, users: users.map(mapBasicUserWithRole) })
}
