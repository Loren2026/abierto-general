async function readJson(response) {
  return response.json().catch(() => ({}))
}

async function workspaceDocumentsFetch(session, path, options = {}) {
  const headers = {
    Authorization: `Bearer ${session?.accessToken}`,
    ...(options.headers || {}),
  }

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(path, {
    ...options,
    headers,
  })

  const data = await readJson(response)

  if (!response.ok) {
    throw new Error(data.error || 'No se pudo cargar el material del workspace.')
  }

  return data
}

export async function listWorkspaceDocuments(session) {
  const data = await workspaceDocumentsFetch(session, '/api/admin/workspace/documents')
  return data.documents || []
}

export async function createWorkspaceDocumentSignedUrl(session, path) {
  const data = await workspaceDocumentsFetch(session, '/api/admin/workspace/signed-url', {
    method: 'POST',
    body: JSON.stringify({ path }),
  })

  if (!data.signedUrl) {
    throw new Error('El backend no devolvió una URL firmada para este documento.')
  }

  return data.signedUrl
}
