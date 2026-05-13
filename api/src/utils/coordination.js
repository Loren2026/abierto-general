const THREAD_STATUSES = ['open', 'pending_review', 'blocked', 'closed', 'archived']
const THREAD_PRIORITIES = ['low', 'normal', 'high', 'urgent']
const THREAD_ORIGINS = ['internal', 'loren', 'turin', 'claude', 'system']
const CREATED_BY_TYPES = ['human', 'assistant', 'system']
const MESSAGE_TYPES = ['message', 'note', 'proposal', 'decision', 'system']
const AUTHOR_TYPES = ['human', 'assistant', 'system']
const AUTHOR_ROLES = ['loren', 'turin', 'claude', 'system']
const MESSAGE_FORMATS = ['plain_text', 'markdown', 'json']
const MESSAGE_VISIBILITIES = ['internal', 'loren_only', 'system']
const CONSULTATION_TYPES = ['review', 'proposal', 'risk_check', 'decision_request', 'clarification']
const CONSULTATION_ROLES = ['loren', 'turin', 'claude', 'system']
const CONSULTATION_TARGET_ROLES = ['loren', 'turin', 'claude']
const CONSULTATION_STATUSES = ['pending', 'answered', 'cancelled', 'superseded']
const RESOLVABLE_CONSULTATION_STATUSES = ['answered', 'cancelled', 'superseded']
const APPROVAL_TYPES = ['operational', 'scope', 'production', 'closure', 'protocol_exception']
const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'revoked', 'expired']
const APPROVAL_REQUESTER_ROLES = ['turin', 'claude', 'system']
const APPROVAL_APPROVER_ROLES = ['loren']
const RESOLVABLE_APPROVAL_STATUSES = ['approved', 'rejected', 'revoked', 'expired']

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

function pickString(value) {
  if (value === undefined || value === null) return null
  const normalized = value.toString().trim()
  return normalized || null
}

function ensureAllowed(value, allowed, fieldName) {
  if (value === undefined || value === null) return null
  if (!allowed.includes(value)) return `${fieldName} is invalid`
  return null
}

export function parseListParams(query = {}, defaultLimit = 20, maxLimit = 100) {
  const limit = Math.min(parsePositiveInt(query.limit, defaultLimit), maxLimit)
  const offset = parsePositiveInt(query.offset, 0)
  return { limit, offset }
}

export function validateThreadPayload(payload = {}) {
  const title = pickString(payload.title)
  const createdByType = pickString(payload.createdByType)
  const createdByLabel = pickString(payload.createdByLabel)

  if (!title) return 'title is required'
  if (!createdByType) return 'createdByType is required'
  if (!createdByLabel) return 'createdByLabel is required'

  const checks = [
    ensureAllowed(payload.status ?? 'open', THREAD_STATUSES, 'status'),
    ensureAllowed(payload.priority ?? 'normal', THREAD_PRIORITIES, 'priority'),
    ensureAllowed(payload.origin ?? 'internal', THREAD_ORIGINS, 'origin'),
    ensureAllowed(createdByType, CREATED_BY_TYPES, 'createdByType'),
  ].filter(Boolean)

  if (payload.projectId && !isUuid(payload.projectId)) return 'projectId must be a valid uuid'
  if (checks.length) return checks[0]
  return null
}

export function buildThreadInsert(payload = {}) {
  return {
    project_id: pickString(payload.projectId),
    thread_key: pickString(payload.threadKey),
    title: pickString(payload.title),
    summary: pickString(payload.summary),
    status: pickString(payload.status) || 'open',
    priority: pickString(payload.priority) || 'normal',
    origin: pickString(payload.origin) || 'internal',
    created_by_type: pickString(payload.createdByType),
    created_by_label: pickString(payload.createdByLabel),
    assigned_to: pickString(payload.assignedTo),
    metadata: typeof payload.metadata === 'object' && payload.metadata !== null ? payload.metadata : {},
  }
}

