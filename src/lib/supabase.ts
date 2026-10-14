// src/lib/supabase.ts
// BACKWARD COMPAT SHIM — redirect imports sang new providers
// Giữ file này để không break import cũ trong khi migrate

export { supabase, supabaseAdmin } from '@/lib/db/providers/supabase'
