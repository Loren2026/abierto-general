import { supabaseAdmin } from '../../config/supabase.js'
import { sanitizeAccessRecord } from '../../utils/accesses.js'
import { sanitizeAccessRequestRecord } from '../../utils/accessRequests.js'
import { sanitizeDeviceRecord } from '../../utils/devices.js'

function byCreatedAtAsc(a, b) {
  return new Date(a.at || 0).getTime() - new Date(b.at || 0).getTime()
}

function buildTimeline({ request, access, devices = [], downloads = [], revocations = [] }) {
  const events = []

  if (request?.created_at) events.push({ type: 'request_created', label: 'Solicitud recibida', at: request.created_at })
  if (request?.handled_at) events.push({ type: `request_${request.status}`, label: `Solicitud ${request.status}`, at: request.handled_at })
  if (access?.created_at) events.push({ type: 'access_generated', label: 'Código generado', at: access.created_at })
  if (access?.sent_at) events.push({ type: 'access_sent', label: 'Código marcado como enviado', at: access.sent_at })
  if (access?.activated_at) events.push({ type: 'access_activated', label: 'Código activado', at: access.activated_at })

  for (const device of devices) {
    if (device.first_seen_at) events.push({ type: 'device_linked', label: 'Dispositivo vinculado', at: device.first_seen_at, deviceId: device.id })
    if (device.revoked_at) events.push({ type: 'device_revoked', label: 'Dispositivo revocado', at: device.revoked_at, deviceId: device.id })
  }

  for (const log of downloads) {
    events.push({ type: 'download_log', label: `Descarga: ${log.result}`, at: log.created_at, actionType: log.action_type })
  }

  for (const log of revocations) {
    events.push({ type: 'revocation', label: `Revocación: ${log.revocation_type}`, at: log.created_at, notes: log.notes })
  }

  if (access?.revoked_at) events.push({ type: 'access_revoked', label: 'Código revocado', at: access.revoked_at })

  return events.sort(byCreatedAtAsc)
}

export async function listInvitationLifecycle(req, res) {
  try {
    let requestQuery = supabaseAdmin
      .from('access_requests')
      .select('*, projects(id, slug, name, status)')
      .order('created_at', { ascending: false })
      .limit(Math.min(Number(req.query.limit) || 100, 250))

    if (req.query.projectId) requestQuery = requestQuery.eq('project_id', req.query.projectId)
    if (req.query.status) requestQuery = requestQuery.eq('status', req.query.status)
    if (req.query.dateFrom) requestQuery = requestQuery.gte('created_at', req.query.dateFrom)
    if (req.query.dateTo) requestQuery = requestQuery.lte('created_at', req.query.dateTo)

    const { data: requests, error: requestError } = await requestQuery
    if (requestError) throw requestError

    const accessIds = (requests || []).map((item) => item.created_project_access_id).filter(Boolean)
    let accesses = []
    let devices = []
    let downloads = []
    let revocations = []

    if (accessIds.length > 0) {
      const [accessResult, deviceResult, downloadResult, revocationResult] = await Promise.all([
        supabaseAdmin.from('project_accesses').select('*').in('id', accessIds),
        supabaseAdmin.from('project_devices').select('*').in('project_access_id', accessIds),
        supabaseAdmin.from('download_logs').select('*').in('project_access_id', accessIds).order('created_at', { ascending: true }),
        supabaseAdmin.from('revocation_logs').select('*').in('project_access_id', accessIds).order('created_at', { ascending: true }),
      ])

      if (accessResult.error) throw accessResult.error
      if (deviceResult.error) throw deviceResult.error
      if (downloadResult.error) throw downloadResult.error
      if (revocationResult.error) throw revocationResult.error

      accesses = accessResult.data || []
      devices = deviceResult.data || []
      downloads = downloadResult.data || []
      revocations = revocationResult.data || []
    }

    const accessById = new Map(accesses.map((access) => [access.id, access]))
    const devicesByAccessId = Map.groupBy ? Map.groupBy(devices, (device) => device.project_access_id) : devices.reduce((map, item) => {
      const list = map.get(item.project_access_id) || []
      list.push(item)
      map.set(item.project_access_id, list)
      return map
    }, new Map())
    const downloadsByAccessId = downloads.reduce((map, item) => {
      const list = map.get(item.project_access_id) || []
      list.push(item)
      map.set(item.project_access_id, list)
      return map
    }, new Map())
    const revocationsByAccessId = revocations.reduce((map, item) => {
      const list = map.get(item.project_access_id) || []
      list.push(item)
      map.set(item.project_access_id, list)
      return map
    }, new Map())

    const items = (requests || []).map((request) => {
      const access = accessById.get(request.created_project_access_id) || null
      const requestDevices = access ? (devicesByAccessId.get(access.id) || []) : []
      const requestDownloads = access ? (downloadsByAccessId.get(access.id) || []) : []
      const requestRevocations = access ? (revocationsByAccessId.get(access.id) || []) : []

      return {
        accessRequest: sanitizeAccessRequestRecord(request),
        access: sanitizeAccessRecord(access),
        devices: requestDevices.map(sanitizeDeviceRecord),
        downloadLogs: requestDownloads,
        revocationLogs: requestRevocations,
        timeline: buildTimeline({ request, access, devices: requestDevices, downloads: requestDownloads, revocations: requestRevocations }),
      }
    })

    return res.json({ items })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