export function validateMessagePayload(payload = {}) {
  const authorType = pickString(payload.authorType)
  const authorRole = pickString(payload.authorRole)
  const authorLabel = pickString(payload.authorLabel)
  const body = pickString(payload.body)

  if (!authorType) return 'authorType is required'
  if (!authorRole) return 'authorRole is required'
  if (!authorLabel) return 'authorLabel is required'
  if (!body) return 'body is required'

  const checks = [
    ensureAllowed(payload.messageType ?? 'message', MESSAGE_TYPES, 'messageType'),
    ensureAllowed(authorType, AUTHOR_TYPES, 'authorType'),
    ensureAllowed(authorRole, AUTHOR_ROLES, 'authorRole'),
    ensureAllowed(payload.bodyFormat ?? 'plain_text', MESSAGE_FORMATS, 'bodyFormat'),
    ensureAllowed(payload.visibility ?? 'internal', MESSAGE_VISIBILITIES, 'visibility'),
  ].filter(Boolean)

  if (payload.parentMessageId && !isUuid(payload.parentMessageId)) return 'parentMessageId must be a valid uuid'
  if (checks.length) return checks[0]
  return null
}

export function buildMessageInsert(threadId, payload = {}) {
  return {
    thread_id: threadId,
    message_type: pickString(payload.messageType) || 'message',
    author_type: pickString(payload.authorType),
    author_role: pickString(payload.authorRole),
    author_label: pickString(payload.authorLabel),
    body: pickString(payload.body),
    body_format: pickString(payload.bodyFormat) || 'plain_text',
    visibility: pickString(payload.visibility) || 'internal',
    parent_message_id: pickString(payload.parentMessageId),
    is_actionable: Boolean(payload.isActionable),
    requires_response: Boolean(payload.requiresResponse),
    metadata: typeof payload.metadata === 'object' && payload.metadata !== null ? payload.metadata : {},
  }
}

export function validateConsultationPayload(payload = {}) {
  const requestedByRole = pickString(payload.requestedByRole)
  const requestedToRole = pickString(payload.requestedToRole)
  const question = pickString(payload.question)

  if (!requestedByRole) return 'requestedByRole is required'
  if (!requestedToRole) return 'requestedToRole is required'
  if (!question) return 'question is required'
  if (requestedByRole === requestedToRole) return 'requestedByRole cannot match requestedToRole'

  const checks = [
    ensureAllowed(payload.consultationType ?? 'review', CONSULTATION_TYPES, 'consultationType'),
    ensureAllowed(requestedByRole, CONSULTATION_ROLES, 'requestedByRole'),
    ensureAllowed(requestedToRole, CONSULTATION_TARGET_ROLES, 'requestedToRole'),
  ].filter(Boolean)

  if (payload.messageId && !isUuid(payload.messageId)) return 'messageId must be a valid uuid'
  if (checks.length) return checks[0]
  return null
}

export function buildConsultationInsert(threadId, payload = {}) {
  return {
    thread_id: threadId,
    message_id: pickString(payload.messageId),
    consultation_type: pickString(payload.consultationType) || 'review',
    requested_by_role: pickString(payload.requestedByRole),
    requested_to_role: pickString(payload.requestedToRole),
    status: 'pending',
    question: pickString(payload.question),
    metadata: typeof payload.metadata === 'object' && payload.metadata !== null ? payload.metadata : {},
  }
}

export function validateConsultationResponsePayload(payload = {}) {
  const status = pickString(payload.status)
  if (!status) return 'status is required'
  const invalid = ensureAllowed(status, RESOLVABLE_CONSULTATION_STATUSES, 'status')
  if (invalid) return invalid
  return null
}

export function buildConsultationResponseUpdate(payload = {}) {
  return {
    status: pickString(payload.status),
    response_text: pickString(payload.responseText),
    responded_at: new Date().toISOString(),
    metadata: typeof payload.metadata === 'object' && payload.metadata !== null ? payload.metadata : {},
  }
}

