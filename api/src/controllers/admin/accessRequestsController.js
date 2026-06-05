import { supabaseAdmin } from '../../config/supabase.js'
import { generateProjectPassword, hashProjectPassword } from '../../utils/passwords.js'
import { sanitizeAccessRecord } from '../../utils/accesses.js'
import { sanitizeAccessRequestRecord, validateUpdateAccessRequestPayload } from '../../utils/accessRequests.js'

function handleSupabaseError(error, res) {
  if (!error) return false
  res.status(500).json({ error: error.message || 'Internal server error' })
  return true
}

function applyAccessRequestFilters(query, params = {}) {
  if (params.projectId) query = query.eq('project_id', params.projectId)
  if (params.status) query = query.eq('status', params.status)
  if (params.dateFrom) query = query.gte('created_at', params.dateFrom)
  if (params.dateTo) query = query.lte('created_at', params.dateTo)
  if (params.search) {
    const search = params.search.toString().trim()
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
  }
  return query
}

export async function listAccessRequests(req, res) {
  let query = supabaseAdmin
    .from('access_requests')
    .select('*, projects(id, slug, name, status)')
    .order('created_at', { ascending: false })
    .limit(Math.min(Number(req.query.limit) || 100, 250))

  query = applyAccessRequestFilters(query, req.query)

  const { data, error } = await query
  if (handleSupabaseError(error, res)) return
  return res.json({ accessRequests: (data || []).map(sanitizeAccessRequestRecord) })
}

export async function getAccessRequest(req, res) {
  const { requestId } = req.params
  const { data, error } = await supabaseAdmin
    .from('access_requests')
    .select('*, projects(id, slug, name, status)')
    .eq('id', requestId)
    .maybeSingle()

  if (handleSupabaseError(error, res)) return
  if (!data) return res.status(404).json({ error: 'access request not found' })
  return res.json({ accessRequest: sanitizeAccessRequestRecord(data) })
}

export async function updateAccessRequest(req, res) {
  const { requestId } = req.params
  const validationError = validateUpdateAccessRequestPayload(req.body)
  if (validationError) return res.status(400).json({ error: validationError })

  const patch = {}
  if (req.body.status !== undefined) patch.status = req.body.status
  if (req.body.internalNotes !== undefined) patch.internal_notes = req.body.internalNotes?.toString().trim() || null
  if (req.body.rejectionReason !== undefined) patch.rejection_reason = req.body.rejectionReason?.toString().trim() || null
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'no valid fields to update' })

  const { data, error } = await supabaseAdmin
    .from('access_requests')
    .update(patch)
    .eq('id', requestId)
    .select('*, projects(id, slug, name, status)')
    .single()

  if (handleSupabaseError(error, res)) return
  return res.json({ accessRequest: sanitizeAccessRequestRecord(data) })
}

export async function approveAccessRequest(req, res) {
  const { requestId } = req.params
  const { data, error } = await supabaseAdmin
    .from('access_requests')
    .update({ status: 'approved', handled_at: new Date().toISOString(), handled_by: req.user?.email || req.user?.id || null })
    .eq('id', requestId)
    .select('*, projects(id, slug, name, status)')
    .single()

  if (handleSupabaseError(error, res)) return
  return res.json({ accessRequest: sanitizeAccessRequestRecord(data) })
}

export async function rejectAccessRequest(req, res) {
  const { requestId } = req.params
  const reason = req.body?.reason?.toString().trim()
  if (!reason) return res.status(400).json({ error: 'reason is required' })

  const { data, error } = await supabaseAdmin
    .from('access_requests')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      handled_at: new Date().toISOString(),
      handled_by: req.user?.email || req.user?.id || null,
    })
    .eq('id', requestId)
    .select('*, projects(id, slug, name, status)')
    .single()

  if (handleSupabaseError(error, res)) return
  return res.json({ accessRequest: sanitizeAccessRequestRecord(data) })
}

export async function generateAccessFromRequest(req, res) {
  const { requestId } = req.params
  const { data: request, error: requestError } = await supabaseAdmin
    .from('access_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle()

  if (handleSupabaseError(requestError, res)) return
  if (!request) return res.status(404).json({ error: 'access request not found' })
  if (request.created_project_access_id) return res.status(409).json({ error: 'access already generated for this request' })

  const generatedPassword = generateProjectPassword(8)
  const passwordHash = await hashProjectPassword(generatedPassword)
  const now = new Date().toISOString()

  const { data: access, error: accessError } = await supabaseAdmin
    .from('project_accesses')
    .insert({
      project_id: request.project_id,
      access_request_id: request.id,
      person_name: request.full_name,
      password_hash: passwordHash,
      status: 'active',
      notes: req.body?.notes?.toString().trim() || request.message || null,
    })
    .select('*')
    .single()

  if (handleSupabaseError(accessError, res)) return

  const { data: updatedRequest, error: updateError } = await supabaseAdmin
    .from('access_requests')
    .update({
      status: 'code_generated',
      created_project_access_id: access.id,
      handled_at: request.handled_at || now,
      handled_by: request.handled_by || req.user?.email || req.user?.id || null,
    })
    .eq('id', request.id)
    .select('*, projects(id, slug, name, status)')
    .single()

  if (handleSupabaseError(updateError, res)) return

  return res.status(201).json({
    accessRequest: sanitizeAccessRequestRecord(updatedRequest),
    access: sanitizeAccessRecord(access),
    generatedPassword,
  })
}

export async function markAccessRequestCodeSent(req, res) {
  const { requestId } = req.params
  const sentAt = new Date().toISOString()

  const { data: request, error: requestError } = await supabaseAdmin
    .from('access_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle()

  if (handleSupabaseError(requestError, res)) return
  if (!request) return res.status(404).json({ error: 'access request not found' })
  if (!request.created_project_access_id) return res.status(409).json({ error: 'request has no generated access' })

  const { error: accessError } = await supabaseAdmin
    .from('project_accesses')
    .update({ sent_at: sentAt })
    .eq('id', request.created_project_access_id)

  if (handleSupabaseError(accessError, res)) return

  const { data, error } = await supabaseAdmin
    .from('access_requests')
    .update({ status: 'code_sent' })
    .eq('id', requestId)
    .select('*, projects(id, slug, name, status)')
    .single()

  if (handleSupabaseError(error, res)) return
  return res.json({ accessRequest: sanitizeAccessRequestRecord(data) })
}

export async function revokeAccessRequestAccess(req, res) {
  const { requestId } = req.params
  const reason = req.body?.reason?.toString().trim()
  if (!reason) return res.status(400).json({ error: 'reason is required' })

  const { data: request, error: requestError } = await supabaseAdmin
    .from('access_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle()

  if (handleSupabaseError(requestError, res)) return
  if (!request) return res.status(404).json({ error: 'access request not found' })
  if (!request.created_project_access_id) return res.status(409).json({ error: 'request has no generated access' })

  const revokedAt = new Date().toISOString()
  const { data: access, error: accessError } = await supabaseAdmin
    .from('project_accesses')
    .update({ status: 'revoked', revoked_at: revokedAt, notes: reason })
    .eq('id', request.created_project_access_id)
    .select('*')
    .single()

  if (handleSupabaseError(accessError, res)) return

  const { error: logError } = await supabaseAdmin
    .from('revocation_logs')
    .insert({
      project_id: access.project_id,
      project_access_id: access.id,
      revocation_type: 'access',
      notes: reason,
    })

  if (handleSupabaseError(logError, res)) return
  return res.json({ access: sanitizeAccessRecord(access) })
}
