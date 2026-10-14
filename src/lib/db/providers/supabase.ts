// src/lib/db/providers/supabase.ts
// CLOUD provider — Supabase (inactive, giữ để switch)
// Để kích hoạt: đổi DB_PROVIDER=supabase trong .env.local

import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY  || ''

// Browser client
export const supabase = supabaseUrl
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Admin client (server-side only)
export const supabaseAdmin = supabaseUrl
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

export default supabaseAdmin
