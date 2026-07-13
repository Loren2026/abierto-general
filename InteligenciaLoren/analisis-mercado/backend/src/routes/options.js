const express = require('express');
const { requirePersistenceAuth } = require('../middleware/auth');
const { fetchOptionsChain } = require('../services/optionsChainService');

const router = express.Router();

router.get('/chain/:symbol', requirePersistenceAuth, async (req, res) => {
  try {
    const chain = await fetchOptionsChain(req.params.symbol, { expiration: req.query.expiration });
    res.json({ status: 'ok', chain });
  } catch (err) {
    console.warn('[options] CBOE chain unavailable', {
      symbol: req.params.symbol,
      expiration: req.query.expiration || null,
      message: err.message
    });
    res.status(err.statusCode || 500).json({ status: 'error', message: err.message || 'Cadena no disponible.' });
  }
});

module.exports = router;
