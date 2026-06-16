const express = require('express');
const { getOptionsStatus, getOptionsChain } = require('../services/optionsService');

const router = express.Router();

router.get('/status', (_req, res) => {
  res.json(getOptionsStatus());
});

router.get('/chain/:symbol', async (req, res) => {
  try {
    const data = await getOptionsChain(req.params.symbol);
    res.json(data);
  } catch (error) {
    res.status(error.status || 502).json({
      status: 'error',
      message: error.message,
      ...(error.payload ? { details: error.payload } : {})
    });
  }
});

module.exports = router;
