import { supabaseAdmin } from '../../config/supabase.js'
import { buildInvalidDownloadResponse } from '../../utils/downloads.js'
import { findMatchingAccess, sanitizeValidatedAccess } from '../../utils/invitationCodes.js'
import { normalizeProjectSlug } from '../../utils/projects.js'

function handleSupabaseError(error, res) {
  if (!error) return false
  res.status(500).json({ error: error.message || 'Internal server error' })
  return true
}

export async function validateProjectCode(req, res) {
  const slug = normalizeProjectSlug(req.params.slug)
  const code = req.body?.code?.toString().trim() || ''

  if (!code) {
    return res.status(400).json({ error: 'code is required' })
  }

  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('id, slug, name, status')
    .eq('status', 'public')
    .eq('slug', slug)
    .maybeSingle()

  if (handleSupabaseError(projectError, res)) return
  if (!project) {
    return res.status(404).json({ error: 'project not found' })
  }

  try {
    const access = await findMatchingAccess(project.id, code)
    if (!access) {
      return res.status(401).json(buildInvalidDownloadResponse())
    }

    return res.json({
      ok: true,
      project,
      access: sanitizeValidatedAccess(access),
    })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
