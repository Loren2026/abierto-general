const express = require('express');
const { analyzeWithClaude } = require('../services/claudeService');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const result = await analyzeWithClaude(req.body || {});
    res.json({ status: 'ok', ...result });
  } catch (error) {
    res.status(error.status || 502).json({
      status: 'error',
      message: error.message || 'Claude analysis proxy error',
      provider: 'claude'
    });
  }
});

module.exports = router;
