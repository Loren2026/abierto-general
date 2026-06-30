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

export async function getControlMapState(req, res) {
  try {
    const statePath = await resolveStatePath()
    const rawState = await readFile(statePath, 'utf8')
    const state = JSON.parse(rawState)

    return res.json(state)
  } catch (error) {
    console.error('Error leyendo estado del mapa de control:', error)
    return res.status(500).json({ error: 'No se pudo leer el estado del mapa de control' })
  }
}
