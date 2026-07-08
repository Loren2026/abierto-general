import { access, readFile } from 'node:fs/promises'
import path from 'node:path'

const defaultStatePath = path.resolve(process.cwd(), 'data/mapa-control/estado.json')
const fallbackStatePath = path.resolve(process.cwd(), '../data/mapa-control/estado.json')

async function resolveStatePath() {
  const configuredPath = process.env.CONTROL_MAP_STATE_PATH
  const candidates = [configuredPath, defaultStatePath, fallbackStatePath].filter(Boolean)

  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // try next candidate
    }
  }

  return configuredPath || defaultStatePath
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
