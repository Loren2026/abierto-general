import crypto from 'crypto'

const DOWNLOAD_TOKEN_TTL_MS = 5 * 60 * 1000

function getDownloadTokenSecret() {
  return process.env.DOWNLOAD_TOKEN_SECRET || process.env.JWT_SECRET || 'change-me-download-secret'
}

export function createDownloadToken(payload) {
  const expiresAt = Date.now() + DOWNLOAD_TOKEN_TTL_MS
  const body = {
    ...payload,
    exp: expiresAt,
  }

  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', getDownloadTokenSecret())
    .update(encoded)
    .digest('base64url')

  return {
    token: `${encoded}.${signature}`,
    expiresAt: new Date(expiresAt).toISOString(),
  }
}

export function verifyDownloadToken(token) {
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) {
    throw new Error('invalid download token')
  }

  const expectedSignature = crypto
    .createHmac('sha256', getDownloadTokenSecret())
    .update(encoded)
    .digest('base64url')

  if (signature !== expectedSignature) {
    throw new Error('invalid download token')
  }

  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  if (!payload.exp || payload.exp < Date.now()) {
    throw new Error('download token expired')
  }

  return payload
}

export function buildInvalidDownloadResponse() {
  return { error: 'invalid credentials or unauthorized device' }
}
