// src/app/(dashboard)/layout.tsx — V2.1
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import SessionProvider from '@/components/layout/SessionProvider'
import ThemeProvider from '@/components/layout/ThemeProvider'
import ClientLayout from '@/components/layout/ClientLayout'
import type { UserRole } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <SessionProvider session={session}>
      <ThemeProvider>
        <div style={{ display:'flex', minHeight:'100vh' }}>
          <Sidebar
            username={session.user.username}
            role={session.user.role as UserRole}
            roleKeys={session.user.role_keys || []}
          />
          <Topbar />
          <ClientLayout>
            {children}
          </ClientLayout>
        </div>
      </ThemeProvider>
    </SessionProvider>
  )
}
