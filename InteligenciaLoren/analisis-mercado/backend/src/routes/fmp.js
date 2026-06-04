const express = require('express');
const { fetchFmp } = require('../services/fmpService');

const router = express.Router();

async function proxyFmp(req, res, endpointKey, extraParams = {}) {
  try {
    const data = await fetchFmp(endpointKey, req.params.symbol, extraParams);
    res.json(data);
  } catch (error) {
    res.status(error.status || 502).json({
      status: 'error',
      message: error.message || 'FMP proxy error',
      provider: 'fmp'
    });
  }
}

router.get('/quote/:symbol', (req, res) => proxyFmp(req, res, 'quote'));
router.get('/income-statement/:symbol', (req, res) => proxyFmp(req, res, 'incomeStatement', { period: 'annual', limit: '5' }));
router.get('/balance-sheet/:symbol', (req, res) => proxyFmp(req, res, 'balanceSheet', { period: 'annual', limit: '5' }));
router.get('/cash-flow/:symbol', (req, res) => proxyFmp(req, res, 'cashFlow', { period: 'annual', limit: '5' }));

module.exports = router;
