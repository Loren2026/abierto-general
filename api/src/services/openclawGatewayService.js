const DEFAULT_GATEWAY_URL = 'ws://127.0.0.1:18789'
const DEFAULT_AGENT_ID = 'main'
const DEFAULT_TIMEOUT_MS = 120_000

function isEnabled(value) {
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value || '').toLowerCase())
}

function buildSessionKey(threadId) {
  return `workspace-thread:${threadId}`
}

function resolveGatewayConfig() {
  return {
    enabled: isEnabled(process.env.WORKSPACE_TURIN_GATEWAY_ENABLED),
    url: process.env.OPENCLAW_GATEWAY_URL || DEFAULT_GATEWAY_URL,
    token: process.env.OPENCLAW_GATEWAY_TOKEN,
    agentId: process.env.OPENCLAW_WORKSPACE_AGENT_ID || DEFAULT_AGENT_ID,
    timeoutMs: Number.parseInt(process.env.OPENCLAW_GATEWAY_TIMEOUT_MS || `${DEFAULT_TIMEOUT_MS}`, 10),
  }
}

function normalizeGatewayError(error) {
  if (error?.code === 'ERR_MODULE_NOT_FOUND' || error?.code === 'MODULE_NOT_FOUND') {
    return new Error('@openclaw/sdk no está instalado en el backend. Pendiente de instalar dependencia antes de activar F2.')
  }

  return error instanceof Error ? error : new Error('Error desconocido hablando con OpenClaw Gateway')
}

function extractResultText(result) {
  if (typeof result?.output?.text === 'string' && result.output.text.trim()) {
    return result.output.text.trim()
  }

  const lastTextMessage = [...(result?.output?.messages || [])]
    .reverse()
    .find((message) => typeof message?.text === 'string' && message.text.trim())

  if (lastTextMessage) return lastTextMessage.text.trim()

  if (typeof result?.text === 'string' && result.text.trim()) return result.text.trim()

  return ''
}

export function getWorkspaceGatewayStatus() {
  const config = resolveGatewayConfig()

  return {
    enabled: config.enabled,
    configured: Boolean(config.token),
    url: config.url,
    agentId: config.agentId,
    timeoutMs: config.timeoutMs,
  }
}

export async function sendWorkspaceMessageToGateway({ threadId, messageId, body }) {
  const config = resolveGatewayConfig()

  if (!config.enabled) {
    const error = new Error('El puente Workspace ↔ Turín está desactivado.')
    error.statusCode = 503
    error.code = 'WORKSPACE_GATEWAY_DISABLED'
    throw error
  }

  if (!config.token) {
    const error = new Error('OPENCLAW_GATEWAY_TOKEN no está configurado en el backend.')
    error.statusCode = 503
    error.code = 'OPENCLAW_GATEWAY_TOKEN_MISSING'
    throw error
  }

  try {
    const { OpenClaw } = await import('@openclaw/sdk')
    const oc = new OpenClaw({
      url: config.url,
      token: config.token,
      requestTimeoutMs: Math.min(config.timeoutMs, 30_000),
    })

    await oc.connect()

    const sessionKey = buildSessionKey(threadId)
    const agent = await oc.agents.get(config.agentId)
    const run = await agent.run({
      input: body,
      sessionKey,
      timeoutMs: config.timeoutMs,
      metadata: {
        source: 'inteligencialoren-workspace',
        threadId,
        messageId,
        idempotencyKey: `workspace-message:${messageId}`,
      },
      idempotencyKey: `workspace-message:${messageId}`,
    })

    const result = await run.wait({ timeoutMs: config.timeoutMs })
    const text = extractResultText(result)

    if (!text) {
      const error = new Error('OpenClaw Gateway no devolvió texto de respuesta.')
      error.statusCode = 502
      error.code = 'OPENCLAW_EMPTY_RESPONSE'
      error.result = result
      throw error
    }

    return {
      text,
      runId: result?.runId || run?.id || null,
      status: result?.status || null,
      sessionKey,
      usage: result?.usage || null,
    }
  } catch (error) {
    throw normalizeGatewayError(error)
  }
}
