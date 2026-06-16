const express = require('express');
const { publicError } = require('../utils/errorResponse');
const { analyzeWithClaude } = require('../services/claudeService');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const result = await analyzeWithClaude(req.body || {});
    res.json({ status: 'ok', ...result });
  } catch (error) {
    const response = publicError(error, 'Claude analysis proxy error', 'claude');
    res.status(response.status).json(response.body);
  }
});

module.exports = router;
