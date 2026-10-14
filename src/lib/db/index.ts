// src/lib/db/index.ts
// Provider switch — đổi DB_PROVIDER trong .env để chuyển backend

export { prisma as db } from './providers/prisma'

// Re-export supabase để backward-compat (inactive)
export { supabaseAdmin, supabase } from './providers/supabase'

// Active provider name (dùng để log / health check)
export const DB_PROVIDER = process.env.DB_PROVIDER || 'prisma'
