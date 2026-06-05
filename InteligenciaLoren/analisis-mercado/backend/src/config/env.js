const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function readPort(value) {
  const parsed = Number(value || 3001);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3001;
}

const config = {
  port: readPort(process.env.PORT),
  fmpApiKey: process.env.FMP_API_KEY || '',
  claudeApiKey: process.env.CLAUDE_API_KEY || '',
  claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514'
};

function validateConfig() {
  const missing = [];
  if (!config.fmpApiKey) missing.push('FMP_API_KEY');
  if (!config.claudeApiKey) missing.push('CLAUDE_API_KEY');
  if (!process.env.PORT) missing.push('PORT (using default 3001)');

  if (missing.length > 0) {
    console.warn(`[config] Missing backend environment variables: ${missing.join(', ')}. Related proxy routes may return controlled errors.`);
  }
}

module.exports = { config, validateConfig };
