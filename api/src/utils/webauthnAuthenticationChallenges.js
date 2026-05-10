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
