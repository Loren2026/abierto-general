const express = require('express');
const { config } = require('../config/env');
const { getSnapshot, putSnapshot } = require('../services/persistenceService');

const router = express.Router();

const OPTIONS_PERMISSION_CONFIG = {
  allowedStrategy: 'covered_call',
  contractMultiplier: 100,
  allowedMarkets: ['NASDAQ', 'NYSE', 'AMEX', 'ARCA', 'TSE', 'TSX', 'TSXV'],
  permissionLevel: 'IBKR Nivel 1'
};

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function normalizeSymbol(item) {
  return String(item?.tk || item?.symbol || item?.ticker || '').trim();
}

function inspectSnapshot(snapshot) {
  const idc7 = parseJson(snapshot?.idc7, null);
  const portfolio = Array.isArray(idc7?.c) ? idc7.c : [];
  const watchlist = Array.isArray(idc7?.p) ? idc7.p : [];
  const validPortfolio = portfolio.filter((item) => normalizeSymbol(item));
  const validWatchlist = watchlist.filter((item) => normalizeSymbol(item));
  return {
    hasIdc7: Boolean(idc7 && typeof idc7 === 'object'),
    portfolioPositions: validPortfolio.length,
    watchlistPositions: validWatchlist.length,
    coveredCalls: readCoveredCalls(snapshot).length
  };
}

function normalizeExchange(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeOptionTicker(value) {
  return String(value || '').trim().toUpperCase();
}

function readCoveredCalls(snapshot) {
  const raw = snapshot?.coveredCalls;
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') return parseJson(raw, []);
  return [];
}

function validateCoveredCalls(snapshot) {
  const idc7 = parseJson(snapshot?.idc7, null);
  const portfolio = Array.isArray(idc7?.c) ? idc7.c : [];
  const portfolioByTicker = new Map(portfolio.map((item) => [normalizeOptionTicker(item?.tk || item?.symbol || item?.ticker), item]));
  const calls = readCoveredCalls(snapshot);

  if (!Array.isArray(calls)) {
    return 'coveredCalls debe ser un array.';
  }

  for (const call of calls) {
    const strategy = String(call?.strategy || '').trim();
    if (strategy !== OPTIONS_PERMISSION_CONFIG.allowedStrategy) {
      return `Estrategia bloqueada: ${strategy || 'sin estrategia'}. ${OPTIONS_PERMISSION_CONFIG.permissionLevel} solo permite call cubierta.`;
    }

    const ticker = normalizeOptionTicker(call?.ticker);
    const status = String(call?.status || 'open').trim();
    if (!ticker) return 'Call cubierta rechazada: falta ticker.';

    if (status === 'open') {
      const position = portfolioByTicker.get(ticker);
      if (!position) return `Call cubierta rechazada: ${ticker} no está en la cartera.`;

      const exchange = normalizeExchange(position.ex || position.exchange || position.market);
      if (!OPTIONS_PERMISSION_CONFIG.allowedMarkets.includes(exchange)) {
        return `Call cubierta rechazada: ${ticker} cotiza en ${exchange || 'mercado desconocido'} y el permiso actual solo cubre EE.UU. y Canadá.`;
      }

      const shares = Number(position.qty || position.quantity || 0);
      const contracts = Number(call?.contracts || 0);
      const maxContracts = Math.floor(shares / OPTIONS_PERMISSION_CONFIG.contractMultiplier);
      if (!Number.isFinite(contracts) || contracts < 1) return `Call cubierta rechazada: contratos inválidos para ${ticker}.`;
      if (contracts > maxContracts) {
        return `Call cubierta rechazada: necesitas al menos ${OPTIONS_PERMISSION_CONFIG.contractMultiplier} acciones por contrato de ${ticker}. Tienes ${shares}.`;
      }
    }
  }

  return null;
}

function requirePersistenceAuth(req, res, next) {
  if (!config.persistenceAuthToken) {
    return res.status(503).json({ status: 'error', message: 'Persistencia no configurada: falta ANALISIS_PERSISTENCE_TOKEN.' });
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-analisis-token'];

  if (!token || token !== config.persistenceAuthToken) {
    return res.status(401).json({ status: 'error', message: 'No autorizado.' });
  }

  next();
}

router.get('/snapshot', requirePersistenceAuth, (_req, res) => {
  res.json({ status: 'ok', snapshot: getSnapshot() });
});

router.put('/snapshot', requirePersistenceAuth, (req, res) => {
  const snapshot = req.body?.snapshot || req.body || {};
  const allowEmpty = req.body?.allowEmpty === true || snapshot?.allowEmpty === true;
  const incoming = inspectSnapshot(snapshot);

  if (!allowEmpty && (!incoming.hasIdc7 || incoming.portfolioPositions < 1)) {
    return res.status(400).json({
      status: 'error',
      message: 'Snapshot rechazado: idc7 debe contener al menos una posición de cartera válida. Usa allowEmpty=true para vaciar intencionadamente.'
    });
  }

  const optionsError = validateCoveredCalls(snapshot);
  if (optionsError) {
    return res.status(400).json({ status: 'error', message: optionsError });
  }

  const saved = putSnapshot(snapshot);
  const outgoing = inspectSnapshot(saved);
  console.info('[persistence] PUT snapshot', {
    allowEmpty,
    incomingPortfolioPositions: incoming.portfolioPositions,
    incomingWatchlistPositions: incoming.watchlistPositions,
    incomingCoveredCalls: incoming.coveredCalls,
    outgoingPortfolioPositions: outgoing.portfolioPositions,
    outgoingWatchlistPositions: outgoing.watchlistPositions,
    outgoingCoveredCalls: outgoing.coveredCalls
  });
  res.json({ status: 'ok', snapshot: saved });
});

module.exports = router;
