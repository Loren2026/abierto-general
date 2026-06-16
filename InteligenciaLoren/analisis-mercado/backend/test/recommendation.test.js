const test = require('node:test');
const assert = require('node:assert/strict');

process.env.FMP_API_KEY = 'test_fmp_key';
process.env.CLAUDE_API_KEY = 'test_claude_key';
process.env.PORT = '3999';

const { analyzeRecommendations, normalizeFinancialData, parseClaudeJson } = require('../src/services/recommendationService');
const { publicError } = require('../src/utils/errorResponse');

test('mock explícito dryRun no llama a proveedores y devuelve prompt', async () => {
  const result = await analyzeRecommendations({ symbol: 'AAPL', useMock: true, dryRun: true });
  assert.equal(result.status, 'ok');
  assert.equal(result.mock, true);
  assert.equal(result.dryRun, true);
  assert.match(result.prompt_preview, /Datos normalizados/);
});

test('datos vacíos de FMP producen error honesto de símbolo sin datos', () => {
  assert.throws(
    () => normalizeFinancialData('ZZZZ', { quote: [], incomeStatement: [], balanceSheet: [], cashFlow: [] }),
    /FMP did not return quote data/
  );
});

test('parsea JSON de Claude aunque venga envuelto en texto', () => {
  const parsed = parseClaudeJson('Respuesta:\n{"recomendacion":"mantener","confianza":61,"razonamiento":"prudencia","riesgos":[]}');
  assert.equal(parsed.recomendacion, 'mantener');
  assert.equal(parsed.confianza, 61);
});

test('mapea rate limit a mensaje público claro', () => {
  const err = new Error('FMP request failed with status 429');
  err.status = 429;
  const response = publicError(err, 'Recommendation analysis error', 'recommendations');
  assert.equal(response.status, 429);
  assert.match(response.body.message, /rate limit/i);
});

test('mock FMP + mock Claude vía fetch global genera recomendación real de backend', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const value = String(url);
    if (value.includes('financialmodelingprep.com')) {
      if (value.includes('/quote?')) return jsonResponse([{ symbol: 'AAPL', price: 190, marketCap: 1, volume: 2, exchange: 'NASDAQ' }]);
      if (value.includes('/income-statement?')) return jsonResponse([{ date: '2025', revenue: 100, netIncome: 10, eps: 1 }]);
      if (value.includes('/balance-sheet-statement?')) return jsonResponse([{ date: '2025', totalAssets: 200, totalLiabilities: 50, totalStockholdersEquity: 150 }]);
      if (value.includes('/cash-flow-statement?')) return jsonResponse([{ date: '2025', operatingCashFlow: 20, freeCashFlow: 15 }]);
    }
    if (value.includes('api.anthropic.com')) {
      return jsonResponse({ content: [{ text: '{"recomendacion":"comprar","confianza":72,"razonamiento":"datos suficientes","riesgos":["volatilidad"]}' }] });
    }
    throw new Error(`Unexpected fetch ${value}`);
  };

  try {
    const result = await analyzeRecommendations({ symbol: 'AAPL' });
    assert.equal(result.status, 'ok');
    assert.equal(result.recomendacion, 'comprar');
    assert.equal(result.confianza, 72);
  } finally {
    global.fetch = originalFetch;
  }
});

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => payload,
    text: async () => JSON.stringify(payload)
  };
}
