import { supabaseAdmin } from '../../config/supabase.js'

export async function downloadPrivateObject(path) {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'project-downloads'
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path)

  if (error) {
    throw error
  }

  return data
}
