const { config } = require('../config/env');

const CLAUDE_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

async function analyzeWithClaude({ prompt, context, maxTokens = 1200 }) {
  if (!config.claudeApiKey) {
    const error = new Error('CLAUDE_API_KEY is not configured');
    error.status = 503;
    throw error;
  }

  const text = buildPrompt(prompt, context);

  const response = await fetch(CLAUDE_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.claudeApiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.claudeModel,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: text
        }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(`Claude request failed with status ${response.status}`);
    error.status = response.status;
    error.provider = 'claude';
    error.providerStatus = response.status;
    error.providerBody = payload;
    throw error;
  }

  const analysis = Array.isArray(payload.content)
    ? payload.content.map((part) => part.text || '').join('\n').trim()
    : '';

  return { analysis };
}

function buildPrompt(prompt, context) {
  if (prompt && context) return `${prompt}\n\nContexto:\n${JSON.stringify(context, null, 2)}`;
  if (prompt) return String(prompt);
  if (context) return `Analiza estos datos:\n${JSON.stringify(context, null, 2)}`;
  return 'Analiza la información enviada.';
}

module.exports = { analyzeWithClaude };
