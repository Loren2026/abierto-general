import { supabase, supabaseAdmin } from '../config/supabase.js';
import { verifyBackendAccessToken } from '../utils/backendSessionTokens.js';

export async function resolveSessionUser(accessToken) {
  if (!accessToken) {
    return null;
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (!error && user) {
      return user;
    }
  } catch (error) {
    // fallback below
  }

  const backendPayload = verifyBackendAccessToken(accessToken);
  if (!backendPayload?.sub) {
    return null;
  }

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.admin.getUserById(backendPayload.sub);

    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    return null;
  }
}

export async function requireSession(req, res, next) {
  const accessToken = req.headers.authorization?.replace('Bearer ', '');

  if (!accessToken) {
    return res.status(401).json({ success: false, error: 'No autorizado' });
  }

  const user = await resolveSessionUser(accessToken);

  if (!user) {
    return res.status(401).json({ success: false, error: 'No autorizado' });
  }

  req.user = user;
  next();
}
