const REQUEST_STATUSES = new Set(['requested', 'reviewing', 'approved', 'rejected', 'code_generated', 'code_sent', 'cancelled'])

export function normalizeEmail(value) {
  return value?.toString().trim().toLowerCase() || ''
}

export function validatePublicAccessRequestPayload(payload = {}) {
  if (payload.website?.toString().trim()) return 'spam detected'

  const fullName = payload.fullName?.toString().trim() || ''
  const email = normalizeEmail(payload.email)
  const phone = payload.phone?.toString().trim() || ''
  const privacyAccepted = payload.privacyAccepted === true

  if (fullName.split(/\s+/).filter(Boolean).length < 2) return 'fullName must include name and surname'
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'valid email is required'
  if (!phone) return 'phone is required'
  if (!privacyAccepted) return 'privacyAccepted is required'

  return null
}

export function validateUpdateAccessRequestPayload(payload = {}) {
  if (payload.status !== undefined && !REQUEST_STATUSES.has(payload.status)) return 'invalid status'
  return null
}

export function sanitizeAccessRequestRecord(record) {
  if (!record) return null

  return {
    id: record.id,
    projectId: record.project_id,
    project: record.projects ? {
      id: record.projects.id,
      slug: record.projects.slug,
      name: record.projects.name,
      status: record.projects.status,
    } : undefined,
    fullName: record.full_name,
    email: record.email,
    phone: record.phone,
    message: record.message,
    status: record.status,
    source: record.source,
    emailSent: record.email_sent,
    emailSentAt: record.email_sent_at,
    handledBy: record.handled_by,
    handledAt: record.handled_at,
    createdProjectAccessId: record.created_project_access_id,
    rejectionReason: record.rejection_reason,
    internalNotes: record.internal_notes,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}
