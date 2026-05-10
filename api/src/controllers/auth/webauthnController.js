import crypto from 'crypto';
import {
  buildAuthenticationOptions,
  buildRegistrationOptions,
  verifyAuthenticationCredential,
  verifyRegistrationCredential,
} from '../../services/webauthn/webauthnService.js';
import { createBackendSessionForUser } from '../../utils/backendSessionTokens.js';
import {
  createWebAuthnCredential,
  getActiveWebAuthnCredentialByCredentialId,
  listActiveWebAuthnCredentialsByUserId,
  updateWebAuthnCredentialUsage,
} from '../../utils/webauthnCredentials.js';
import {
  createAuthenticationChallenge,
  getPendingAuthenticationChallengeByUserId,
  markAuthenticationChallengeAsUsed,
} from '../../utils/webauthnAuthenticationChallenges.js';
import { consumeExchangeToken, createExchangeToken } from '../../utils/webauthnExchangeTokens.js';
import { supabaseAdmin } from '../../config/supabase.js';
import {
  createRegistrationChallenge,
  getPendingRegistrationChallengeByUserId,
  markRegistrationChallengeAsUsed,
} from '../../utils/webauthnRegistrationChallenges.js';

export async function createRegistrationOptions(req, res) {
  try {
    const { deviceLabel } = req.body ?? {};
    const credentials = await listActiveWebAuthnCredentialsByUserId(req.user.id);

    const options = await buildRegistrationOptions({
      user: req.user,
      credentials,
    });

    await createRegistrationChallenge({
      userId: req.user.id,
      challenge: options.challenge,
      deviceLabel,
    });

    return res.json({
      success: true,
      options,
    });
  } catch (error) {
    console.error('Error generando opciones WebAuthn de registro:', error);
    return res.status(500).json({
      success: false,
      error: 'No se pudieron generar las opciones de registro WebAuthn',
    });
  }
}

export async function createAuthenticationOptions(req, res) {
  try {
    const credentials = await listActiveWebAuthnCredentialsByUserId(req.user.id);

    if (!credentials.length) {
      return res.status(400).json({
        success: false,
        error: 'No hay credenciales WebAuthn activas para este usuario',
      });
    }

    const options = await buildAuthenticationOptions({ credentials });

    await createAuthenticationChallenge({
      userId: req.user.id,
      challenge: options.challenge,
    });

    return res.json({
      success: true,
      options,
    });
  } catch (error) {
    console.error('Error generando opciones WebAuthn de autenticación:', error);
    return res.status(500).json({
      success: false,
      error: 'No se pudo iniciar la autenticación WebAuthn',
    });
  }
}

function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function getUserById(userId) {
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (error || !user) {
    throw new Error('USER_NOT_FOUND');
  }

  return user;
}

export async function verifyAuthentication(req, res) {
  try {
    const { credential } = req.body ?? {};

    if (!credential?.id) {
      return res.status(400).json({
        success: false,
        error: 'La credencial WebAuthn es obligatoria',
      });
    }

    const authenticator = await getActiveWebAuthnCredentialByCredentialId(credential.id);

    if (!authenticator) {
      return res.status(400).json({
        success: false,
        error: 'La credencial WebAuthn no es válida para este acceso',
      });
    }

    const pendingChallenge = await getPendingAuthenticationChallengeByUserId(authenticator.userId);

    if (!pendingChallenge) {
      return res.status(400).json({
        success: false,
        error: 'No hay una autenticación WebAuthn pendiente o ha expirado',
      });
    }

    const verification = await verifyAuthenticationCredential({
      credential,
      expectedChallenge: pendingChallenge.challenge,
      authenticator,
    });

    if (!verification.verified) {
      return res.status(400).json({
        success: false,
        error: 'No se pudo verificar la autenticación WebAuthn',
      });
    }

    await markAuthenticationChallengeAsUsed(pendingChallenge.id);
    await updateWebAuthnCredentialUsage({
      credentialId: verification.credentialId,
      counter: verification.newCounter,
    });

    const user = await getUserById(authenticator.userId);
    const exchangeToken = await createExchangeToken({ userId: user.id });

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
      exchangeToken: exchangeToken.token,
      exchangeTokenExpiresAt: exchangeToken.expiresAt,
    });
  } catch (error) {
    console.error('Error verificando autenticación WebAuthn:', error);
    return res.status(500).json({
      success: false,
      error: 'No se pudo verificar la autenticación WebAuthn',
    });
  }
}

export async function exchangeWebAuthnToken(req, res) {
  try {
    const { exchangeToken } = req.body ?? {};

    if (!exchangeToken) {
      return res.status(400).json({
        success: false,
        error: 'El token de acceso rápido ha expirado o no es válido',
      });
    }

    const tokenRecord = await consumeExchangeToken(exchangeToken);

    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        error: 'El token de acceso rápido ha expirado o no es válido',
      });
    }

    const user = await getUserById(tokenRecord.user_id);
    const session = createBackendSessionForUser(user);
    const csrfToken = generateCSRFToken();

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
      csrfToken,
      session,
    });
  } catch (error) {
    console.error('Error canjeando token WebAuthn:', error);
    return res.status(500).json({
      success: false,
      error: 'El token de acceso rápido ha expirado o no es válido',
    });
  }
}

export async function verifyRegistration(req, res) {
  try {
    const { credential, deviceLabel } = req.body ?? {};

    if (!credential) {
      return res.status(400).json({
        success: false,
        error: 'La credencial WebAuthn es obligatoria',
      });
    }

    const pendingChallenge = await getPendingRegistrationChallengeByUserId(req.user.id);

    if (!pendingChallenge) {
      return res.status(400).json({
        success: false,
        error: 'No hay un registro WebAuthn pendiente o ha expirado',
      });
    }

    const verification = await verifyRegistrationCredential({
      credential,
      expectedChallenge: pendingChallenge.challenge,
    });

    if (!verification.verified) {
      return res.status(400).json({
        success: false,
        error: 'No se pudo verificar la credencial WebAuthn',
      });
    }

    await markRegistrationChallengeAsUsed(pendingChallenge.id);

    const savedCredential = await createWebAuthnCredential({
      userId: req.user.id,
      credentialId: verification.credentialId,
      publicKey: verification.publicKey,
      counter: verification.counter,
      deviceLabel: deviceLabel ?? pendingChallenge.device_label,
      transports: verification.transports,
      authenticatorAttachment: verification.authenticatorAttachment,
    });

    return res.json({
      success: true,
      credential: {
        id: savedCredential.id,
        credentialId: savedCredential.credential_id,
        deviceLabel: savedCredential.device_label,
        createdAt: savedCredential.created_at,
      },
    });
  } catch (error) {
    console.error('Error verificando registro WebAuthn:', error);

    if (error.message === 'DUPLICATE_CREDENTIAL') {
      return res.status(409).json({
        success: false,
        error: 'Esta credencial WebAuthn ya está registrada',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'No se pudo verificar la credencial WebAuthn',
    });
  }
}
