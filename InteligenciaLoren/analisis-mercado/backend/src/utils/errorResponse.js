function publicError(error, fallbackMessage, fallbackProvider) {
  const status = error.status || 502;
  const raw = String(error.message || fallbackMessage || 'Error').toLowerCase();
  let message = fallbackMessage || error.message || 'Error controlado';
  if (status === 429 || raw.includes('rate limit')) message = 'Proveedor temporalmente limitado por rate limit. Reintenta más tarde.';
  else if (status === 404 || raw.includes('did not return quote') || raw.includes('symbol')) message = 'Símbolo inexistente o sin datos financieros suficientes.';
  else if (raw.includes('fmp')) message = 'FMP no disponible o sin datos para esta petición.';
  else if (raw.includes('claude')) message = 'Claude no disponible o no devolvió una recomendación válida.';
  return { status, body: { status: 'error', message, provider: inferProvider(error, fallbackProvider) } };
}

function inferProvider(error, fallbackProvider) {
  const message = String(error.message || '').toLowerCase();
  if (message.includes('fmp')) return 'fmp';
  if (message.includes('claude')) return 'claude';
  return fallbackProvider || 'backend';
}

module.exports = { publicError };
