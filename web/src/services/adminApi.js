import { supabase } from './supabase'

export async function readJson(response) {
  return response.json().catch(() => ({}))
}

export async function adminApiFetch(session, path, options = {}) {
  const { data: authData } = await supabase.auth.getSession()
  const accessToken = authData.session?.access_token || session?.accessToken

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    ...(options.headers || {}),
  }

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(path, { ...options, headers })
  const data = await readJson(response)
  if (!response.ok) throw new Error(data.error || 'Error en administración')
  return data
}
