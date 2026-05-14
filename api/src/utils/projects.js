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

export function validateCreateProjectPayload(payload = {}) {
  const slug = normalizeProjectSlug(payload.slug)
  const name = payload.name?.toString().trim()
  const sourceType = payload.sourceType?.toString().trim()
  const sourceFileId = payload.sourceFileId?.toString().trim()

  if (!slug) return 'slug is required'
  if (!name) return 'name is required'
  if (!sourceType) return 'sourceType is required'
  if (sourceType !== 'onedrive') return 'sourceType must be onedrive'
  if (!sourceFileId) return 'sourceFileId is required'

  return null
}

export function buildProjectInsert(payload = {}) {
  return {
    slug: normalizeProjectSlug(payload.slug),
    name: payload.name.trim(),
    description: payload.description?.toString().trim() || null,
    image_url: payload.imageUrl?.toString().trim() || null,
    status: 'private',
    version: payload.version?.toString().trim() || '1.0.0',
    update_message: payload.updateMessage?.toString().trim() || null,
    source_type: 'onedrive',
    source_file_id: payload.sourceFileId.trim(),
    source_path: payload.sourcePath?.toString().trim() || null,
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
