import { supabaseAdmin } from '../../config/supabase.js'
import { buildInvalidDownloadResponse } from '../../utils/downloads.js'
import { findMatchingAccess, sanitizeValidatedAccess } from '../../utils/invitationCodes.js'
import { sanitizeDeviceRecord } from '../../utils/devices.js'
import { normalizeProjectSlug } from '../../utils/projects.js'

function setProjectAccessCookie(res, { project, deviceId, accessId, binding }) {
  if (project?.slug !== 'gestactas') return

  const payload = encodeURIComponent(JSON.stringify({
    validated: true,
    project: 'gestactas',
    deviceId,
    accessId: accessId || null,
    binding: binding || null,
    ts: Date.now(),
  }))

  res.cookie('gestactas_access', payload, {
    domain: '.inteligencialoren.com',
    path: '/',
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 12,
  })
}

async function listActiveDevices(accessId) {
  const { data, error } = await supabaseAdmin
    .from('project_devices')
    .select('*')
    .eq('project_access_id', accessId)
    .eq('status', 'active')
    .order('first_seen_at', { ascending: false })

  if (error) throw error
  return data || []
}

async function bindDeviceToAccess(accessId, { deviceId, deviceName }) {
  const firstSeenAt = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('project_devices')
    .insert({
      project_access_id: accessId,
      device_id: deviceId,
      device_label: deviceName,
      status: 'active',
      first_seen_at: firstSeenAt,
      last_seen_at: firstSeenAt,
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

async function findMatchingProjectAndAccess(code) {
  const { data: projects, error } = await supabaseAdmin
    .from('projects')
    .select('id, slug, name, status')
    .eq('status', 'public')
    .order('published_at', { ascending: false })

  if (error) throw error

  for (const project of projects || []) {
    const access = await findMatchingAccess(project.id, code)
    if (access) {
      return { project, access }
    }
  }

  return null
}

async function validateDeviceForAccess({ project, access, deviceId, deviceName, res }) {
  const activeDevices = await listActiveDevices(access.id)
  const existingDevice = activeDevices.find((device) => device.device_id === deviceId)

  if (existingDevice) {
    const lastSeenAt = new Date().toISOString()

    await supabaseAdmin
      .from('project_devices')
      .update({ last_seen_at: lastSeenAt })
      .eq('id', existingDevice.id)

    setProjectAccessCookie(res, {
      project,
      deviceId,
      accessId: access.id,
      binding: 'reused',
    })

    return res.json({
      ok: true,
      project,
      access: sanitizeValidatedAccess(access),
      device: sanitizeDeviceRecord({ ...existingDevice, last_seen_at: lastSeenAt }),
      binding: 'reused',
    })
  }

  const maxDevices = Number.isInteger(access.max_devices) && access.max_devices > 0
    ? access.max_devices
    : 1

  if (activeDevices.length >= maxDevices) {
    return res.status(409).json({
      error: 'access already linked to maximum active devices',
      binding: 'blocked',
      maxDevices,
      activeDevices: activeDevices.map(sanitizeDeviceRecord),
    })
  }

  const createdDevice = await bindDeviceToAccess(access.id, { deviceId, deviceName })

  setProjectAccessCookie(res, {
    project,
    deviceId,
    accessId: access.id,
    binding: 'created',
  })

  return res.json({
    ok: true,
    project,
    access: sanitizeValidatedAccess(access),
    device: sanitizeDeviceRecord(createdDevice),
    binding: 'created',
  })
}

function handleSupabaseError(error, res) {
  if (!error) return false
  res.status(500).json({ error: error.message || 'Internal server error' })
  return true
}

export async function validateAnyProjectCode(req, res) {
  const code = req.body?.code?.toString().trim() || ''
  const deviceId = req.body?.deviceId?.toString().trim() || ''
  const deviceName = req.body?.deviceName?.toString().trim() || ''

  if (!code) {
    return res.status(400).json({ error: 'code is required' })
  }

  if (!deviceId || !deviceName) {
    return res.status(400).json({ error: 'deviceId and deviceName are required' })
  }

  try {
    const match = await findMatchingProjectAndAccess(code)

    if (!match) {
      return res.status(401).json(buildInvalidDownloadResponse())
    }

    const { project, access } = match
    return validateDeviceForAccess({ project, access, deviceId, deviceName, res })
  } catch (error) {
    console.error('VALIDATE ANY ERROR:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
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

    return validateDeviceForAccess({ project, access, deviceId, deviceName, res })
  } catch (error) {
    console.error('VALIDATE ERROR:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
