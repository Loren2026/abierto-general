const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: Number(process.env.PORT || 3001),
  fmpApiKey: process.env.FMP_API_KEY || '',
  claudeApiKey: process.env.CLAUDE_API_KEY || ''
};

module.exports = config;
