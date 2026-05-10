import { supabaseAdmin } from '../config/supabase.js';

const CHALLENGE_TTL_MINUTES = 10;

export async function createAuthenticationChallenge({ userId, challenge }) {
  const expiresAtIso = new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60 * 1000).toISOString();

  const { error: cleanupError } = await supabaseAdmin
    .from('webauthn_authentication_challenges')
    .delete()
    .eq('user_id', userId)
    .is('used_at', null);

  if (cleanupError) {
    throw new Error(`No se pudo limpiar el challenge WebAuthn de autenticación previo: ${cleanupError.message}`);
  }

  const { data, error } = await supabaseAdmin
    .from('webauthn_authentication_challenges')
    .insert({
      user_id: userId,
      challenge,
      expires_at: expiresAtIso,
    })
    .select('id, challenge, created_at, expires_at')
    .single();

  if (error) {
    throw new Error(`No se pudo guardar el challenge WebAuthn de autenticación: ${error.message}`);
  }

  return data;
}

export async function getPendingAuthenticationChallengeByUserId(userId) {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('webauthn_authentication_challenges')
    .select('id, challenge, expires_at, used_at')
    .eq('user_id', userId)
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo recuperar el challenge WebAuthn de autenticación pendiente: ${error.message}`);
  }

  return data;
}

export async function markAuthenticationChallengeAsUsed(challengeId) {
  const { error } = await supabaseAdmin
    .from('webauthn_authentication_challenges')
    .update({ used_at: new Date().toISOString() })
    .eq('id', challengeId)
    .is('used_at', null);

  if (error) {
    throw new Error(`No se pudo marcar el challenge WebAuthn de autenticación como usado: ${error.message}`);
  }
}
