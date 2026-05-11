import { supabaseAdmin } from '../../config/supabase.js'
import { buildInvalidDownloadResponse } from '../../utils/downloads.js'
import { findMatchingAccess, sanitizeValidatedAccess } from '../../utils/invitationCodes.js'
import { sanitizeDeviceRecord } from '../../utils/devices.js'
import { normalizeProjectSlug } from '../../utils/projects.js'

async function findActiveDevice(accessId) {
  const { data, error } = await supabaseAdmin
    .from('project_devices')
    .select('*')
    .eq('project_access_id', accessId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

async function bindDeviceToAccess(accessId, { deviceId, deviceName, platform }) {
  const activatedAt = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('project_devices')
    .insert({
      project_access_id: accessId,
      device_id: deviceId,
      device_name: deviceName,
      platform: platform || null,
      status: 'active',
      activated_at: activatedAt,
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

function handleSupabaseError(error, res) {
  if (!error) return false
  res.status(500).json({ error: error.message || 'Internal server error' })
  return true
}

export async function validateProjectCode(req, res) {
  const slug = normalizeProjectSlug(req.params.slug)
  const code = req.body?.code?.toString().trim() || ''
  const deviceId = req.body?.deviceId?.toString().trim() || ''
  const deviceName = req.body?.deviceName?.toString().trim() || ''
  const platform = req.body?.platform?.toString().trim() || ''

  if (!code) {
    return res.status(400).json({ error: 'code is required' })
  }

  if (!deviceId || !deviceName) {
    return res.status(400).json({ error: 'deviceId and deviceName are required' })
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

    const activeDevice = await findActiveDevice(access.id)

    if (!activeDevice) {
      const createdDevice = await bindDeviceToAccess(access.id, { deviceId, deviceName, platform })

      return res.json({
        ok: true,
        project,
        access: sanitizeValidatedAccess(access),
        device: sanitizeDeviceRecord(createdDevice),
        binding: 'created',
      })
    }

    if (activeDevice.device_id !== deviceId) {
      return res.status(409).json({
        error: 'access already linked to another active device',
        binding: 'blocked',
        device: sanitizeDeviceRecord(activeDevice),
      })
    }

    return res.json({
      ok: true,
      project,
      access: sanitizeValidatedAccess(access),
      device: sanitizeDeviceRecord(activeDevice),
      binding: 'reused',
    })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
