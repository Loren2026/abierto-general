import { supabaseAdmin } from '../config/supabase.js';

function normalizeTransports(value) {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch (error) {
      return undefined;
    }
  }

  return undefined;
}

export async function listActiveWebAuthnCredentialsByUserId(userId) {
  const { data, error } = await supabaseAdmin
    .from('webauthn_credentials')
    .select('id, credential_id, transports')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`No se pudieron cargar las credenciales WebAuthn: ${error.message}`);
  }

  return (data ?? []).map((credential) => ({
    id: credential.credential_id,
    transports: normalizeTransports(credential.transports),
  }));
}

export async function getActiveWebAuthnCredentialByCredentialId(credentialId) {
  const { data, error } = await supabaseAdmin
    .from('webauthn_credentials')
    .select('id, user_id, credential_id, public_key, counter, transports, revoked_at')
    .eq('credential_id', credentialId)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo cargar la credencial WebAuthn: ${error.message}`);
  }

  if (!data || data.revoked_at) {
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    credentialId: data.credential_id,
    publicKey: Buffer.from(data.public_key, 'base64url'),
    counter: data.counter,
    transports: normalizeTransports(data.transports),
  };
}

export async function updateWebAuthnCredentialUsage({ credentialId, counter }) {
  const { error } = await supabaseAdmin
    .from('webauthn_credentials')
    .update({
      counter,
      last_used_at: new Date().toISOString(),
    })
    .eq('credential_id', credentialId)
    .is('revoked_at', null);

  if (error) {
    throw new Error(`No se pudo actualizar el uso de la credencial WebAuthn: ${error.message}`);
  }
}

export async function createWebAuthnCredential({
  userId,
  credentialId,
  publicKey,
  counter,
  deviceLabel,
  transports,
  authenticatorAttachment,
}) {
  const payload = {
    user_id: userId,
    credential_id: credentialId,
    public_key: publicKey,
    counter,
    device_label: deviceLabel ?? null,
    transports: transports ?? null,
    authenticator_attachment: authenticatorAttachment ?? null,
  };

  const { data, error } = await supabaseAdmin
    .from('webauthn_credentials')
    .insert(payload)
    .select('id, credential_id, device_label, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('DUPLICATE_CREDENTIAL');
    }

    throw new Error(`No se pudo guardar la credencial WebAuthn: ${error.message}`);
  }

  return data;
}
