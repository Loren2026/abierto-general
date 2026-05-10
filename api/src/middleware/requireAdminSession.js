import { resolveSessionUser } from './requireSession.js'

export async function requireAdminSession(req, res, next) {
  const accessToken = req.headers.authorization?.replace('Bearer ', '')

  if (!accessToken) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  const user = await resolveSessionUser(accessToken)

  if (!user) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  req.user = user
  next()
}
