import { supabaseAdmin } from '../../config/supabase.js'
import {
  buildProjectInsert,
  buildProjectUpdate,
  validateCreateProjectPayload,
} from '../../utils/projects.js'
import { sanitizeAdminProject } from '../../utils/publicProjects.js'

function handleSupabaseError(error, res) {
  if (!error) return false

  if (error.code === '23505') {
    res.status(409).json({ error: 'slug already exists' })
    return true
  }

  res.status(500).json({ error: error.message || 'Internal server error' })
  return true
}

export async function listProjects(req, res) {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (handleSupabaseError(error, res)) return

  return res.json({ projects: (data || []).map(sanitizeAdminProject) })
}

export async function createProject(req, res) {
  const validationError = validateCreateProjectPayload(req.body)
  if (validationError) {
    return res.status(400).json({ error: validationError })
  }

  const projectToInsert = buildProjectInsert(req.body)

  const { data, error } = await supabaseAdmin
    .from('projects')
    .insert(projectToInsert)
    .select('*')
    .single()

  if (handleSupabaseError(error, res)) return

  return res.status(201).json({ project: sanitizeAdminProject(data) })
}

export async function getProject(req, res) {
  const { projectId } = req.params

  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle()

  if (handleSupabaseError(error, res)) return
  if (!data) return res.status(404).json({ error: 'project not found' })

  return res.json({ project: sanitizeAdminProject(data) })
}

export async function updateProject(req, res) {
  const { projectId } = req.params
  const updatePayload = buildProjectUpdate(req.body)

  if (Object.keys(updatePayload).length === 0) {
    return res.status(400).json({ error: 'no valid fields to update' })
  }

  const { data, error } = await supabaseAdmin
    .from('projects')
    .update(updatePayload)
    .eq('id', projectId)
    .select('*')
    .maybeSingle()

  if (handleSupabaseError(error, res)) return
  if (!data) return res.status(404).json({ error: 'project not found' })

  return res.json({ project: sanitizeAdminProject(data) })
}

export async function publishProject(req, res) {
  const { projectId } = req.params
  const updatePayload = {
    status: 'public',
    published_at: new Date().toISOString(),
  }

  if (req.body?.description !== undefined) updatePayload.description = req.body.description?.toString().trim() || null
  if (req.body?.imageUrl !== undefined) updatePayload.image_url = req.body.imageUrl?.toString().trim() || null

  const { data, error } = await supabaseAdmin
    .from('projects')
    .update(updatePayload)
    .eq('id', projectId)
    .select('*')
    .maybeSingle()

  if (handleSupabaseError(error, res)) return
  if (!data) return res.status(404).json({ error: 'project not found' })

  return res.json({ project: sanitizeAdminProject(data) })
}

export async function unpublishProject(req, res) {
  const { projectId } = req.params

  const { data, error } = await supabaseAdmin
    .from('projects')
    .update({ status: 'private' })
    .eq('id', projectId)
    .select('*')
    .maybeSingle()

  if (handleSupabaseError(error, res)) return
  if (!data) return res.status(404).json({ error: 'project not found' })

  return res.json({ project: sanitizeAdminProject(data) })
}
