import { supabaseAdmin } from '../config/supabase.js';

const CHALLENGE_TTL_MINUTES = 10;

export async function createRegistrationChallenge({ userId, challenge, deviceLabel }) {
  const nowIso = new Date().toISOString();
  const expiresAtIso = new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60 * 1000).toISOString();

  const { error: cleanupError } = await supabaseAdmin
    .from('webauthn_registration_challenges')
    .delete()
    .eq('user_id', userId)
    .is('used_at', null);

  if (cleanupError) {
    throw new Error(`No se pudo limpiar el challenge WebAuthn previo: ${cleanupError.message}`);
  }

  const { data, error } = await supabaseAdmin
    .from('webauthn_registration_challenges')
    .insert({
      user_id: userId,
      challenge,
      device_label: deviceLabel ?? null,
      created_at: nowIso,
      expires_at: expiresAtIso,
    })
    .select('id, challenge, device_label, created_at, expires_at')
    .single();

  if (error) {
    throw new Error(`No se pudo guardar el challenge WebAuthn: ${error.message}`);
  }

  return data;
}

export async function getPendingRegistrationChallengeByUserId(userId) {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('webauthn_registration_challenges')
    .select('id, challenge, device_label, expires_at, used_at')
    .eq('user_id', userId)
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo recuperar el challenge WebAuthn pendiente: ${error.message}`);
  }

  return data;
}

export async function markRegistrationChallengeAsUsed(challengeId) {
  const { error } = await supabaseAdmin
    .from('webauthn_registration_challenges')
    .update({ used_at: new Date().toISOString() })
    .eq('id', challengeId);

  if (error) {
    throw new Error(`No se pudo marcar el challenge WebAuthn como usado: ${error.message}`);
  }
}