export function validateApprovalPayload(payload = {}) {
  const requestedByRole = pickString(payload.requestedByRole)
  const approverRole = pickString(payload.approverRole)
  const requestedAction = pickString(payload.requestedAction)

  if (!requestedByRole) return 'requestedByRole is required'
  if (!approverRole) return 'approverRole is required'
  if (!requestedAction) return 'requestedAction is required'

  const checks = [
    ensureAllowed(payload.approvalType ?? 'operational', APPROVAL_TYPES, 'approvalType'),
    ensureAllowed(requestedByRole, APPROVAL_REQUESTER_ROLES, 'requestedByRole'),
    ensureAllowed(approverRole, APPROVAL_APPROVER_ROLES, 'approverRole'),
  ].filter(Boolean)

  if (payload.messageId && !isUuid(payload.messageId)) return 'messageId must be a valid uuid'
  if (payload.consultationId && !isUuid(payload.consultationId)) return 'consultationId must be a valid uuid'
  if (checks.length) return checks[0]
  return null
}

export function buildApprovalInsert(threadId, payload = {}) {
  return {
    thread_id: threadId,
    message_id: pickString(payload.messageId),
    consultation_id: pickString(payload.consultationId),
    approval_type: pickString(payload.approvalType) || 'operational',
    status: 'pending',
    requested_by_role: pickString(payload.requestedByRole),
    approver_role: pickString(payload.approverRole),
    requested_action: pickString(payload.requestedAction),
    metadata: typeof payload.metadata === 'object' && payload.metadata !== null ? payload.metadata : {},
  }
}

export function validateApprovalResponsePayload(payload = {}) {
  const status = pickString(payload.status)
  if (!status) return 'status is required'
  const invalid = ensureAllowed(status, RESOLVABLE_APPROVAL_STATUSES, 'status')
  if (invalid) return invalid
  return null
}

export function buildApprovalResponseUpdate(payload = {}) {
  const status = pickString(payload.status)
  const now = new Date().toISOString()
  return {
    status,
    decision_note: pickString(payload.decisionNote),
    decided_at: now,
    revoked_at: status === 'revoked' ? now : null,
    expires_at: status === 'expired' ? now : null,
    metadata: typeof payload.metadata === 'object' && payload.metadata !== null ? payload.metadata : {},
  }
}

export function mapThread(row) {
  if (!row) return null
  return {
    id: row.id,
    projectId: row.project_id,
    threadKey: row.thread_key,
    title: row.title,
    summary: row.summary,
    status: row.status,
    priority: row.priority,
    origin: row.origin,
    createdByType: row.created_by_type,
    createdByLabel: row.created_by_label,
    assignedTo: row.assigned_to,
    lastMessageAt: row.last_message_at,
    closedAt: row.closed_at,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapMessage(row) {
  if (!row) return null
  return {
    id: row.id,
    threadId: row.thread_id,
    messageType: row.message_type,
    authorType: row.author_type,
    authorRole: row.author_role,
    authorLabel: row.author_label,
    body: row.body,
    bodyFormat: row.body_format,
    visibility: row.visibility,
    parentMessageId: row.parent_message_id,
    isActionable: row.is_actionable,
    requiresResponse: row.requires_response,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapConsultation(row) {
  if (!row) return null
  return {
    id: row.id,
    threadId: row.thread_id,
    messageId: row.message_id,
    consultationType: row.consultation_type,
    requestedByRole: row.requested_by_role,
    requestedToRole: row.requested_to_role,
    status: row.status,
    question: row.question,
    responseText: row.response_text,
    requestedAt: row.requested_at,
    respondedAt: row.responded_at,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapApproval(row) {
  if (!row) return null
  return {
    id: row.id,
    threadId: row.thread_id,
    messageId: row.message_id,
    consultationId: row.consultation_id,
    approvalType: row.approval_type,
    status: row.status,
    requestedByRole: row.requested_by_role,
    approverRole: row.approver_role,
    requestedAction: row.requested_action,
    decisionNote: row.decision_note,
    requestedAt: row.requested_at,
    decidedAt: row.decided_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export {
  THREAD_STATUSES,
  THREAD_PRIORITIES,
  CONSULTATION_STATUSES,
  APPROVAL_STATUSES,
}
