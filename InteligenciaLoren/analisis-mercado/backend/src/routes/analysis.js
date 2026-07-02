const express = require('express');
const { analyzeWithClaude } = require('../services/claudeService');

const router = express.Router();

router.post('/', async (req, res) => {
  const payloadBytes = Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8');

  try {
    const result = await analyzeWithClaude(req.body || {});
    res.json({ status: 'ok', ...result });
  } catch (error) {
    console.error('[analysis] POST /api/analysis failed', {
      message: error.message,
      stack: error.stack,
      status: error.status,
      code: error.code,
      provider: error.provider,
      providerStatus: error.providerStatus,
      providerBody: error.providerBody,
      payloadBytes
    });

    res.status(error.status || 502).json({
      status: 'error',
      message: error.message || 'Claude analysis proxy error',
      provider: 'claude'
    });
  }
});

module.exports = router;
