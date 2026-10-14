'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useLayout } from './ThemeProvider'
import type { UserRole } from '@/types'
import { getInitials } from '@/lib/utils'

interface SidebarProps {
  username: string
  role: UserRole
  roleKeys?: string[]
  groupName?: string
}

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
  roles: UserRole[]
}

type NavGroup = {
  key: string
  title: string
  items: NavItem[]
}

// SVG Icon components
const Icons = {
  dashboard: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  pipeline: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  customers: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  conversations: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  logs: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.58 3.38 2 2 0 0 1 3.55 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.51a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16z" />
    </svg>
  ),
  projects: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  estimate: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  extract: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  generate: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  ),
  analytics: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  kpi: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  reports: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  users: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  bot: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  ),
  webhook: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  rag: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
  settings: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
    </svg>
  ),
  logout: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  chevronLeft: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'crm',
    title: 'CRM',
    items: [
      { href: '/dashboard', label: 'Tổng quan', icon: Icons.dashboard, roles: ['admin', 'manager', 'sales'] },
      { href: '/pipeline', label: 'Pipeline', icon: Icons.pipeline, roles: ['admin', 'manager', 'sales'] },
      { href: '/customers', label: 'Khách hàng', icon: Icons.customers, roles: ['admin', 'manager', 'sales'] },
      { href: '/customers/workboard', label: 'Workboard CSKH', icon: Icons.pipeline, roles: ['admin', 'manager', 'sales'] },
      { href: '/customers/timeline-by-user', label: 'Timeline theo User', icon: Icons.logs, roles: ['admin', 'manager', 'sales'] },
      { href: '/actions', label: 'Actions', icon: Icons.pipeline, roles: ['admin', 'manager', 'sales'] },
      { href: '/conversations', label: 'Conversations', icon: Icons.conversations, roles: ['admin', 'manager', 'sales'] },
      { href: '/logs', label: 'Nhật ký gọi', icon: Icons.logs, roles: ['admin', 'manager', 'sales'] },
    ],
  },
  {
    key: 'projects',
    title: 'Dự Án',
    items: [
      { href: '/projects', label: 'Dự án XD', icon: Icons.projects, roles: ['admin', 'manager', 'sales'] },
      { href: '/subcontractors', label: 'Thầu phụ', icon: Icons.users, roles: ['admin', 'manager'] },
      { href: '/projects/dashboard', label: 'Dashboard dự án', icon: Icons.analytics, roles: ['admin', 'manager', 'sales'] },
      { href: '/projects/diary-manager', label: 'Giám sát nhật ký', icon: Icons.analytics, roles: ['admin', 'manager', 'sales'] },
      { href: '/projects/reports', label: 'Báo cáo dự án', icon: Icons.reports, roles: ['admin', 'manager', 'sales'] },
      { href: '/settings/project-statuses', label: 'Trạng thái dự án', icon: Icons.settings, roles: ['admin', 'manager'] },
      { href: '/settings/project-status-transition-rules', label: 'Rule chuyển trạng thái', icon: Icons.settings, roles: ['admin', 'manager'] },
      { href: '/settings/project-milestone-definitions', label: 'Mốc gốc dự án', icon: Icons.settings, roles: ['admin', 'manager'] },
      { href: '/settings/project-milestone-rules', label: 'Rule cảnh báo mốc', icon: Icons.settings, roles: ['admin', 'manager'] },
      { href: '/settings/project-milestone-templates', label: 'Mẫu tiến độ dự án', icon: Icons.settings, roles: ['admin', 'manager', 'sales'] },
      { href: '/settings/project-milestone-statuses', label: 'Mốc dự án (status)', icon: Icons.settings, roles: ['admin', 'manager'] },
    ],
  },
  {
    key: 'labor',
    title: 'Nhân Công',
    items: [
      { href: '/labor', label: 'Bảng điều khiển nhân công', icon: Icons.users, roles: ['admin', 'manager', 'sales'] },
      { href: '/labor/assignments', label: 'Phân công khoán việc', icon: Icons.pipeline, roles: ['admin', 'manager', 'sales'] },
      { href: '/labor/attendance', label: 'Chấm công', icon: Icons.logs, roles: ['admin', 'manager', 'sales'] },
      { href: '/labor/payments', label: 'Thanh toán công', icon: Icons.logs, roles: ['admin', 'manager', 'sales'] },
      { href: '/labor/reports', label: 'Báo cáo chấm công', icon: Icons.reports, roles: ['admin', 'manager', 'sales'] },
    ],
  },
  {
    key: 'accounting',
    title: 'Kế Toán',
    items: [
      { href: '/accounting/dashboard', label: 'Dashboard tài chính', icon: Icons.dashboard, roles: ['admin', 'manager'] },
      { href: '/accounting/labor-payroll', label: 'Báo cáo công nhân công', icon: Icons.reports, roles: ['admin', 'manager'] },
    ],
  },
  {
    key: 'assets',
    title: 'Tài Sản',
    items: [
      { href: '/assets', label: 'Danh mục tài sản', icon: Icons.projects, roles: ['admin', 'manager', 'sales'] },
      { href: '/assets/operations', label: 'Vận hành tài sản', icon: Icons.logs, roles: ['admin', 'manager', 'sales'] },
      { href: '/assets/reports', label: 'Báo cáo tài sản', icon: Icons.reports, roles: ['admin', 'manager', 'sales'] },
      { href: '/settings/asset-types', label: 'Loại tài sản', icon: Icons.settings, roles: ['admin', 'manager'] },
      { href: '/settings/asset-action-types', label: 'Asset Actions', icon: Icons.settings, roles: ['admin', 'manager'] },
    ],
  },
  {
    key: 'inventory',
    title: 'Kho',
    items: [
      { href: '/inventory', label: 'Tổng quan kho', icon: Icons.dashboard, roles: ['admin', 'manager', 'sales'] },
      { href: '/inventory/purchases', label: 'Mua hàng kho', icon: Icons.logs, roles: ['admin', 'manager'] },
      { href: '/inventory/transactions', label: 'Phiếu kho', icon: Icons.logs, roles: ['admin', 'manager'] },
      { href: '/inventory/stocks', label: 'Tồn kho', icon: Icons.reports, roles: ['admin', 'manager', 'sales'] },
      { href: '/inventory/audits', label: 'Kiểm kê kho', icon: Icons.logs, roles: ['admin', 'manager'] },
      { href: '/inventory/prices', label: 'Biến động giá', icon: Icons.reports, roles: ['admin', 'manager', 'sales'] },
      { href: '/settings/warehouses', label: 'Cấu hình kho', icon: Icons.settings, roles: ['admin', 'manager'] },
      { href: '/settings/suppliers-pricing', label: 'NCC & bảng giá', icon: Icons.settings, roles: ['admin', 'manager'] },
    ],
  },
  {
    key: 'estimate',
    title: 'Dự Toán',
    items: [
      { href: '/estimates', label: 'Khái toán nhanh', icon: Icons.estimate, roles: ['admin', 'manager', 'sales'] },
      { href: '/estimates/extract', label: 'Bóc tách dự toán', icon: Icons.extract, roles: ['admin', 'manager', 'sales'] },

      { href: '/estimates/assemblies', label: 'Bóc tách theo text', icon: Icons.extract, roles: ['admin', 'manager', 'sales'] },
      { href: '/estimates/assemblies/designer-2d', label: 'Bóc tách 2D', icon: Icons.projects, roles: ['admin', 'manager', 'sales'] },
      { href: '/estimates/assemblies/designer-3d', label: 'Bóc tách 3D', icon: Icons.projects, roles: ['admin', 'manager', 'sales'] },
      { href: '/estimates/assemblies/result-v2', label: 'Dự toán theo block', icon: Icons.generate, roles: ['admin', 'manager', 'sales'] },

      { href: '/settings/estimate-knowledge', label: 'Dữ liệu gốc', icon: Icons.extract, roles: ['admin', 'manager'] },
      { href: '/settings/assembly-presets', label: 'Preset khối 2D/3D', icon: Icons.settings, roles: ['admin', 'manager'] },
      { href: '/settings/assembly-template-bundles', label: 'Rule block -> template', icon: Icons.settings, roles: ['admin', 'manager'] },
      { href: '/settings/estimate-taxonomies', label: 'Danh mục khái toán', icon: Icons.settings, roles: ['admin', 'manager'] },
      { href: '/settings/estimate-context-profiles', label: 'Profile hệ số bối cảnh', icon: Icons.settings, roles: ['admin', 'manager'] },
      { href: '/settings/estimate-coefficients', label: 'Hệ số tính', icon: Icons.settings, roles: ['admin', 'manager'] },
      { href: '/settings/estimate-v2', label: 'Dự toán sơ bộ Admin', icon: Icons.generate, roles: ['admin', 'manager'] },
    ],
  },
  {
    key: 'report',
    title: 'Báo Cáo',
    items: [
      { href: '/analytics', label: 'Analytics', icon: Icons.analytics, roles: ['admin', 'manager'] },
      { href: '/kpi', label: 'KPI Nhân viên', icon: Icons.kpi, roles: ['admin', 'manager'] },
      { href: '/reports', label: 'Báo cáo', icon: Icons.reports, roles: ['admin', 'manager'] },
    ],
  },
  {
    key: 'user-admin',
    title: 'Quản Trị User',
    items: [
      { href: '/users', label: 'Quản lý Users', icon: Icons.users, roles: ['admin'] },
      { href: '/settings/groups', label: 'Nhóm người dùng', icon: Icons.settings, roles: ['admin', 'manager'] },
      { href: '/settings/organization', label: 'Tổ chức & phòng ban', icon: Icons.settings, roles: ['admin', 'manager'] },
      { href: '/settings/access-control', label: 'Vai trò & quyền', icon: Icons.settings, roles: ['admin', 'manager'] },
      { href: '/settings/resource-access-grants', label: 'Cấp quyền theo resource', icon: Icons.settings, roles: ['admin', 'manager'] },
    ],
  },
  {
    key: 'system-admin',
    title: 'Quản Trị Hệ Thống',
    items: [
      { href: '/settings/chatbot', label: 'Cài đặt Bot', icon: Icons.bot, roles: ['admin', 'manager'] },
      { href: '/settings/setup', label: 'Setup Webhook', icon: Icons.webhook, roles: ['admin', 'manager'] },
      { href: '/settings/webhook-logs', label: 'Webhook Logs', icon: Icons.logs, roles: ['admin', 'manager'] },
      { href: '/settings/rag', label: 'RAG Knowledge', icon: Icons.rag, roles: ['admin', 'manager'] },
      
      { href: '/settings/sla-policies', label: 'SLA Policies', icon: Icons.settings, roles: ['admin', 'manager'] },
      { href: '/settings/print-brand', label: 'Mẫu in thương hiệu', icon: Icons.settings, roles: ['admin', 'manager'] },
      { href: '/settings/sales-brief-heat', label: 'Độ nóng brief sales', icon: Icons.settings, roles: ['admin', 'manager'] },
      { href: '/settings/units', label: 'Đơn vị tính', icon: Icons.settings, roles: ['admin', 'manager'] },
     
      { href: '/settings/regions', label: 'Vùng địa lý', icon: Icons.settings, roles: ['admin', 'manager'] },
    ],
  },
]

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  sales: 'Sales',
}

