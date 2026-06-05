const express = require('express');
const cors = require('cors');
const { config, validateConfig } = require('./config/env');
const fmpRoutes = require('./routes/fmp');
const analysisRoutes = require('./routes/analysis');
const recommendationRoutes = require('./routes/recommendations');

validateConfig();

const app = express();

// Local development is permissive for now. In production, restrict CORS to the real allowed domain.
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Rate limiting hook: add express-rate-limit or gateway-level limiting before public exposure.
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/fmp', fmpRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/recommendations', recommendationRoutes);

app.use((err, _req, res, _next) => {
  console.error('[server] controlled error:', err.message);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

const server = app.listen(config.port, () => {
  console.log(`Analisis Mercado backend listening on port ${config.port}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
