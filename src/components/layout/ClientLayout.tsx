'use client'
// Reactive wrapper: adjusts main margin when sidebar toggles
import { useLayout } from './ThemeProvider'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, isMobile } = useLayout()
  const marginLeft = (!isMobile && sidebarOpen) ? 220 : 0

  return (
    <main
      className="main-el"
      style={{
        marginLeft,
        flex: 1,
        paddingTop: 56 + 24,
        paddingBottom: 28,
        paddingLeft: 28,
        paddingRight: 28,
        minHeight: '100vh',
        background: 'var(--bg)',
        transition: 'margin-left .25s cubic-bezier(.4,0,.2,1)',
      }}
    >
      {children}
    </main>
  )
}
