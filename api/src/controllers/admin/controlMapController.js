import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const defaultStatePath = path.resolve(process.cwd(), 'data/mapa-control/estado.json')
const fallbackStatePath = path.resolve(process.cwd(), '../data/mapa-control/estado.json')
const defaultCredentialsPath = path.resolve(process.cwd(), 'data/mapa-control/credentials.enc.json')
const fallbackCredentialsPath = path.resolve(process.cwd(), '../data/mapa-control/credentials.enc.json')

async function resolvePath(configKey, defaultPath, fallbackPath) {
  const configuredPath = process.env[configKey]
  const candidates = [configuredPath, defaultPath, fallbackPath].filter(Boolean)

  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // try next candidate
    }
  }

  return configuredPath || defaultPath
}

async function resolveStatePath() {
  return resolvePath('CONTROL_MAP_STATE_PATH', defaultStatePath, fallbackStatePath)
}

async function resolveCredentialsPath() {
  return resolvePath('CONTROL_MAP_CREDENTIALS_PATH', defaultCredentialsPath, fallbackCredentialsPath)
}

function validateControlMapState(state) {
  const warnings = []

  if (!state?.meta?.fecha) {
    warnings.push('meta.fecha ausente')
  }

  if (!Array.isArray(state?.ecosistema?.children) || state.ecosistema.children.length === 0) {
    warnings.push('ecosistema.children ausente o vacío')
  }

  if (Object.prototype.hasOwnProperty.call(state?.ecosistema || {}, 'bloques')) {
    warnings.push('ecosistema.bloques existe en raíz; los bloques principales deben vivir en ecosistema.children')
  }

  for (const [index, child] of (state?.ecosistema?.children || []).entries()) {
    if (!child?.id) warnings.push(`ecosistema.children[${index}].id ausente`)
    if (!child?.name) warnings.push(`ecosistema.children[${index}].name ausente`)
  }

  return warnings
}

export async function getControlMapState(req, res) {
  try {
    const statePath = await resolveStatePath()
    const rawState = await readFile(statePath, 'utf8')
    const state = JSON.parse(rawState)
    const warnings = validateControlMapState(state)

    if (warnings.length) {
      console.warn('Advertencias del estado del mapa de control:', { statePath, warnings })
    }

    return res.json(state)
  } catch (error) {
    console.error('Error leyendo estado del mapa de control:', error)
    return res.status(500).json({ error: 'No se pudo leer el estado del mapa de control' })
  }
}


export async function getControlMapCredentials(req, res) {
  try {
    const credentialsPath = await resolveCredentialsPath()
    const rawCredentials = await readFile(credentialsPath, 'utf8')
    const credentials = JSON.parse(rawCredentials)

    return res.json(credentials)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'No hay credenciales cifradas configuradas' })
    }

    console.error('Error leyendo credenciales cifradas del mapa de control:', error)
    return res.status(500).json({ error: 'No se pudieron leer las credenciales cifradas' })
  }
}

export async function putControlMapCredentials(req, res) {
  try {
    const credentialsPath = await resolveCredentialsPath()
    const rawCredentials = JSON.stringify(req.body || {}, null, 2)

    await mkdir(path.dirname(credentialsPath), { recursive: true })
    await writeFile(credentialsPath, `${rawCredentials}
`, { encoding: 'utf8', mode: 0o600 })

    console.info('Blob cifrado de credenciales del mapa de control guardado', {
      bytes: Buffer.byteLength(rawCredentials, 'utf8'),
      updatedAt: new Date().toISOString(),
    })

    return res.json({ status: 'ok' })
  } catch (error) {
    console.error('Error guardando credenciales cifradas del mapa de control:', error)
    return res.status(500).json({ error: 'No se pudieron guardar las credenciales cifradas' })
  }
}


export async function deleteControlMapCredentials(req, res) {
  try {
    const credentialsPath = await resolveCredentialsPath()
    await unlink(credentialsPath)

    console.info('Blob cifrado de credenciales del mapa de control eliminado', {
      updatedAt: new Date().toISOString(),
    })

    return res.json({ status: 'ok' })
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'No hay credenciales cifradas configuradas' })
    }

    console.error('Error eliminando credenciales cifradas del mapa de control:', error)
    return res.status(500).json({ error: 'No se pudieron eliminar las credenciales cifradas' })
  }
}
