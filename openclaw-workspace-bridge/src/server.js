import http from 'node:http'
import { sendMessageThroughGateway } from './openclawGatewayClient.js'

const DEFAULT_PORT = 8789
const DEFAULT_GATEWAY_URL = 'ws://127.0.0.1:18789'
const DEFAULT_TIMEOUT_MS = 120_000
const MAX_BODY_BYTES = 64 * 1024

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      raw += chunk
      if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request demasiado grande.'), { statusCode: 413 }))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(Object.assign(new Error('JSON inválido.'), { statusCode: 400 }))
      }
    })
    req.on('error', reject)
  })
}

function requireBridgeToken(req) {
  const expected = process.env.WORKSPACE_BRIDGE_TOKEN
  if (!expected) throw Object.assign(new Error('WORKSPACE_BRIDGE_TOKEN no configurado en el puente.'), { statusCode: 503 })

  const authorization = req.headers.authorization || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : ''
  if (!token || token !== expected) throw Object.assign(new Error('No autorizado.'), { statusCode: 401 })
}

function validateSendPayload(payload = {}) {
  const threadId = payload.threadId?.toString().trim()
  const messageId = payload.messageId?.toString().trim()
  const body = payload.body?.toString().trim()

  if (!threadId) throw Object.assign(new Error('threadId is required'), { statusCode: 400 })
  if (!messageId) throw Object.assign(new Error('messageId is required'), { statusCode: 400 })
  if (!body) throw Object.assign(new Error('body is required'), { statusCode: 400 })

  return { threadId, messageId, body }
}

async function handleSend(req, res) {
  requireBridgeToken(req)
  const payload = validateSendPayload(await readJsonBody(req))

  const result = await sendMessageThroughGateway({
    gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || DEFAULT_GATEWAY_URL,
    gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN,
    timeoutMs: Number.parseInt(process.env.OPENCLAW_GATEWAY_TIMEOUT_MS || `${DEFAULT_TIMEOUT_MS}`, 10),
    ...payload,
  })

  json(res, 200, {
    text: result.text,
    runId: result.runId || null,
    status: result.status || null,
    sessionKey: result.sessionKey,
  })
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      json(res, 200, {
        ok: true,
        service: 'openclaw-workspace-bridge',
        gatewayConfigured: Boolean(process.env.OPENCLAW_GATEWAY_TOKEN),
        bridgeTokenConfigured: Boolean(process.env.WORKSPACE_BRIDGE_TOKEN),
      })
      return
    }

    if (req.method === 'POST' && req.url === '/workspace-chat/send') {
      await handleSend(req, res)
      return
    }

    json(res, 404, { error: 'not found' })
  } catch (error) {
    json(res, error.statusCode || 500, {
      error: error.message || 'Internal bridge error',
      code: error.code || error.gatewayCode,
    })
  }
})

server.listen(Number.parseInt(process.env.PORT || `${DEFAULT_PORT}`, 10), '0.0.0.0', () => {
  console.log('openclaw-workspace-bridge listening')
})
