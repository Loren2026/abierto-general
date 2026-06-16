const express = require('express');
const { publicError } = require('../utils/errorResponse');
const { analyzeRecommendations } = require('../services/recommendationService');

const router = express.Router();

router.post('/analyze', async (req, res) => {
  try {
    const result = await analyzeRecommendations(req.body || {});
    res.json(result);
  } catch (error) {
    const response = publicError(error, 'Recommendation analysis error', 'recommendations');
    res.status(response.status).json(response.body);
  }
});

module.exports = router;
