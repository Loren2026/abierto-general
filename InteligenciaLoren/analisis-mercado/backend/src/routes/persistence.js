const express = require('express');
const { config } = require('../config/env');
const { getSnapshot, putSnapshot } = require('../services/persistenceService');

const router = express.Router();

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
  res.json({ status: 'ok', snapshot: putSnapshot(snapshot) });
});

module.exports = router;
