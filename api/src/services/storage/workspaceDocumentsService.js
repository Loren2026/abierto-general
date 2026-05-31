import { supabaseAdmin } from '../../config/supabase.js'

const WORKSPACE_BUCKET = 'projects'
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 10

function getDocumentType(name) {
  const extension = name.split('.').pop()?.toUpperCase()
  return extension && extension !== name.toUpperCase() ? extension : 'FILE'
}

function isValidWorkspacePath(path) {
  if (typeof path !== 'string') return false
  const trimmedPath = path.trim()

  if (!trimmedPath || trimmedPath !== path) return false
  if (trimmedPath.startsWith('/') || trimmedPath.startsWith('\\')) return false
  if (trimmedPath.includes('..')) return false
  if (trimmedPath.includes('\\')) return false
  if (trimmedPath.split('/').some((segment) => !segment || segment === '.' || segment === '..')) return false

  return true
}

function formatDocument(file, prefix = '') {
  const path = prefix ? `${prefix}/${file.name}` : file.name

  return {
    id: path,
    name: file.name,
    type: getDocumentType(file.name),
    path,
    source: WORKSPACE_BUCKET,
    size: file.metadata?.size || 0,
    updatedAt: file.updated_at || file.created_at || null,
  }
}

export async function listWorkspaceDocuments() {
  const { data, error } = await supabaseAdmin.storage
    .from(WORKSPACE_BUCKET)
    .list('', {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    })

  if (error) {
    throw new Error(error.message || 'No se pudo cargar el material del workspace.')
  }

  return (data || [])
    .filter((item) => item.id && item.name)
    .map((item) => formatDocument(item))
}

export async function createWorkspaceDocumentSignedUrl(path) {
  if (!isValidWorkspacePath(path)) {
    const error = new Error('Ruta de documento no válida.')
    error.status = 400
    throw error
  }

  const { data, error } = await supabaseAdmin.storage
    .from(WORKSPACE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_IN_SECONDS)

  if (error) {
    throw new Error(error.message || 'No se pudo abrir el documento.')
  }

  if (!data?.signedUrl) {
    throw new Error('Supabase no devolvió una URL firmada para este documento.')
  }

  return data.signedUrl
}
