const { config } = require('../config/env');

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';

const endpointMap = {
  quote: 'quote',
  incomeStatement: 'income-statement',
  balanceSheet: 'balance-sheet-statement',
  cashFlow: 'cash-flow-statement'
};

async function fetchFmp(endpointKey, symbol, extraParams = {}) {
  if (!config.fmpApiKey) {
    const error = new Error('FMP_API_KEY is not configured');
    error.status = 503;
    throw error;
  }

  const endpoint = endpointMap[endpointKey];
  if (!endpoint) {
    const error = new Error('Unsupported FMP endpoint');
    error.status = 400;
    throw error;
  }

  const params = new URLSearchParams({
    symbol,
    ...extraParams,
    apikey: config.fmpApiKey
  });

  const response = await fetch(`${FMP_BASE_URL}/${endpoint}?${params.toString()}`);
  const contentType = response.headers.get('content-type') || '';
  const rawPayload = contentType.includes('application/json') ? await response.json() : await response.text();
  const payload = rawPayload;

  if (!contentType.includes('application/json')) {
    const error = new Error('Símbolo no disponible en tu plan de FMP');
    error.status = response.ok ? 422 : response.status;
    error.providerPayload = sanitizeProviderPayload(payload);
    throw error;
  }

  if (!response.ok || (payload && payload.Error)) {
    const error = new Error(payload && payload.Error ? 'Símbolo no disponible en tu plan de FMP' : `FMP request failed with status ${response.status}`);
    error.status = payload && payload.Error && response.ok ? 422 : response.status;
    error.providerPayload = sanitizeProviderPayload(payload);
    throw error;
  }

  return payload;
}

function sanitizeProviderPayload(payload) {
  if (typeof payload === 'string') return payload.slice(0, 500);
  return payload;
}

module.exports = { fetchFmp };
