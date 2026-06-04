const express = require('express');
const { analyzeRecommendations } = require('../services/recommendationService');

const router = express.Router();

router.post('/analyze', async (req, res) => {
  try {
    const result = await analyzeRecommendations(req.body || {});
    res.json(result);
  } catch (error) {
    res.status(error.status || 502).json({
      status: 'error',
      message: error.message || 'Recommendation analysis error',
      provider: inferProvider(error)
    });
  }
});

function inferProvider(error) {
  const message = String(error.message || '').toLowerCase();
  if (message.includes('fmp')) return 'fmp';
  if (message.includes('claude')) return 'claude';
  return 'recommendations';
}

module.exports = router;
