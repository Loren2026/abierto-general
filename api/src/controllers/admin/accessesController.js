import { supabaseAdmin } from '../../config/supabase.js'
import {
  generateProjectPassword,
  hashProjectPassword,
} from '../../utils/passwords.js'
import {
  sanitizeAccessRecord,
  validateCreateAccessPayload,
} from '../../utils/accesses.js'

function handleSupabaseError(error, res) {
  if (!error) return false
  res.status(500).json({ error: error.message || 'Internal server error' })
  return true
}

export async function listProjectAccesses(req, res) {
  const { projectId } = req.params

  const { data, error } = await supabaseAdmin
    .from('project_accesses')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (handleSupabaseError(error, res)) return

  return res.json({ accesses: (data || []).map(sanitizeAccessRecord) })
}

export async function createProjectAccess(req, res) {
  const { projectId } = req.params
  const validationError = validateCreateAccessPayload(req.body)

  if (validationError) {
    return res.status(400).json({ error: validationError })
  }

  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle()

  if (handleSupabaseError(projectError, res)) return
  if (!project) return res.status(404).json({ error: 'project not found' })

  const generatedPassword = generateProjectPassword(8)
  const passwordHash = await hashProjectPassword(generatedPassword)

  const { data, error } = await supabaseAdmin
    .from('project_accesses')
    .insert({
      project_id: projectId,
      person_name: req.body.personName.trim(),
      password_hash: passwordHash,
      notes: req.body.notes?.toString().trim() || null,
    })
    .select('*')
    .single()

  if (handleSupabaseError(error, res)) return

  return res.status(201).json({
    access: sanitizeAccessRecord(data),
    generatedPassword,
  })
}

export async function getProjectAccess(req, res) {
  const { accessId } = req.params

  const { data, error } = await supabaseAdmin
    .from('project_accesses')
    .select('*')
    .eq('id', accessId)
    .maybeSingle()

  if (handleSupabaseError(error, res)) return
  if (!data) return res.status(404).json({ error: 'access not found' })

  return res.json({ access: sanitizeAccessRecord(data) })
}

export async function regenerateProjectPassword(req, res) {
  const { accessId } = req.params

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('project_accesses')
    .select('*')
    .eq('id', accessId)
    .maybeSingle()

  if (handleSupabaseError(existingError, res)) return
  if (!existing) return res.status(404).json({ error: 'access not found' })

  const generatedPassword = generateProjectPassword(8)
  const passwordHash = await hashProjectPassword(generatedPassword)

  const { data, error } = await supabaseAdmin
    .from('project_accesses')
    .update({
      password_hash: passwordHash,
      status: 'active',
      revoked_at: null,
      password_last_generated_at: new Date().toISOString(),
    })
    .eq('id', accessId)
    .select('*')
    .single()

  if (handleSupabaseError(error, res)) return

  return res.json({
    access: sanitizeAccessRecord(data),
    generatedPassword,
  })
}

export async function revokeProjectAccess(req, res) {
  const { accessId } = req.params
  const notes = req.body?.notes?.toString().trim() || null

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('project_accesses')
    .select('*')
    .eq('id', accessId)
    .maybeSingle()

  if (handleSupabaseError(existingError, res)) return
  if (!existing) return res.status(404).json({ error: 'access not found' })

  const revokedAt = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('project_accesses')
    .update({
      status: 'revoked',
      revoked_at: revokedAt,
      notes,
    })
    .eq('id', accessId)
    .select('*')
    .single()

  if (handleSupabaseError(error, res)) return

  const { error: logError } = await supabaseAdmin
    .from('revocation_logs')
    .insert({
      project_id: existing.project_id,
      project_access_id: existing.id,
      revocation_type: 'access',
      notes,
    })

  if (handleSupabaseError(logError, res)) return

  return res.json({ access: sanitizeAccessRecord(data) })
}
