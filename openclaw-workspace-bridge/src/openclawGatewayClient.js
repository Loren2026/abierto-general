import WebSocket from 'ws'
import crypto from 'node:crypto'

const DEFAULT_GATEWAY_URL = 'ws://127.0.0.1:18789'
const DEFAULT_TIMEOUT_MS = 120_000

function safeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function extractTextFromUnknown(value) {
  if (!value || typeof value !== 'object') return safeText(value)

  const direct = [
    value.text,
    value.message,
    value.deltaText,
    value.content,
    value.body,
    value.output?.text,
    value.result?.text,
    value.result?.output?.text,
  ].map(safeText).find(Boolean)

  if (direct) return direct

  if (Array.isArray(value.messages)) {
    const found = [...value.messages].reverse().map(extractTextFromUnknown).find(Boolean)
    if (found) return found
  }

  if (Array.isArray(value.output?.messages)) {
    const found = [...value.output.messages].reverse().map(extractTextFromUnknown).find(Boolean)
    if (found) return found
  }

  return ''
}

function isAssistantLike(payload = {}) {
  const role = payload.role || payload.authorRole || payload.author?.role || payload.message?.role || payload.message?.authorRole
  const type = payload.type || payload.kind || payload.message?.type || payload.message?.kind
  return role === 'assistant' || role === 'turin' || type === 'assistant' || type === 'assistant.message'
}

function eventMatchesSession(message, sessionKey) {
  const payload = message.payload || {}
  return payload.sessionKey === sessionKey
    || payload.session?.key === sessionKey
    || payload.key === sessionKey
    || payload.message?.sessionKey === sessionKey
}

export class OpenClawGatewayClient {
  constructor({ url = DEFAULT_GATEWAY_URL, token, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.url = url
    this.token = token
    this.timeoutMs = timeoutMs
    this.ws = null
    this.nextRequestId = 1
    this.pending = new Map()
    this.assistantTexts = []
    this.runId = null
  }

  async connect() {
    if (!this.token) throw Object.assign(new Error('OPENCLAW_GATEWAY_TOKEN no configurado en el bridge.'), { statusCode: 503 })

    this.ws = new WebSocket(this.url)

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout abriendo WebSocket con OpenClaw Gateway.')), 10_000)
      this.ws.once('open', () => {
        clearTimeout(timeout)
        resolve()
      })
      this.ws.once('error', reject)
    })

    this.ws.on('message', (raw) => this.handleMessage(raw))
    this.ws.on('close', () => this.rejectAll(new Error('OpenClaw Gateway cerró la conexión.')))

    await this.request('connect', {
      minProtocol: 4,
      maxProtocol: 4,
      client: {
        id: 'gateway-client',
        displayName: 'InteligenciaLoren Workspace Bridge',
        version: '0.1.0',
        platform: 'node',
        mode: 'backend',
        instanceId: crypto.randomUUID(),
      },
      role: 'operator',
      scopes: ['operator.read', 'operator.write'],
      caps: ['tool-events'],
      auth: { token: this.token },
      locale: 'es-ES',
      userAgent: 'openclaw-workspace-bridge/0.1.0',
    }, { timeoutMs: 15_000 })
  }

  close() {
    this.ws?.close()
    this.ws = null
  }

  handleMessage(raw) {
    let message
    try {
      message = JSON.parse(String(raw))
    } catch {
      return
    }

    if (message.type === 'res' && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id)
      this.pending.delete(message.id)
      clearTimeout(pending.timeout)

      if (message.ok) pending.resolve(message.payload)
      else pending.reject(Object.assign(new Error(message.error?.message || 'Gateway request failed'), {
        gatewayCode: message.error?.code,
        details: message.error?.details,
      }))
      return
    }

    if (message.type === 'event') this.handleEvent(message)
  }

  handleEvent(message) {
    const payload = message.payload || {}
    if (payload.runId && !this.runId) this.runId = payload.runId
    if (payload.id && String(message.event || '').includes('run')) this.runId ||= payload.id

    const text = extractTextFromUnknown(payload)
    if (text && isAssistantLike(payload)) this.assistantTexts.push(text)
  }

  rejectAll(error) {
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timeout)
      pending.reject(error)
      this.pending.delete(id)
    }
  }

  request(method, params = {}, { timeoutMs = this.timeoutMs } = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket con OpenClaw Gateway no está abierto.'))
    }

    const id = `workspace-bridge-${this.nextRequestId++}`
    const frame = { type: 'req', id, method, params }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Timeout esperando respuesta Gateway para ${method}.`))
      }, timeoutMs)

      this.pending.set(id, { resolve, reject, timeout })
      this.ws.send(JSON.stringify(frame), (error) => {
        if (!error) return
        clearTimeout(timeout)
        this.pending.delete(id)
        reject(error)
      })
    })
  }

  async sendWorkspaceMessage({ threadId, messageId, body }) {
    const sessionKey = `workspace-thread:${threadId}`
    const idempotencyKey = `workspace-message:${messageId}`

    const sendResult = await this.request('chat.send', {
      sessionKey,
      message: body,
      deliver: false,
      idempotencyKey,
    })

    this.runId = sendResult?.runId || sendResult?.id || sendResult?.taskId || this.runId

    if (this.runId) {
      try {
        const waitResult = await this.request('agent.wait', { runId: this.runId }, { timeoutMs: this.timeoutMs })
        const waitedText = extractTextFromUnknown(waitResult)
        if (waitedText) {
          return { text: waitedText, runId: this.runId, status: waitResult?.status || 'completed', sessionKey }
        }
      } catch (error) {
        // Fall through to event-based collection. Some Gateway versions may not
        // expose agent.wait for chat.send results in the same shape.
      }
    }

    const immediateText = extractTextFromUnknown(sendResult)
    if (immediateText) return { text: immediateText, runId: this.runId, status: 'completed', sessionKey }

    const eventText = await this.waitForAssistantText(sessionKey)
    return { text: eventText, runId: this.runId, status: 'completed', sessionKey }
  }

  waitForAssistantText(sessionKey) {
    const startedAt = Date.now()

    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        const lastText = this.assistantTexts.at(-1)
        if (lastText) {
          clearInterval(interval)
          resolve(lastText)
          return
        }

        if (Date.now() - startedAt > this.timeoutMs) {
          clearInterval(interval)
          reject(new Error(`Timeout esperando respuesta de Turín para ${sessionKey}.`))
        }
      }, 250)
    })
  }
}

export async function sendMessageThroughGateway({ gatewayUrl, gatewayToken, timeoutMs, threadId, messageId, body }) {
  const client = new OpenClawGatewayClient({ url: gatewayUrl, token: gatewayToken, timeoutMs })
  try {
    await client.connect()
    return await client.sendWorkspaceMessage({ threadId, messageId, body })
  } finally {
    client.close()
  }
}
