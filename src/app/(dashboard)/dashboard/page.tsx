// src/app/(dashboard)/dashboard/page.tsx
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import DashboardV11 from '@/components/dashboard/DashboardV11'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  return (
    <DashboardV11
      username={session.user.username}
      role={session.user.role}
      roleKeys={session.user.role_keys || []}
    />
  )
}
