import 'server-only'
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_DIMENSION = 1600
const BUCKET = 'hazard-images'

export class UploadError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

// Validates, shrinks (max 1600px, JPEG) and stores an image; returns its public URL.
export async function storeImage(file: unknown, folder: string): Promise<{ path: string; publicUrl: string }> {
  if (!(file instanceof File)) throw new UploadError('Зургийн файл шаардлагатай')
  if (!file.type.startsWith('image/')) throw new UploadError('Зөвхөн зураг оруулна уу')
  if (file.size > MAX_FILE_SIZE) throw new UploadError('Зураг 10 MB-аас бага байх ёстой')

  const original = Buffer.from(await file.arrayBuffer())
  let compressed: Buffer
  try {
    compressed = await sharp(original)
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer()
  } catch {
    throw new UploadError('Зургийг уншиж чадсангүй. Өөр зураг сонгоно уу.')
  }

  const path = `${folder}/${crypto.randomUUID()}.jpg`
  const supabase = createAdminClient()
  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { path, publicUrl: data.publicUrl }
}

export function imagePublicPrefix(): string {
  const { data } = createAdminClient().storage.from(BUCKET).getPublicUrl('')
  return data.publicUrl
}
