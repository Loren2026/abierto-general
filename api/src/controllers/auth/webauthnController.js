import {
  buildAuthenticationOptions,
  buildRegistrationOptions,
  verifyRegistrationCredential,
} from '../../services/webauthn/webauthnService.js';
import {
  createWebAuthnCredential,
  listActiveWebAuthnCredentialsByUserId,
} from '../../utils/webauthnCredentials.js';
import { createAuthenticationChallenge } from '../../utils/webauthnAuthenticationChallenges.js';
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
