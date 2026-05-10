import { supabase } from '../config/supabase.js';

export async function requireSession(req, res, next) {
  const accessToken = req.headers.authorization?.replace('Bearer ', '');

  if (!accessToken) {
    return res.status(401).json({ success: false, error: 'No autorizado' });
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      return res.status(401).json({ success: false, error: 'No autorizado' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'No autorizado' });
  }
}
