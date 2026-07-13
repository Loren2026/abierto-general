const CBOE_OPTIONS_BASE_URL = 'https://cdn.cboe.com/api/global/delayed_quotes/options';
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

const cache = new Map();

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, '');
}

function parseOccSymbol(value) {
  const raw = String(value || '').trim().toUpperCase();
  const match = raw.match(/^([A-Z0-9.\-]+)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
  if (!match) return null;

  const [, underlying, yy, mm, dd, type, strikeRaw] = match;
  const year = 2000 + Number(yy);
  const month = Number(mm);
  const day = Number(dd);
  const strike = Number(strikeRaw) / 1000;
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(strike)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return {
    underlying,
    expiration: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    type: type === 'C' ? 'call' : 'put',
    strike
  };
}

function readNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOption(item) {
  const parsed = parseOccSymbol(item?.option);
  if (!parsed || parsed.type !== 'call') return null;

  return {
    contractSymbol: String(item.option).trim().toUpperCase(),
    underlying: parsed.underlying,
    expiration: parsed.expiration,
    type: parsed.type,
    strike: parsed.strike,
    bid: readNumber(item.bid),
    bidSize: readNumber(item.bid_size),
    ask: readNumber(item.ask),
    askSize: readNumber(item.ask_size),
    last: readNumber(item.last_trade_price),
    volume: readNumber(item.volume),
    openInterest: readNumber(item.open_interest),
    impliedVolatility: readNumber(item.iv),
    delta: readNumber(item.delta),
    gamma: readNumber(item.gamma),
    theta: readNumber(item.theta),
    vega: readNumber(item.vega),
    rho: readNumber(item.rho),
    theoretical: readNumber(item.theo),
    change: readNumber(item.change),
    percentChange: readNumber(item.percent_change),
    lastTradeTime: item.last_trade_time || null
  };
}

function normalizeCboePayload(symbol, payload, expirationFilter) {
  const data = payload?.data;
  if (!data || !Array.isArray(data.options)) {
    throw new Error('CBOE no devolvió una cadena de opciones válida.');
  }

  const calls = data.options
    .map(normalizeOption)
    .filter(Boolean)
    .filter((item) => !expirationFilter || item.expiration === expirationFilter)
    .sort((a, b) => a.expiration.localeCompare(b.expiration) || a.strike - b.strike);

  if (calls.length < 1) {
    throw new Error(expirationFilter ? `CBOE no devolvió calls para ${symbol} con vencimiento ${expirationFilter}.` : `CBOE no devolvió calls para ${symbol}.`);
  }

  const expirations = [...new Set(calls.map((item) => item.expiration))];

  return {
    symbol,
    source: 'CBOE',
    delayed: true,
    fetchedAt: new Date().toISOString(),
    cboeTimestamp: payload?.timestamp || null,
    underlyingPrice: readNumber(data.current_price),
    expirations,
    calls
  };
}

async function fetchOptionsChain(symbolInput, { expiration } = {}) {
  const symbol = normalizeSymbol(symbolInput);
  if (!symbol) {
    const error = new Error('Ticker inválido.');
    error.statusCode = 400;
    throw error;
  }

  const expirationFilter = expiration ? String(expiration).trim() : '';
  const cacheKey = `${symbol}|${expirationFilter}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { ...cached.value, cache: { hit: true, ttlSeconds: Math.max(0, Math.round((CACHE_TTL_MS - (Date.now() - cached.cachedAt)) / 1000)) } };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${CBOE_OPTIONS_BASE_URL}/${encodeURIComponent(symbol)}.json`, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'analisis-mercado/1.0' }
    });
  } catch (err) {
    const error = new Error(err.name === 'AbortError' ? 'CBOE no respondió a tiempo.' : 'No se pudo conectar con CBOE.');
    error.statusCode = 502;
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const error = new Error(`CBOE devolvió HTTP ${response.status}. Cadena no disponible.`);
    error.statusCode = 502;
    throw error;
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    const error = new Error('CBOE devolvió una respuesta que no es JSON válido.');
    error.statusCode = 502;
    throw error;
  }

  const normalized = normalizeCboePayload(symbol, payload, expirationFilter);
  cache.set(cacheKey, { cachedAt: Date.now(), value: normalized });
  return { ...normalized, cache: { hit: false, ttlSeconds: Math.round(CACHE_TTL_MS / 1000) } };
}

module.exports = { fetchOptionsChain, parseOccSymbol };