const ROLE_COLOR: Record<UserRole, { bg: string; text: string; border: string }> = {
  admin: { bg: 'rgba(239,68,68,0.12)', text: '#F87171', border: 'rgba(239,68,68,0.3)' },
  manager: { bg: 'rgba(249,115,22,0.12)', text: '#FB923C', border: 'rgba(249,115,22,0.3)' },
  sales: { bg: 'rgba(96,165,250,0.12)', text: '#60A5FA', border: 'rgba(96,165,250,0.3)' },
}

export default function Sidebar({ username, role, roleKeys, groupName }: SidebarProps) {
  const pathname = usePathname()
  const { sidebarOpen, toggleSidebar, closeSidebar, isMobile } = useLayout()
  const effectiveRoleKeys = (roleKeys && roleKeys.length ? roleKeys : [role]) as UserRole[]

  const exactOnlyHrefs = new Set(['/dashboard', '/estimates', '/estimates/assemblies'])
  const isActive = (href: string) => {
    if (exactOnlyHrefs.has(href)) return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  }
  const isOpen = sidebarOpen
  const roleStyle = ROLE_COLOR[role]

  return (
    <>
      <style>{`
        .sidebar-inner { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.06) transparent; }
        .sidebar-inner::-webkit-scrollbar { width: 3px; }
        .sidebar-inner::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }
        .nav-link { transition: background 0.15s, color 0.15s, border-color 0.15s; }
        .nav-link:hover:not(.active) { background: rgba(255,255,255,0.04) !important; color: rgba(255,255,255,0.85) !important; }
        .nav-link .icon-wrap { transition: transform 0.15s; }
        .nav-link:hover .icon-wrap { transform: translateX(1px); }
        .signout-btn:hover { background: rgba(255,255,255,0.06) !important; color: #F87171 !important; }
        .toggle-btn:hover { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.15) !important; }
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .sidebar-group { animation: fadeSlideIn 0.3s ease both; }
      `}</style>

      {isMobile && isOpen && (
        <div
          onClick={closeSidebar}
          style={{
            position: 'fixed', inset: 0, zIndex: 199,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
          }}
        />
      )}

      <aside
        className="sidebar-el"
        style={{
          width: isOpen ? 232 : 0,
          minWidth: isOpen ? 232 : 0,
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          display: 'flex',
          flexDirection: 'column',
          background: '#0f1117',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          zIndex: isMobile ? 200 : 40,
          overflow: isOpen ? 'visible' : 'hidden',
          transition: 'width .25s cubic-bezier(.4,0,.2,1), min-width .25s cubic-bezier(.4,0,.2,1)',
        }}
      >
        <div style={{ width: 232, display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* â”€â”€ Header â”€â”€ */}
          <div style={{
            padding: '16px 16px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Logo mark */}
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 0 1px rgba(99,102,241,0.4), 0 4px 12px rgba(99,102,241,0.3)',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.2px' }}>
                  Construction
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', fontWeight: 500 }}>
                  CRM Platform
                </div>
              </div>
            </div>

            <button
              className="toggle-btn"
              onClick={toggleSidebar}
              title="Đóng sidebar"
              style={{
                width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.3)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              {Icons.chevronLeft}
            </button>
          </div>

          {/* â”€â”€ Nav â”€â”€ */}
          <nav
            className="sidebar-inner"
            style={{ flex: 1, padding: '10px 8px', overflowY: 'auto', overflowX: 'hidden' }}
          >
            {NAV_GROUPS.map((group, gi) => {
              const items = group.items.filter((x) => x.roles.some((itemRole) => effectiveRoleKeys.includes(itemRole)))
              if (!items.length) return null
              return (
                <div
                  key={group.key}
                  className="sidebar-group"
                  style={{ marginBottom: 16, animationDelay: `${gi * 0.05}s` }}
                >
                  {/* Group label */}
                  <div style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.2)',
                    padding: '0 8px 6px',
                  }}>
                    {group.title}
                  </div>

                  {items.map((item) => {
                    const active = isActive(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => isMobile && closeSidebar()}
                        className={`nav-link${active ? ' active' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                          padding: '7px 9px',
                          borderRadius: 7,
                          marginBottom: 1,
                          textDecoration: 'none',
                          background: active
                            ? 'rgba(99,102,241,0.15)'
                            : 'transparent',
                          color: active
                            ? '#a5b4fc'
                            : 'rgba(255,255,255,0.45)',
                          fontWeight: active ? 600 : 400,
                          fontSize: 12.5,
                          position: 'relative',
                          borderLeft: active
                            ? '2px solid #6366f1'
                            : '2px solid transparent',
                        }}
                      >
                        <span
                          className="icon-wrap"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            opacity: active ? 1 : 0.6,
                            color: active ? '#818cf8' : 'inherit',
                          }}
                        >
                          {item.icon}
                        </span>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.label}
                        </span>
                        {active && (
                          <span style={{
                            marginLeft: 'auto',
                            width: 4, height: 4, borderRadius: '50%',
                            background: '#6366f1', flexShrink: 0,
                            boxShadow: '0 0 6px #6366f1',
                          }} />
                        )}
                      </Link>
                    )
                  })}
                </div>
              )
            })}
          </nav>

          {/* â”€â”€ User card â”€â”€ */}
          <div style={{
            padding: '10px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 10,
              padding: '10px 11px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
                {/* Avatar */}
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: roleStyle.bg,
                  border: `1px solid ${roleStyle.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: roleStyle.text,
                  letterSpacing: '0.05em',
                }}>
                  {getInitials(username)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Link
                    href="/my-profile"
                    style={{
                      display: 'block',
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: '#fff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.3,
                      textDecoration: 'none',
                    }}
                  >
                    {username}
                  </Link>
                  {groupName && (
                    <div style={{
                      fontSize: 10.5, color: 'rgba(255,255,255,0.3)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      lineHeight: 1.3, marginTop: 1,
                    }}>
                      {groupName}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: 9.5, padding: '3px 8px', borderRadius: 5,
                  letterSpacing: '0.08em', fontWeight: 700,
                  background: roleStyle.bg, color: roleStyle.text,
                  border: `1px solid ${roleStyle.border}`,
                  textTransform: 'uppercase',
                }}>
                  {ROLE_LABEL[role]}
                </span>

                <button
                  className="signout-btn"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  title="Đăng xuất"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.25)',
                    cursor: 'pointer',
                    padding: '4px 6px',
                    borderRadius: 5,
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 10, fontWeight: 500,
                    transition: 'all 0.15s',
                  }}
                >
                  {Icons.logout}
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </aside>
    </>
  )
}




