export function normalizeProjectSlug(value = '') {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const SUPPORTED_SOURCE_TYPES = new Set(['onedrive', 'webapp', 'external_url'])

export function validateCreateProjectPayload(payload = {}) {
  const slug = normalizeProjectSlug(payload.slug)
  const name = payload.name?.toString().trim()
  const sourceType = payload.sourceType?.toString().trim()
  const sourceFileId = payload.sourceFileId?.toString().trim()
  const redirectUrl = payload.redirectUrl?.toString().trim()

  if (!slug) return 'slug is required'
  if (!name) return 'name is required'
  if (!sourceType) return 'sourceType is required'
  if (!SUPPORTED_SOURCE_TYPES.has(sourceType)) return 'sourceType must be onedrive, webapp or external_url'
  if (sourceType === 'onedrive' && !sourceFileId) return 'sourceFileId is required'
  if ((sourceType === 'webapp' || sourceType === 'external_url') && !redirectUrl) return 'redirectUrl is required'

  return null
}

export function buildProjectInsert(payload = {}) {
  const sourceType = payload.sourceType?.toString().trim()
  const isWebapp = sourceType === 'webapp' || sourceType === 'external_url'

  return {
    slug: normalizeProjectSlug(payload.slug),
    name: payload.name.trim(),
    description: payload.description?.toString().trim() || null,
    image_url: payload.imageUrl?.toString().trim() || null,
    redirect_url: payload.redirectUrl?.toString().trim() || null,
    status: 'private',
    version: payload.version?.toString().trim() || '1.0.0',
    update_message: payload.updateMessage?.toString().trim() || null,
    source_type: isWebapp ? sourceType : 'onedrive',
    source_file_id: isWebapp ? null : payload.sourceFileId.trim(),
    source_path: isWebapp ? null : (payload.sourcePath?.toString().trim() || null),
  }
}

export function buildProjectUpdate(payload = {}) {
  const update = {}

  if (payload.name !== undefined) update.name = payload.name?.toString().trim() || null
  if (payload.description !== undefined) update.description = payload.description?.toString().trim() || null
  if (payload.imageUrl !== undefined) update.image_url = payload.imageUrl?.toString().trim() || null
  if (payload.redirectUrl !== undefined) update.redirect_url = payload.redirectUrl?.toString().trim() || null
  if (payload.version !== undefined) update.version = payload.version?.toString().trim() || null
  if (payload.updateMessage !== undefined) update.update_message = payload.updateMessage?.toString().trim() || null
  if (payload.sourceFileId !== undefined) update.source_file_id = payload.sourceFileId?.toString().trim() || null
  if (payload.sourcePath !== undefined) update.source_path = payload.sourcePath?.toString().trim() || null

  return update
}
