import { supabaseAdmin } from '../../config/supabase.js'
import { normalizeProjectSlug } from '../../utils/projects.js'
import { sanitizePublicProject } from '../../utils/publicProjects.js'

function handleSupabaseError(error, res) {
  if (!error) return false
  res.status(500).json({ error: error.message || 'Internal server error' })
  return true
}

export async function listPublicProjects(req, res) {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('status', 'public')
    .order('published_at', { ascending: false })

  if (handleSupabaseError(error, res)) return

  return res.json({ projects: (data || []).map(sanitizePublicProject) })
}

export async function getPublicProject(req, res) {
  const slug = normalizeProjectSlug(req.params.slug)

  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('status', 'public')
    .eq('slug', slug)
    .maybeSingle()

  if (handleSupabaseError(error, res)) return
  if (!data) return res.status(404).json({ error: 'project not found' })

  return res.json({ project: sanitizePublicProject(data) })
}
