'use client'
// src/components/layout/ThemeProvider.tsx
// Quản lý: theme (dark/balance/light) + sidebar open/close
// Lưu vào localStorage, apply vào <html data-theme="">

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'dark' | 'balance' | 'light'

interface LayoutCtx {
  theme:          Theme
  setTheme:       (t: Theme) => void
  sidebarOpen:    boolean
  toggleSidebar:  () => void
  closeSidebar:   () => void
  isMobile:       boolean
}

const Ctx = createContext<LayoutCtx>({
  theme: 'dark', setTheme: () => {},
  sidebarOpen: true, toggleSidebar: () => {}, closeSidebar: () => {},
  isMobile: false,
})

export function useLayout() { return useContext(Ctx) }

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,       setThemeState] = useState<Theme>('dark')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile,    setIsMobile]   = useState(false)
  const [mounted,     setMounted]    = useState(false)

  // Init from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('crm-theme') as Theme | null
    if (saved && ['dark', 'balance', 'light'].includes(saved)) {
      setThemeState(saved)
      document.documentElement.setAttribute('data-theme', saved)
    }

    const checkMobile = () => {
      const mobile = window.innerWidth < 769
      setIsMobile(mobile)
      if (mobile) setSidebarOpen(false)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    setMounted(true)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Apply theme to <html>
  useEffect(() => {
    if (!mounted) return
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('crm-theme', theme)
  }, [theme, mounted])

  // Apply sidebar state to <body> class
  useEffect(() => {
    if (!mounted) return
    if (isMobile) {
      // Mobile: dùng class trên sidebar element trực tiếp
      document.body.classList.remove('sidebar-closed')
    } else {
      document.body.classList.toggle('sidebar-closed', !sidebarOpen)
    }
  }, [sidebarOpen, isMobile, mounted])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const toggleSidebar = useCallback(() => setSidebarOpen(o => !o), [])
  const closeSidebar  = useCallback(() => setSidebarOpen(false), [])

  return (
    <Ctx.Provider value={{ theme, setTheme, sidebarOpen, toggleSidebar, closeSidebar, isMobile }}>
      {children}
    </Ctx.Provider>
  )
}
