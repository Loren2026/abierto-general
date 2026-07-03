const { config } = require('../config/env');

const CLAUDE_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const BROKER_TARIFF_PROMPT = `Analiza este documento de un broker de inversión (Interactive Brokers u otro).
Extrae TODAS las tarifas y comisiones que encuentres. Responde SOLO con un JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "Comisión compra/venta acciones US": "valor",
  "Comisión compra/venta acciones EU": "valor",
  "Comisión compra/venta acciones UK": "valor",
  "Comisión cambio divisa": "valor",
  "Custodia mensual": "valor",
  "Comisión inactividad": "valor",
  "Comisión retiro": "valor",
  "Otros gastos": "valor"
}
Si un campo no aparece en el documento, pon "No especificado". Si encuentras tarifas adicionales no listadas, añádelas como nuevas claves. Valores siempre con moneda (€, $, %, etc).`;

async function extractBrokerTariffs(file) {
  if (!config.claudeApiKey) {
    const error = new Error('CLAUDE_API_KEY is not configured');
    error.status = 503;
    throw error;
  }

  console.log('[broker-tariffs] calling Claude', {
    model: config.claudeModel,
    mimetype: file.mimetype,
    size: file.size
  });

  const response = await fetch(CLAUDE_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.claudeApiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.claudeModel,
      max_tokens: 1800,
      messages: [{ role: 'user', content: buildContent(file) }]
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(`Claude request failed with status ${response.status}`);
    error.status = response.status;
    error.provider = 'claude';
    error.providerStatus = response.status;
    error.providerBody = payload;
    throw error;
  }

  const text = Array.isArray(payload.content)
    ? payload.content.map((part) => part.text || '').join('\n').trim()
    : '';

  console.log('[broker-tariffs] Claude response received', {
    textBytes: Buffer.byteLength(text, 'utf8'),
    stopReason: payload.stop_reason
  });

  return parseTariffJson(text);
}

function buildContent(file) {
  const base64 = file.buffer.toString('base64');
  const source = { type: 'base64', media_type: file.mimetype, data: base64 };
  const documentPart = file.mimetype === 'application/pdf'
    ? { type: 'document', source }
    : { type: 'image', source };
  return [documentPart, { type: 'text', text: BROKER_TARIFF_PROMPT }];
}

function parseTariffJson(text) {
  const raw = String(text || '').trim();
  const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  const candidate = start >= 0 && end > start ? clean.slice(start, end + 1) : clean;

  try {
    return JSON.parse(candidate);
  } catch (error) {
    const parseError = new Error('Claude returned non-parseable broker tariff JSON');
    parseError.status = 502;
    parseError.provider = 'claude';
    parseError.providerBody = raw.slice(0, 1200);
    throw parseError;
  }
}

module.exports = { extractBrokerTariffs };
