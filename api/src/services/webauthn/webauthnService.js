import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';

const rpName = 'Inteligencia Loren';
const rpID = 'panel.inteligencialoren.com';
const expectedOrigin = 'https://panel.inteligencialoren.com';

function encodeUserId(userId) {
  return new TextEncoder().encode(userId);
}

function encodePublicKey(publicKey) {
  return Buffer.from(publicKey).toString('base64url');
}

export async function buildRegistrationOptions({ user, credentials }) {
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userID: encodeUserId(user.id),
    userDisplayName: user.user_metadata?.full_name || user.email || 'Loren',
    attestationType: 'none',
    timeout: 60000,
    excludeCredentials: credentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform',
    },
  });

  return options;
}

export async function buildAuthenticationOptions({ credentials }) {
  return generateAuthenticationOptions({
    rpID,
    timeout: 60000,
    allowCredentials: credentials,
    userVerification: 'preferred',
  });
}

export async function verifyRegistrationCredential({ credential, expectedChallenge }) {
  try {
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserPresence: true,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return { verified: false };
    }

    const { credential: registeredCredential } = verification.registrationInfo;

    return {
      verified: true,
      credentialId: registeredCredential.id,
      publicKey: encodePublicKey(registeredCredential.publicKey),
      counter: registeredCredential.counter,
      transports: credential.response?.transports ?? undefined,
      authenticatorAttachment: credential.authenticatorAttachment ?? null,
    };
  } catch (error) {
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'WEB_AUTHN_VERIFICATION_FAILED',
    };
  }
}

export const webauthnConfig = {
  rpName,
  rpID,
  expectedOrigin,
};
