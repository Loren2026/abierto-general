import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';

const EXCHANGE_TOKEN_TTL_MINUTES = 5;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createExchangeToken({ userId }) {
  const plainToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(plainToken);
  const expiresAt = new Date(Date.now() + EXCHANGE_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  const { error: cleanupError } = await supabaseAdmin
    .from('webauthn_exchange_tokens')
    .delete()
    .eq('user_id', userId)
    .is('used_at', null);

  if (cleanupError) {
    throw new Error(`No se pudo limpiar el exchange token previo: ${cleanupError.message}`);
  }

  const { error } = await supabaseAdmin
    .from('webauthn_exchange_tokens')
    .insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

  if (error) {
    throw new Error(`No se pudo guardar el exchange token WebAuthn: ${error.message}`);
  }

  return {
    token: plainToken,
    expiresAt,
  };
}

export async function consumeExchangeToken(plainToken) {
  const tokenHash = hashToken(plainToken);
  const nowIso = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('webauthn_exchange_tokens')
    .select('id, user_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo consultar el exchange token WebAuthn: ${error.message}`);
  }

  if (!data || data.used_at || data.expires_at <= nowIso) {
    return null;
  }

  const { error: updateError } = await supabaseAdmin
    .from('webauthn_exchange_tokens')
    .update({ used_at: nowIso })
    .eq('id', data.id)
    .is('used_at', null);

  if (updateError) {
    throw new Error(`No se pudo consumir el exchange token WebAuthn: ${updateError.message}`);
  }

  return data;
}
