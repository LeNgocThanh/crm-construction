// types/index.ts

export type UserRole = 'admin' | 'manager' | 'sales'

export interface User {
  id: string
  username: string
  full_name?: string | null
  email?: string | null
  phone?: string
  avatar_url?: string | null
  employee_code?: string | null
  job_title?: string | null
  role?: UserRole | null
  is_active: boolean
  last_login_at?: string | null
  created_at: string
  updated_at: string
}

export type CustomerStatus =
  | 'Mới' | 'Đang tìm hiểu' | 'Hẹn gặp' | 'Đang thương thảo'
  | 'Chờ ký HĐ' | 'Đã ký HĐ' | 'Đang thi công'
  | 'Hoàn công' | 'Bảo hành' | 'Hoàn tất'
  | 'Tạm ngưng' | 'Từ chối'

export interface Customer {
  id: string
  phone_number: string
  full_name?: string
  total_contacts:     number
  status:             string
  // Nhu cầu
  address?:           string
  house_type?:        string
  floors?:            number
  floor_area?:        number
  budget_min?:        number
  budget_max?:        number
  // Tiềm năng
  potential_score?:   number
  potential_level?:   string
  next_action?:       string
  // Nguồn
  source?:            string
  referrer_name?:     string
  referrer_phone?:    string
  // Social
  telegram_id?:       string
  telegram_username?: string
  zalo_id?:           string
  zalo_username?:     string
  messenger_id?:      string
  messenger_username?: string
  assigned_to?:       string
  created_at:         string
  updated_at:         string
}

export type HouseType = 'Nhà phố' | 'Biệt thự' | 'Nhà cấp 4' | 'Chung cư' | 'Khác'

export interface ConstructionProject {
  id: string
  customer_id: string
  address?: string
  house_type?: HouseType
  floors?: number
  floor_area?: number
  estimated_budget?: number
  notes?: string
  created_at: string
  customer?: Customer
}

export type SentimentType = 'Tích cực' | 'Trung lập' | 'Gay gắt'

export interface ContactLog {
  id: string
  customer_id: string
  sales_id: string
  contact_date: string
  audio_file_path?: string
  transcription_raw?: string
  ai_summary?: string
  ai_sentiment?: SentimentType
  next_action?: string
  created_at: string
  customer?: Customer
  sales?: User
}

export interface StaffKPI {
  id: string
  staff_id: string
  month: string
  total_calls: number
  successful_leads: number
  avg_response_time?: number
  staff?: User
}

// API Response types
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

// AI Extraction result
export interface AIExtractionResult {
  full_name?: string
  address?: string
  house_type?: HouseType
  floors?: number
  floor_area?: number
  estimated_budget?: number
  ai_summary: string
  ai_sentiment: SentimentType
  next_action: string
  lead_score: number  // mapped to potential_score in DB
}

// Role permissions
export interface Permission {
  canViewUsers: boolean
  canManageUsers: boolean
  canViewAllCustomers: boolean
  canManageCustomers: boolean
  canImportAudio: boolean
  canViewKPI: boolean
  canViewAllKPI: boolean
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  admin: {
    canViewUsers: true,
    canManageUsers: true,
    canViewAllCustomers: true,
    canManageCustomers: true,
    canImportAudio: true,
    canViewKPI: true,
    canViewAllKPI: true,
  },
  manager: {
    canViewUsers: true,
    canManageUsers: false,
    canViewAllCustomers: true,
    canManageCustomers: true,
    canImportAudio: true,
    canViewKPI: true,
    canViewAllKPI: true,
  },
  sales: {
    canViewUsers: false,
    canManageUsers: false,
    canViewAllCustomers: false,
    canManageCustomers: true,
    canImportAudio: true,
    canViewKPI: true,
    canViewAllKPI: false,
  },
}
