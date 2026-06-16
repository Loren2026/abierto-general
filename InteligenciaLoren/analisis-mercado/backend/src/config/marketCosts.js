/**
 * Costes fiscales/mercado server-side para recomendaciones.
 *
 * Regla operativa: si un mercado no está aquí, el backend NO inventa tarifas.
 * Devuelve estado no_calculado para que Claude y la UI lo traten honestamente.
 *
 * Fuentes documentales internas:
 * - UK Stamp Duty Reserve Tax: 0,5% compra acciones UK.
 * - España FTT: 0,2% compra acciones españolas sujetas.
 * - Francia FTT: 0,3% compra acciones francesas sujetas.
 * - Italia FTT: 0,1% compra acciones italianas en mercado regulado.
 * Revisar antes de producción porque exenciones, instrumentos y umbrales pueden cambiar.
 */
const MARKET_COSTS = Object.freeze({
  UK: {
    label: 'Reino Unido',
    source: 'UK Stamp Duty Reserve Tax / HMRC, revisar exenciones antes de producción',
    costs: [{ name: 'UK Stamp Duty', side: 'compra', rate: 0.005 }]
  },
  ES: {
    label: 'España',
    source: 'Impuesto sobre Transacciones Financieras español, revisar lista de sociedades sujetas',
    costs: [{ name: 'FTT española', side: 'compra', rate: 0.002 }]
  },
  FR: {
    label: 'Francia',
    source: 'Taxe sur les transactions financières francesa, revisar lista de emisores sujetos',
    costs: [{ name: 'FTT francesa', side: 'compra', rate: 0.003 }]
  },
  IT: {
    label: 'Italia',
    source: 'Imposta sulle transazioni finanziarie italiana, revisar instrumento/mercado',
    costs: [{ name: 'FTT italiana', side: 'compra', rate: 0.001 }]
  }
});

function estimateMarketCosts(market) {
  const entry = market ? MARKET_COSTS[market] : null;
  if (!entry) {
    return {
      estado: 'no_calculado',
      motivo: 'Mercado no identificado o sin tarifa documentada en backend. No se inventan costes.',
      tasas_aplicadas: []
    };
  }

  return {
    estado: 'calculado_parcial',
    mercado: entry.label,
    fuente: entry.source,
    advertencia: 'Solo incluye tasas explícitamente configuradas; no incluye comisión concreta del broker si no está documentada.',
    tasas_aplicadas: entry.costs.map((item) => ({
      nombre: item.name,
      lado: item.side,
      porcentaje: item.rate,
      descripcion: `${(item.rate * 100).toFixed(2)}% en ${item.side}`
    }))
  };
}

module.exports = { MARKET_COSTS, estimateMarketCosts };
