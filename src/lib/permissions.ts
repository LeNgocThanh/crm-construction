import type { UserRole } from '@/types'

export const PERMISSIONS = {
  usersRead: 'users.read',
  usersManage: 'users.manage',
  settingsRead: 'settings.read',
  settingsManage: 'settings.manage',
  customersRead: 'customers.read',
  customersWrite: 'customers.write',
  customersManage: 'customers.manage',
  projectsRead: 'projects.read',
  projectsWrite: 'projects.write',
  projectsManage: 'projects.manage',
  inventoryRead: 'inventory.read',
  inventoryWrite: 'inventory.write',
  inventoryManage: 'inventory.manage',
  laborRead: 'labor.read',
  laborWrite: 'labor.write',
  laborManage: 'labor.manage',
  assetsRead: 'assets.read',
  assetsWrite: 'assets.write',
  assetsManage: 'assets.manage',
  conversationsRead: 'conversations.read',
  conversationsWrite: 'conversations.write',
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export type AccessModuleSeed = {
  module_key: string
  module_name: string
  description?: string
  sort_order: number
}

export type AccessResourceSeed = {
  resource_key: string
  resource_name: string
  module_key: string
  description?: string
  sort_order: number
}

export type AccessPermissionSeed = {
  permission_key: PermissionKey
  permission_name: string
  module_key: string
  resource_key?: string
  action_key: string
  description?: string
  sort_order: number
}

export type AccessRoleSeed = {
  role_key: string
  role_name: string
  description?: string
  sort_order: number
}

export const ROLE_PERMISSION_MAP: Record<UserRole, PermissionKey[]> = {
  admin: [
    PERMISSIONS.usersRead,
    PERMISSIONS.usersManage,
    PERMISSIONS.settingsRead,
    PERMISSIONS.settingsManage,
    PERMISSIONS.customersRead,
    PERMISSIONS.customersWrite,
    PERMISSIONS.customersManage,
    PERMISSIONS.projectsRead,
    PERMISSIONS.projectsWrite,
    PERMISSIONS.projectsManage,
    PERMISSIONS.inventoryRead,
    PERMISSIONS.inventoryWrite,
    PERMISSIONS.inventoryManage,
    PERMISSIONS.laborRead,
    PERMISSIONS.laborWrite,
    PERMISSIONS.laborManage,
    PERMISSIONS.assetsRead,
    PERMISSIONS.assetsWrite,
    PERMISSIONS.assetsManage,
    PERMISSIONS.conversationsRead,
    PERMISSIONS.conversationsWrite,
  ],
  manager: [
    PERMISSIONS.usersRead,
    PERMISSIONS.settingsRead,
    PERMISSIONS.settingsManage,
    PERMISSIONS.customersRead,
    PERMISSIONS.customersWrite,
    PERMISSIONS.customersManage,
    PERMISSIONS.projectsRead,
    PERMISSIONS.projectsWrite,
    PERMISSIONS.projectsManage,
    PERMISSIONS.inventoryRead,
    PERMISSIONS.inventoryWrite,
    PERMISSIONS.inventoryManage,
    PERMISSIONS.laborRead,
    PERMISSIONS.laborWrite,
    PERMISSIONS.laborManage,
    PERMISSIONS.assetsRead,
    PERMISSIONS.assetsWrite,
    PERMISSIONS.assetsManage,
    PERMISSIONS.conversationsRead,
    PERMISSIONS.conversationsWrite,
  ],
  sales: [
    PERMISSIONS.customersRead,
    PERMISSIONS.customersWrite,
    PERMISSIONS.projectsRead,
    PERMISSIONS.projectsWrite,
    PERMISSIONS.inventoryRead,
    PERMISSIONS.laborRead,
    PERMISSIONS.laborWrite,
    PERMISSIONS.assetsRead,
    PERMISSIONS.assetsWrite,
    PERMISSIONS.conversationsRead,
    PERMISSIONS.conversationsWrite,
  ],
}

export const ACCESS_MODULE_SEEDS: AccessModuleSeed[] = [
  { module_key: 'users', module_name: 'Nguoi dung', description: 'Quan ly user va tai khoan noi bo.', sort_order: 10 },
  { module_key: 'settings', module_name: 'Cau hinh', description: 'Cau hinh va quan tri he thong.', sort_order: 20 },
  { module_key: 'customers', module_name: 'Khach hang', description: 'CRM, CSKH, timeline khach hang.', sort_order: 30 },
  { module_key: 'projects', module_name: 'Du an', description: 'Du an xay dung, diary, planning, overview.', sort_order: 40 },
  { module_key: 'inventory', module_name: 'Kho', description: 'Kho, phieu kho va ton kho.', sort_order: 50 },
  { module_key: 'labor', module_name: 'Nhan cong', description: 'Nhan cong, cham cong, thanh toan cong.', sort_order: 60 },
  { module_key: 'assets', module_name: 'Tai san', description: 'Tai san va van hanh tai san.', sort_order: 70 },
  { module_key: 'conversations', module_name: 'Hoi thoai', description: 'Conversations, tin nhan va phan tich.', sort_order: 80 },
]

export const ACCESS_RESOURCE_SEEDS: AccessResourceSeed[] = [
  { resource_key: 'user', resource_name: 'Nguoi dung', module_key: 'users', sort_order: 10 },
  { resource_key: 'setting', resource_name: 'Cau hinh he thong', module_key: 'settings', sort_order: 10 },
  { resource_key: 'customer', resource_name: 'Khach hang', module_key: 'customers', sort_order: 10 },
  { resource_key: 'project', resource_name: 'Du an', module_key: 'projects', sort_order: 10 },
  { resource_key: 'warehouse', resource_name: 'Kho', module_key: 'inventory', sort_order: 10 },
  { resource_key: 'labor_worker', resource_name: 'Nhan cong', module_key: 'labor', sort_order: 10 },
  { resource_key: 'asset', resource_name: 'Tai san', module_key: 'assets', sort_order: 10 },
  { resource_key: 'conversation', resource_name: 'Hoi thoai', module_key: 'conversations', sort_order: 10 },
]

export const ACCESS_PERMISSION_SEEDS: AccessPermissionSeed[] = [
  { permission_key: PERMISSIONS.usersRead, permission_name: 'Xem nguoi dung', module_key: 'users', resource_key: 'user', action_key: 'read', sort_order: 10 },
  { permission_key: PERMISSIONS.usersManage, permission_name: 'Quan ly nguoi dung', module_key: 'users', resource_key: 'user', action_key: 'manage', sort_order: 20 },
  { permission_key: PERMISSIONS.settingsRead, permission_name: 'Xem cau hinh', module_key: 'settings', resource_key: 'setting', action_key: 'read', sort_order: 10 },
  { permission_key: PERMISSIONS.settingsManage, permission_name: 'Quan ly cau hinh', module_key: 'settings', resource_key: 'setting', action_key: 'manage', sort_order: 20 },
  { permission_key: PERMISSIONS.customersRead, permission_name: 'Xem khach hang', module_key: 'customers', resource_key: 'customer', action_key: 'read', sort_order: 10 },
  { permission_key: PERMISSIONS.customersWrite, permission_name: 'Cap nhat khach hang', module_key: 'customers', resource_key: 'customer', action_key: 'write', sort_order: 20 },
  { permission_key: PERMISSIONS.customersManage, permission_name: 'Quan ly khach hang', module_key: 'customers', resource_key: 'customer', action_key: 'manage', sort_order: 30 },
  { permission_key: PERMISSIONS.projectsRead, permission_name: 'Xem du an', module_key: 'projects', resource_key: 'project', action_key: 'read', sort_order: 10 },
  { permission_key: PERMISSIONS.projectsWrite, permission_name: 'Cap nhat du an', module_key: 'projects', resource_key: 'project', action_key: 'write', sort_order: 20 },
  { permission_key: PERMISSIONS.projectsManage, permission_name: 'Quan ly du an', module_key: 'projects', resource_key: 'project', action_key: 'manage', sort_order: 30 },
  { permission_key: PERMISSIONS.inventoryRead, permission_name: 'Xem kho', module_key: 'inventory', resource_key: 'warehouse', action_key: 'read', sort_order: 10 },
  { permission_key: PERMISSIONS.inventoryWrite, permission_name: 'Cap nhat kho', module_key: 'inventory', resource_key: 'warehouse', action_key: 'write', sort_order: 20 },
  { permission_key: PERMISSIONS.inventoryManage, permission_name: 'Quan ly kho', module_key: 'inventory', resource_key: 'warehouse', action_key: 'manage', sort_order: 30 },
  { permission_key: PERMISSIONS.laborRead, permission_name: 'Xem nhan cong', module_key: 'labor', resource_key: 'labor_worker', action_key: 'read', sort_order: 10 },
  { permission_key: PERMISSIONS.laborWrite, permission_name: 'Cap nhat nhan cong', module_key: 'labor', resource_key: 'labor_worker', action_key: 'write', sort_order: 20 },
  { permission_key: PERMISSIONS.laborManage, permission_name: 'Quan ly nhan cong', module_key: 'labor', resource_key: 'labor_worker', action_key: 'manage', sort_order: 30 },
  { permission_key: PERMISSIONS.assetsRead, permission_name: 'Xem tai san', module_key: 'assets', resource_key: 'asset', action_key: 'read', sort_order: 10 },
  { permission_key: PERMISSIONS.assetsWrite, permission_name: 'Cap nhat tai san', module_key: 'assets', resource_key: 'asset', action_key: 'write', sort_order: 20 },
  { permission_key: PERMISSIONS.assetsManage, permission_name: 'Quan ly tai san', module_key: 'assets', resource_key: 'asset', action_key: 'manage', sort_order: 30 },
  { permission_key: PERMISSIONS.conversationsRead, permission_name: 'Xem hoi thoai', module_key: 'conversations', resource_key: 'conversation', action_key: 'read', sort_order: 10 },
  { permission_key: PERMISSIONS.conversationsWrite, permission_name: 'Cap nhat hoi thoai', module_key: 'conversations', resource_key: 'conversation', action_key: 'write', sort_order: 20 },
]

export const ACCESS_ROLE_SEEDS: AccessRoleSeed[] = [
  { role_key: 'admin', role_name: 'Quan tri vien', description: 'Co toan quyen he thong.', sort_order: 10 },
  { role_key: 'manager', role_name: 'Quan ly', description: 'Quan ly nghiep vu va van hanh.', sort_order: 20 },
  { role_key: 'sales', role_name: 'Kinh doanh', description: 'Ban hang, cham soc khach va du an lien quan.', sort_order: 30 },
  { role_key: 'mod', role_name: 'Dieu phoi / Moderation', description: 'Co nhieu quyen van hanh nhung khong quan tri he thong.', sort_order: 40 },
]

export const ACCESS_ROLE_PERMISSION_SEEDS: Record<string, PermissionKey[]> = {
  admin: ROLE_PERMISSION_MAP.admin,
  manager: ROLE_PERMISSION_MAP.manager,
  sales: ROLE_PERMISSION_MAP.sales,
  mod: [
    PERMISSIONS.customersRead,
    PERMISSIONS.customersWrite,
    PERMISSIONS.projectsRead,
    PERMISSIONS.projectsWrite,
    PERMISSIONS.inventoryRead,
    PERMISSIONS.laborRead,
    PERMISSIONS.assetsRead,
    PERMISSIONS.conversationsRead,
    PERMISSIONS.conversationsWrite,
  ],
}

export const ACCOUNT_TYPES = {
  internalUser: 'internal_user',
  investor: 'investor',
  partner: 'partner',
  supplier: 'supplier',
  subcontractor: 'subcontractor',
} as const

export type AccountTypeKey = (typeof ACCOUNT_TYPES)[keyof typeof ACCOUNT_TYPES]
