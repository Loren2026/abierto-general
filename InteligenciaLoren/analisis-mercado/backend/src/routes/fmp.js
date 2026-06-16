const express = require('express');
const { publicError } = require('../utils/errorResponse');
const { fetchFmp } = require('../services/fmpService');

const router = express.Router();

async function proxyFmp(req, res, endpointKey, extraParams = {}) {
  try {
    const data = await fetchFmp(endpointKey, req.params.symbol, extraParams);
    res.json(data);
  } catch (error) {
    const response = publicError(error, 'FMP proxy error', 'fmp');
    res.status(response.status).json(response.body);
  }
}

router.get('/quote/:symbol', (req, res) => proxyFmp(req, res, 'quote'));
router.get('/income-statement/:symbol', (req, res) => proxyFmp(req, res, 'incomeStatement', { period: 'annual', limit: '5' }));
router.get('/balance-sheet/:symbol', (req, res) => proxyFmp(req, res, 'balanceSheet', { period: 'annual', limit: '5' }));
router.get('/cash-flow/:symbol', (req, res) => proxyFmp(req, res, 'cashFlow', { period: 'annual', limit: '5' }));

module.exports = router;
