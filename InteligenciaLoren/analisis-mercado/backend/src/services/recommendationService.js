const { fetchFmp } = require('./fmpService');
const { analyzeWithClaude } = require('./claudeService');

const KNOWN_MARKET_COSTS = {
  UK: [{ name: 'UK Stamp Duty', side: 'compra', rate: 0.005 }],
  ES: [{ name: 'FTT española', side: 'compra', rate: 0.002 }],
  FR: [{ name: 'FTT francesa', side: 'compra', rate: 0.003 }],
  IT: [{ name: 'FTT italiana', side: 'compra', rate: 0.001 }]
};

const MOCK_SYMBOLS = {
  AAPL: {
    quote: [{ symbol: 'AAPL', price: 190.12, marketCap: 2910000000000, volume: 50000000, exchange: 'NASDAQ' }],
    incomeStatement: [{ date: '2025-09-30', revenue: 391035000000, netIncome: 93736000000, eps: 6.08 }],
    balanceSheet: [{ date: '2025-09-30', totalAssets: 364980000000, totalLiabilities: 308030000000, totalStockholdersEquity: 56950000000 }],
    cashFlow: [{ date: '2025-09-30', operatingCashFlow: 118254000000, freeCashFlow: 108807000000 }]
  }
};

async function analyzeRecommendations({ symbol, symbols, useMock = false, dryRun = false }) {
  const requestedSymbols = normalizeSymbols(symbol, symbols);
  if (requestedSymbols.length === 0) {
    const error = new Error('Body must include symbol or symbols');
    error.status = 400;
    throw error;
  }

  const results = [];
  for (const currentSymbol of requestedSymbols) {
    results.push(await analyzeOneSymbol(currentSymbol, { useMock, dryRun }));
  }

  return Array.isArray(symbols) ? { status: 'ok', results } : { status: 'ok', ...results[0] };
}

async function analyzeOneSymbol(symbol, { useMock, dryRun }) {
  const rawData = useMock ? getMockData(symbol) : await getFmpData(symbol);
  const normalized = normalizeFinancialData(symbol, rawData);
  const prompt = buildRecommendationPrompt(normalized);

  if (useMock && dryRun) {
    return {
      symbol,
      mock: true,
      dryRun: true,
      datos_clave: normalized.datos_clave,
      costes_estimados: normalized.costes_estimados,
      prompt_preview: prompt.slice(0, 1200)
    };
  }

  const claudeResult = await analyzeWithClaude({ prompt, context: normalized, maxTokens: 1400 });
  const parsed = parseClaudeJson(claudeResult.analysis);

  return {
    symbol,
    recomendacion: normalizeRecommendation(parsed.recomendacion),
    confianza: normalizeConfidence(parsed.confianza),
    razonamiento: parsed.razonamiento || 'Claude no devolvió razonamiento estructurado.',
    riesgos: Array.isArray(parsed.riesgos) ? parsed.riesgos : [],
    datos_clave: normalized.datos_clave,
    costes_estimados: normalized.costes_estimados
  };
}

async function getFmpData(symbol) {
  const [quote, incomeStatement, balanceSheet, cashFlow] = await Promise.all([
    fetchFmp('quote', symbol),
    fetchFmp('incomeStatement', symbol, { period: 'annual', limit: '5' }),
    fetchFmp('balanceSheet', symbol, { period: 'annual', limit: '5' }),
    fetchFmp('cashFlow', symbol, { period: 'annual', limit: '5' })
  ]);

  return { quote, incomeStatement, balanceSheet, cashFlow };
}

function getMockData(symbol) {
  const data = MOCK_SYMBOLS[symbol.toUpperCase()];
  if (!data) {
    const error = new Error(`No mock data available for ${symbol}`);
    error.status = 404;
    throw error;
  }
  return data;
}

function normalizeSymbols(symbol, symbols) {
  const values = Array.isArray(symbols) ? symbols : [symbol];
  return values
    .filter(Boolean)
    .map((value) => String(value).trim().toUpperCase())
    .filter(Boolean);
}

