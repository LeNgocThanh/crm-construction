// src/lib/storage/index.ts
// Unified storage interface — switch via STORAGE_PROVIDER env
import { uploadFileLocal, deleteFileLocal } from './providers/local'
import { uploadFileSupabase, deleteFileSupabase } from './providers/supabase'

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local'

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  folder: string = 'audio'
): Promise<{ path: string; url: string }> {
  if (STORAGE_PROVIDER === 'supabase') {
    return uploadFileSupabase(buffer, filename, folder)
  }
  return uploadFileLocal(buffer, filename, folder)
}

export async function deleteFile(filePath: string): Promise<boolean> {
  if (STORAGE_PROVIDER === 'supabase') {
    return deleteFileSupabase(filePath)
  }
  return deleteFileLocal(filePath)
}

export { STORAGE_PROVIDER }
