// src/lib/storage/providers/local.ts
// LOCAL storage provider — saves to filesystem, serves via Next.js
import fs   from 'fs'
import path from 'path'

const UPLOAD_DIR     = process.env.UPLOAD_DIR      || path.join(process.cwd(), 'public', 'uploads')
const UPLOAD_URL_BASE = process.env.UPLOAD_URL_BASE || 'http://localhost:3000/uploads'

// Ensure directory exists
function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

export async function uploadFileLocal(
  buffer: Buffer,
  filename: string,
  folder: string = 'audio'
): Promise<{ path: string; url: string }> {
  const dir = path.join(UPLOAD_DIR, folder)
  ensureDir(dir)

  // Unique filename to avoid collisions
  const ext      = path.extname(filename)
  const base     = path.basename(filename, ext).replace(/[^a-z0-9]/gi, '_')
  const unique   = `${Date.now()}_${base}${ext}`
  const filePath = path.join(dir, unique)

  fs.writeFileSync(filePath, buffer)

  const relativePath = `${folder}/${unique}`
  const publicUrl    = `${UPLOAD_URL_BASE}/${relativePath}`

  return { path: relativePath, url: publicUrl }
}

export async function deleteFileLocal(filePath: string): Promise<boolean> {
  try {
    // filePath có thể là relative (audio/xxx.mp3) hoặc absolute
    const absPath = filePath.startsWith('/')
      ? filePath
      : path.join(UPLOAD_DIR, filePath)

    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath)
    }
    return true
  } catch (err) {
    console.error('Delete file error:', err)
    return false
  }
}

export function getFileUrl(relativePath: string): string {
  return `${UPLOAD_URL_BASE}/${relativePath}`
}

export { UPLOAD_DIR, UPLOAD_URL_BASE }
