import { supabaseAdmin } from '../../config/supabase.js'
import { compareProjectPassword } from '../../utils/passwords.js'
import {
  buildInvalidDownloadResponse,
  createDownloadToken,
  verifyDownloadToken,
} from '../../utils/downloads.js'
import { normalizeProjectSlug } from '../../utils/projects.js'
import { downloadPrivateObject } from '../../services/storage/supabaseStorageService.js'

function handleSupabaseError(error, res) {
  if (!error) return false
  res.status(500).json({ error: error.message || 'Internal server error' })
  return true
}

async function findMatchingAccess(projectId, password) {
  const { data, error } = await supabaseAdmin
    .from('project_accesses')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) throw error

  for (const access of data || []) {
    const matches = await compareProjectPassword(password, access.password_hash)
    if (matches) return access
  }

  return null
}

async function findActiveDevice(accessId, deviceId) {
  const { data, error } = await supabaseAdmin
    .from('project_devices')
    .select('*')
    .eq('project_access_id', accessId)
    .eq('status', 'active')
    .eq('device_id', deviceId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function requestDownload(req, res) {
  const slug = normalizeProjectSlug(req.params.slug)
  const password = req.body?.password?.toString() || ''
  const deviceId = req.body?.deviceId?.toString().trim() || ''

  if (!password || !deviceId) {
    return res.status(400).json({ error: 'password and deviceId are required' })
  }

  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('status', 'public')
    .eq('slug', slug)
    .maybeSingle()

  if (handleSupabaseError(projectError, res)) return
  if (!project || project.source_type !== 'supabase' || !project.source_file_id) {
    return res.status(404).json({ error: 'project not found' })
  }

  try {
    const access = await findMatchingAccess(project.id, password)
    if (!access) {
      return res.status(401).json(buildInvalidDownloadResponse())
    }

    const device = await findActiveDevice(access.id, deviceId)
    if (!device) {
      return res.status(401).json(buildInvalidDownloadResponse())
    }

    const { data: downloadLog, error: logError } = await supabaseAdmin
      .from('download_logs')
      .insert({
        project_id: project.id,
        project_access_id: access.id,
        project_device_id: device.id,
        action_type: 'request_download',
        result: 'authorized',
      })
      .select('id')
      .single()

    if (handleSupabaseError(logError, res)) return

    const { token, expiresAt } = createDownloadToken({
      projectId: project.id,
      accessId: access.id,
      deviceId: device.id,
      storagePath: project.source_file_id,
      logId: downloadLog.id,
    })

    return res.json({ ok: true, downloadToken: token, expiresAt })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}

export async function downloadByToken(req, res) {
  let payload

  try {
    payload = verifyDownloadToken(req.params.token)
  } catch (error) {
    return res.status(401).json({ error: error.message })
  }

  try {
    const { data: logRecord, error: logError } = await supabaseAdmin
      .from('download_logs')
      .select('*')
      .eq('id', payload.logId)
      .maybeSingle()

    if (handleSupabaseError(logError, res)) return
    if (!logRecord) return res.status(404).json({ error: 'download log not found' })

    const file = await downloadPrivateObject(payload.storagePath)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const filename = payload.storagePath.split('/').pop() || 'download.bin'
    const contentType = file.type || 'application/octet-stream'

    await supabaseAdmin
      .from('download_logs')
      .insert({
        project_id: payload.projectId,
        project_access_id: payload.accessId,
        project_device_id: payload.deviceId,
        action_type: 'download',
        result: 'completed',
      })

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.send(buffer)
  } catch (error) {
    if (payload?.logId) {
      await supabaseAdmin
        .from('download_logs')
        .insert({
          project_id: payload.projectId,
          project_access_id: payload.accessId,
          project_device_id: payload.deviceId,
          action_type: 'download',
          result: 'failed',
        })
    }

    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
