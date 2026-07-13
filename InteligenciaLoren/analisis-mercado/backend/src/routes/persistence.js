const express = require('express');
const { config } = require('../config/env');
const { getSnapshot, putSnapshot } = require('../services/persistenceService');

const router = express.Router();

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
    watchlistPositions: validWatchlist.length
  };
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

  const saved = putSnapshot(snapshot);
  const outgoing = inspectSnapshot(saved);
  console.info('[persistence] PUT snapshot', {
    allowEmpty,
    incomingPortfolioPositions: incoming.portfolioPositions,
    incomingWatchlistPositions: incoming.watchlistPositions,
    outgoingPortfolioPositions: outgoing.portfolioPositions,
    outgoingWatchlistPositions: outgoing.watchlistPositions
  });
  res.json({ status: 'ok', snapshot: saved });
});

module.exports = router;
