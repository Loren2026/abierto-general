const { config } = require('../config/env');

const CLAUDE_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const IBKR_IMPORT_PROMPT = `Extrae posiciones del informe IBKR y devuelve SOLO JSON válido con este esquema fijo: { "positions": [{ "symbol": "string", "quantity": number, "avgPrice": number|null, "currency": "string", "marketValueOrigin": number, "marketValueEur": number, "unrealizedPnLOrigin": number, "unrealizedPnLEur": number }], "cash": [{ "currency": "string", "amount": number }], "fees": number|null, "dividends": number|null, "reportDate": "YYYY-MM-DD|null" }. IMPORTANTE: Lee las columnas del Open Position Summary: "Value" es el importe en la divisa original de la posición (USD/GBP/CAD), "Base Value" o "Total in EUR" es el valor en euros. NO las confundas. Usa marketValueOrigin para el valor en divisa original y marketValueEur para el valor en EUR (columna Base Value). Lo mismo para PnL: unrealizedPnLOrigin (divisa original) y unrealizedPnLEur (EUR). No incluyas markdown, explicaciones, comentarios ni texto fuera del JSON. Si un dato no aparece, usa null o array vacío.`;

async function importIbkrReport(file) {
  if (!config.claudeApiKey) {
    const error = new Error('CLAUDE_API_KEY is not configured');
    error.status = 503;
    throw error;
  }

  const content = buildClaudeContent(file);

  console.log('[ibkr-import] calling Claude', {
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
      max_tokens: 2500,
      messages: [
        {
          role: 'user',
          content
        }
      ]
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

  console.log('[ibkr-import] Claude response received', {
    textBytes: Buffer.byteLength(text, 'utf8'),
    stopReason: payload.stop_reason
  });

  return parseClaudeIbkrJson(text);
}

function buildClaudeContent(file) {
  const base64 = file.buffer.toString('base64');

  if (file.mimetype === 'application/pdf') {
    return [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64
        }
      },
      {
        type: 'text',
        text: IBKR_IMPORT_PROMPT
      }
    ];
  }

  return [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: file.mimetype,
        data: base64
      }
    },
    {
      type: 'text',
      text: IBKR_IMPORT_PROMPT
    }
  ];
}

function parseClaudeIbkrJson(text) {
  const raw = String(text || '').trim();
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const candidate = extractJson(cleaned);

  try {
    const parsed = JSON.parse(candidate);
    return normalizeIbkrResult(parsed);
  } catch (error) {
    const parseError = new Error('Claude returned non-parseable IBKR JSON');
    parseError.status = 502;
    parseError.provider = 'claude';
    parseError.providerBody = raw.slice(0, 1200);
    throw parseError;
  }
}

function extractJson(text) {
  if (text.startsWith('{') && text.endsWith('}')) return text;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

function normalizeIbkrResult(value) {
  return {
    positions: Array.isArray(value.positions) ? value.positions : [],
    cash: Array.isArray(value.cash) ? value.cash : [],
    fees: numberOrNull(value.fees),
    dividends: numberOrNull(value.dividends),
    reportDate: value.reportDate || null
  };
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

module.exports = { importIbkrReport, parseClaudeIbkrJson };
