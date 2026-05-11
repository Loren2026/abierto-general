import { supabaseAdmin } from '../../config/supabase.js'
import {
  sanitizeDeviceRecord,
  validateDevicePayload,
} from '../../utils/devices.js'

function handleSupabaseError(error, res) {
  if (!error) return false
  res.status(500).json({ error: error.message || 'Internal server error' })
  return true
}

async function getAccess(accessId) {
  const { data, error } = await supabaseAdmin
    .from('project_accesses')
    .select('*')
    .eq('id', accessId)
    .maybeSingle()

  return { data, error }
}

async function getActiveDevice(accessId) {
  const { data, error } = await supabaseAdmin
    .from('project_devices')
    .select('*')
    .eq('project_access_id', accessId)
    .eq('status', 'active')
    .order('activated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return { data, error }
}

export async function listAccessDevices(req, res) {
  const { accessId } = req.params

  const { data: access, error: accessError } = await getAccess(accessId)
  if (handleSupabaseError(accessError, res)) return
  if (!access) return res.status(404).json({ error: 'access not found' })

  const { data, error } = await supabaseAdmin
    .from('project_devices')
    .select('*')
    .eq('project_access_id', accessId)
    .order('activated_at', { ascending: false })

  if (handleSupabaseError(error, res)) return

  return res.json({ devices: (data || []).map(sanitizeDeviceRecord) })
}

export async function createAccessDevice(req, res) {
  const { accessId } = req.params
  const validationError = validateDevicePayload(req.body)

  if (validationError) {
    return res.status(400).json({ error: validationError })
  }

  const { data: access, error: accessError } = await getAccess(accessId)
  if (handleSupabaseError(accessError, res)) return
  if (!access) return res.status(404).json({ error: 'access not found' })
  if (access.status === 'revoked') {
    return res.status(409).json({ error: 'revoked access cannot register devices' })
  }

  const { data: activeDevice, error: activeDeviceError } = await getActiveDevice(accessId)
  if (handleSupabaseError(activeDeviceError, res)) return
  if (activeDevice) {
    return res.status(409).json({ error: 'access already has an active device' })
  }

  const { data, error } = await supabaseAdmin
    .from('project_devices')
    .insert({
      project_access_id: accessId,
      device_id: req.body.deviceId.trim(),
      device_name: req.body.deviceName.trim(),
      platform: req.body.platform?.toString().trim() || null,
      notes: req.body.notes?.toString().trim() || null,
      status: 'active',
      activated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (handleSupabaseError(error, res)) return

  return res.status(201).json({ device: sanitizeDeviceRecord(data) })
}

export async function getActiveAccessDevice(req, res) {
  const { accessId } = req.params

  const { data: access, error: accessError } = await getAccess(accessId)
  if (handleSupabaseError(accessError, res)) return
  if (!access) return res.status(404).json({ error: 'access not found' })

  const { data, error } = await getActiveDevice(accessId)
  if (handleSupabaseError(error, res)) return
  if (!data) return res.status(404).json({ error: 'active device not found' })

  return res.json({ device: sanitizeDeviceRecord(data) })
}

export async function reassignAccessDevice(req, res) {
  const { accessId } = req.params
  const validationError = validateDevicePayload(req.body)

  if (validationError) {
    return res.status(400).json({ error: validationError })
  }

  const { data: access, error: accessError } = await getAccess(accessId)
  if (handleSupabaseError(accessError, res)) return
  if (!access) return res.status(404).json({ error: 'access not found' })
  if (access.status === 'revoked') {
    return res.status(409).json({ error: 'revoked access cannot reassign devices' })
  }

  const reassignedAt = new Date().toISOString()
  const notes = req.body.notes?.toString().trim() || req.body.reason?.toString().trim() || null

  const { data: activeDevice, error: activeDeviceError } = await getActiveDevice(accessId)
  if (handleSupabaseError(activeDeviceError, res)) return

  if (activeDevice) {
    const { error: deactivateError } = await supabaseAdmin
      .from('project_devices')
      .update({
        status: 'revoked',
        revoked_at: reassignedAt,
        notes: notes || activeDevice.notes,
      })
      .eq('id', activeDevice.id)

    if (handleSupabaseError(deactivateError, res)) return

    const { error: logError } = await supabaseAdmin
      .from('revocation_logs')
      .insert({
        project_id: access.project_id,
        project_access_id: access.id,
        project_device_id: activeDevice.id,
        revocation_type: 'device_reassignment',
        notes,
      })

    if (handleSupabaseError(logError, res)) return
  }

  const { data, error } = await supabaseAdmin
    .from('project_devices')
    .insert({
      project_access_id: accessId,
      device_id: req.body.deviceId.trim(),
      device_name: req.body.deviceName.trim(),
      platform: req.body.platform?.toString().trim() || null,
      notes,
      status: 'active',
      activated_at: reassignedAt,
    })
    .select('*')
    .single()

  if (handleSupabaseError(error, res)) return

  return res.json({ device: sanitizeDeviceRecord(data) })
}

export async function revokeDevice(req, res) {
  const { deviceId } = req.params
  const notes = req.body?.notes?.toString().trim() || null
  const revokedAt = new Date().toISOString()

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('project_devices')
    .select('*')
    .eq('id', deviceId)
    .maybeSingle()

  if (handleSupabaseError(existingError, res)) return
  if (!existing) return res.status(404).json({ error: 'device not found' })

  const { data: access, error: accessError } = await getAccess(existing.project_access_id)
  if (handleSupabaseError(accessError, res)) return

  const { data, error } = await supabaseAdmin
    .from('project_devices')
    .update({
      status: 'revoked',
      revoked_at: revokedAt,
      notes,
    })
    .eq('id', deviceId)
    .select('*')
    .single()

  if (handleSupabaseError(error, res)) return

  const { error: logError } = await supabaseAdmin
    .from('revocation_logs')
    .insert({
      project_id: access?.project_id || null,
      project_access_id: existing.project_access_id,
      project_device_id: existing.id,
      revocation_type: 'device',
      notes,
    })

  if (handleSupabaseError(logError, res)) return

  return res.json({ device: sanitizeDeviceRecord(data) })
}
