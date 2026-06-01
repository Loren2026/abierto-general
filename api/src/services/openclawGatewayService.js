const DEFAULT_BRIDGE_TIMEOUT_MS = 120_000

function isEnabled(value) {
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value || '').toLowerCase())
}

function resolveBridgeConfig() {
  return {
    enabled: isEnabled(process.env.WORKSPACE_TURIN_GATEWAY_ENABLED),
    url: process.env.WORKSPACE_BRIDGE_URL,
    token: process.env.WORKSPACE_BRIDGE_TOKEN,
    timeoutMs: Number.parseInt(process.env.WORKSPACE_BRIDGE_TIMEOUT_MS || `${DEFAULT_BRIDGE_TIMEOUT_MS}`, 10),
  }
}

function buildBridgeError(message, statusCode, code) {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  return error
}

export function getWorkspaceGatewayStatus() {
  const config = resolveBridgeConfig()

  return {
    enabled: config.enabled,
    configured: Boolean(config.url && config.token),
    timeoutMs: config.timeoutMs,
  }
}

export async function sendWorkspaceMessageToGateway({ threadId, messageId, body }) {
  const config = resolveBridgeConfig()

  if (!config.enabled) {
    throw buildBridgeError('El puente Workspace ↔ Turín está desactivado.', 503, 'WORKSPACE_GATEWAY_DISABLED')
  }

  if (!config.url) {
    throw buildBridgeError('WORKSPACE_BRIDGE_URL no está configurado en el backend.', 503, 'WORKSPACE_BRIDGE_URL_MISSING')
  }

  if (!config.token) {
    throw buildBridgeError('WORKSPACE_BRIDGE_TOKEN no está configurado en el backend.', 503, 'WORKSPACE_BRIDGE_TOKEN_MISSING')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const response = await fetch(`${config.url.replace(/\/$/, '')}/workspace-chat/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ threadId, messageId, body }),
      signal: controller.signal,
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw buildBridgeError(
        data.error || 'Error hablando con el puente interno de OpenClaw.',
        response.status,
        data.code || 'WORKSPACE_BRIDGE_ERROR',
      )
    }

    if (!data.text?.trim()) {
      throw buildBridgeError('El puente interno no devolvió texto de respuesta.', 502, 'WORKSPACE_BRIDGE_EMPTY_RESPONSE')
    }

    return {
      text: data.text.trim(),
      runId: data.runId || null,
      status: data.status || null,
      sessionKey: data.sessionKey || `workspace-thread:${threadId}`,
      usage: data.usage || null,
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw buildBridgeError('Timeout esperando respuesta del puente interno de OpenClaw.', 504, 'WORKSPACE_BRIDGE_TIMEOUT')
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}
