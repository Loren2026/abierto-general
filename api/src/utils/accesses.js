export function validateCreateAccessPayload(payload = {}) {
  const personName = payload.personName?.toString().trim()
  if (!personName) return 'personName is required'

  if (payload.trialDays !== undefined && payload.trialDays !== null && payload.trialDays !== '') {
    const trialDays = Number(payload.trialDays)
    if (!Number.isInteger(trialDays) || trialDays <= 0) {
      return 'trialDays must be a positive integer'
    }
  }

  return null
}

export function sanitizeAccessRecord(record) {
  if (!record) return null

  return {
    id: record.id,
    projectId: record.project_id,
    accessRequestId: record.access_request_id,
    personName: record.person_name,
    status: record.status,
    notes: record.notes,
    passwordLastGeneratedAt: record.password_last_generated_at,
    sentAt: record.sent_at,
    activatedAt: record.activated_at,
    expiresAt: record.expires_at,
    trialDays: record.trial_days,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    revokedAt: record.revoked_at,
  }
}