function normalizeFinancialData(symbol, rawData) {
  const quote = first(rawData.quote);
  const income = first(rawData.incomeStatement);
  const balance = first(rawData.balanceSheet);
  const cash = first(rawData.cashFlow);

  if (!quote || Object.keys(quote).length === 0) {
    const error = new Error(`FMP did not return quote data for ${symbol}`);
    error.status = 404;
    throw error;
  }

  const market = inferMarket(quote);

  return {
    symbol,
    mercado_detectado: market || 'desconocido',
    datos_clave: {
      precio_actual: numberOrNull(quote.price),
      capitalizacion: numberOrNull(quote.marketCap),
      volumen: numberOrNull(quote.volume),
      exchange: quote.exchange || quote.exchangeShortName || null,
      moneda: quote.currency || null,
      fecha_estado_resultados: income?.date || null,
      ingresos: numberOrNull(income?.revenue),
      beneficio_neto: numberOrNull(income?.netIncome),
      eps: numberOrNull(income?.eps),
      fecha_balance: balance?.date || null,
      activos_totales: numberOrNull(balance?.totalAssets),
      pasivos_totales: numberOrNull(balance?.totalLiabilities),
      patrimonio: numberOrNull(balance?.totalStockholdersEquity),
      fecha_cash_flow: cash?.date || null,
      flujo_caja_operativo: numberOrNull(cash?.operatingCashFlow),
      flujo_caja_libre: numberOrNull(cash?.freeCashFlow)
    },
    costes_estimados: estimateCosts(market)
  };
}

function estimateCosts(market) {
  if (!market || !KNOWN_MARKET_COSTS[market]) {
    return {
      estado: 'no_calculado',
      motivo: 'Mercado no identificado o sin tasas autorizadas/documentadas en Fase 3.',
      tasas_aplicadas: []
    };
  }

  return {
    estado: 'calculado_parcial',
    advertencia: 'Incluye solo impuestos proporcionados explícitamente por Loren; no incluye comisión concreta del broker si no está configurada.',
    tasas_aplicadas: KNOWN_MARKET_COSTS[market].map((item) => ({
      nombre: item.name,
      lado: item.side,
      porcentaje: item.rate,
      descripcion: `${(item.rate * 100).toFixed(2)}% en ${item.side}`
    }))
  };
}

function inferMarket(quote) {
  const exchange = String(quote.exchangeShortName || quote.exchange || '').toUpperCase();
  const symbol = String(quote.symbol || '').toUpperCase();

  if (exchange.includes('LSE') || exchange.includes('LONDON') || symbol.endsWith('.L')) return 'UK';
  if (exchange.includes('BME') || exchange.includes('MADRID') || symbol.endsWith('.MC')) return 'ES';
  if (exchange.includes('PARIS') || exchange.includes('EURONEXT PARIS') || symbol.endsWith('.PA')) return 'FR';
  if (exchange.includes('MILAN') || exchange.includes('BORSA') || symbol.endsWith('.MI')) return 'IT';
  return null;
}

function buildRecommendationPrompt(normalized) {
  return `Eres un analista financiero prudente. Devuelve SOLO JSON válido, sin markdown ni texto adicional, con este esquema exacto: {"recomendacion":"comprar|vender|mantener","confianza":0-100,"razonamiento":"texto breve","riesgos":["riesgo 1"]}. Evalúa la acción con los datos disponibles y contempla el coste total de operar. No inventes métricas ni tasas: si faltan datos, dilo en riesgos o razonamiento. Datos normalizados: ${JSON.stringify(normalized)}`;
}

function parseClaudeJson(text) {
  const raw = String(text || '').trim();
  const candidate = extractJson(raw);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    const parseError = new Error('Claude returned non-parseable recommendation JSON');
    parseError.status = 502;
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

function normalizeRecommendation(value) {
  const normalized = String(value || '').toLowerCase();
  return ['comprar', 'vender', 'mantener'].includes(normalized) ? normalized : 'mantener';
}

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

module.exports = { analyzeRecommendations, normalizeFinancialData, estimateCosts, parseClaudeJson };
