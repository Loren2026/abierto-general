import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }

  return process.env.JWT_SECRET;
}

function createToken(payload, expiresIn) {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn,
  });
}

export function createBackendSessionForUser(user) {
  const accessToken = createToken(
    {
      sub: user.id,
      email: user.email,
      role: 'authenticated',
      amr: ['webauthn'],
      type: 'access',
    },
    ACCESS_TOKEN_TTL_SECONDS,
  );

  const refreshToken = createToken(
    {
      sub: user.id,
      email: user.email,
      role: 'authenticated',
      amr: ['webauthn'],
      type: 'refresh',
    },
    REFRESH_TOKEN_TTL_SECONDS,
  );

  return {
    accessToken,
    refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
  };
}

export function verifyBackendAccessToken(token) {
  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });

    if (payload.type !== 'access' || !payload.sub) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}
