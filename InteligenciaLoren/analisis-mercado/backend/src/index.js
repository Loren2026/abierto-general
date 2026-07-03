const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { config, validateConfig } = require('./config/env');
const fmpRoutes = require('./routes/fmp');
const analysisRoutes = require('./routes/analysis');
const recommendationRoutes = require('./routes/recommendations');
const ibkrImportRoutes = require('./routes/ibkrImport');
const brokerTariffRoutes = require('./routes/brokerTariffs');

validateConfig();

const app = express();

app.set('trust proxy', 1);

const allowedOrigins = ['https://analisis.inteligencialoren.com'];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json({ limit: '2mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests, please try again later.'
  }
});

app.use('/api', apiLimiter);

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/fmp', fmpRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/ibkr', ibkrImportRoutes);
app.use('/api/broker', brokerTariffRoutes);

app.use((err, req, res, _next) => {
  console.error('[server] controlled error', {
    message: err.message,
    stack: err.stack,
    status: err.status,
    statusCode: err.statusCode,
    code: err.code,
    type: err.type,
    limit: err.limit,
    length: err.length,
    expected: err.expected,
    received: err.received,
    method: req.method,
    path: req.originalUrl,
    contentLength: req.get('content-length')
  });
  res.status(err.status || err.statusCode || 500).json({ status: 'error', message: 'Internal server error' });
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
