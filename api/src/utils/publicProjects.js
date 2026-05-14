export function sanitizeAdminProject(record) {
  if (!record) return null

  return {
    ...record,
    redirectUrl: record.redirect_url ?? null,
  }
}

export function sanitizePublicProject(record) {
  if (!record) return null

  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    description: record.description,
    imageUrl: record.image_url,
    redirectUrl: record.redirect_url ?? null,
    version: record.version,
    updateMessage: record.update_message,
    publishedAt: record.published_at,
  }
}
