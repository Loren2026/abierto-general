async function readJson(response) {
  return response.json().catch(() => ({}))
}

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    searchParams.set(key, value)
  })

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export async function coordinationFetch(session, path, options = {}) {
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
    throw new Error(data.error || 'Error en coordinación')
  }

  return data
}

export function listWorkspaceProjects(session) {
  return coordinationFetch(session, '/api/admin/projects')
}

export function listThreads(session, params = {}) {
  return coordinationFetch(session, `/api/admin/coordination/threads${buildQuery(params)}`)
}

export function createThread(session, payload) {
  return coordinationFetch(session, '/api/admin/coordination/threads', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listThreadMessages(session, threadId, params = {}) {
  return coordinationFetch(session, `/api/admin/coordination/threads/${threadId}/messages${buildQuery(params)}`)
}

export function createThreadMessage(session, threadId, payload) {
  return coordinationFetch(session, `/api/admin/coordination/threads/${threadId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteThreadMessage(session, messageId) {
  return coordinationFetch(session, `/api/admin/coordination/messages/${messageId}`, {
    method: 'DELETE',
  })
}

export function listThreadConsultations(session, threadId, params = {}) {
  return coordinationFetch(session, `/api/admin/coordination/threads/${threadId}/consultations${buildQuery(params)}`)
}

export function createThreadConsultation(session, threadId, payload) {
  return coordinationFetch(session, `/api/admin/coordination/threads/${threadId}/consultations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function respondConsultation(session, consultationId, payload) {
  return coordinationFetch(session, `/api/admin/coordination/consultations/${consultationId}/respond`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
