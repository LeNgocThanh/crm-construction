// src/lib/storage/providers/supabase.ts
// CLOUD storage provider — Supabase Storage (inactive, giữ để switch)

export async function uploadFileSupabase(
  buffer: Buffer,
  filename: string,
  folder: string = 'contact-audio'
): Promise<{ path: string; url: string }> {
  const { supabaseAdmin } = await import('@/lib/db/providers/supabase')
  if (!supabaseAdmin) throw new Error('Supabase chưa được cấu hình')

  const ext    = filename.split('.').pop()
  const unique = `${folder}/${Date.now()}_${filename}`

  const { error } = await supabaseAdmin.storage
    .from('contact-audio')
    .upload(unique, buffer, { contentType: `audio/${ext}` })

  if (error) throw new Error(error.message)

  const { data: urlData } = supabaseAdmin.storage
    .from('contact-audio')
    .getPublicUrl(unique)

  return { path: unique, url: urlData.publicUrl }
}

export async function deleteFileSupabase(filePath: string): Promise<boolean> {
  const { supabaseAdmin } = await import('@/lib/db/providers/supabase')
  if (!supabaseAdmin) return false

  const pathInBucket = filePath.split('/contact-audio/')[1] || filePath
  const { error } = await supabaseAdmin.storage
    .from('contact-audio')
    .remove([pathInBucket])

  return !error
}
