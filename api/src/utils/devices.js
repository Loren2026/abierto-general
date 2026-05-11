export function validateDevicePayload(payload = {}) {
  const deviceId = payload.deviceId?.toString().trim()
  const deviceName = payload.deviceName?.toString().trim()

  if (!deviceId) return 'deviceId is required'
  if (!deviceName) return 'deviceName is required'

  return null
}

export function sanitizeDeviceRecord(record) {
  if (!record) return null

  return {
    id: record.id,
    accessId: record.project_access_id,
    deviceId: record.device_id,
    deviceName: record.device_name,
    platform: record.platform,
    status: record.status,
    notes: record.notes,
    activatedAt: record.activated_at,
    revokedAt: record.revoked_at,
    updatedAt: record.updated_at,
  }
}
