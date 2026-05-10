import { create } from 'zustand';
import { supabase } from '../services/supabase';
import {
  browserSupportsWebAuthn,
  credentialToJSON,
  getCredentialFromOptions,
} from '../utils/webauthn';

async function readJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Error en autenticación');
  }

  return data;
}

const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  csrfToken: null,
  isLoading: false,
  error: null,

  applyAuthSession: (data) => {
    set({
      user: data.user,
      session: data.session,
      csrfToken: data.csrfToken,
      isLoading: false,
      error: null,
    });
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await readJsonResponse(response);
      get().applyAuthSession(data);

      return { success: true };
    } catch (error) {
      set({
        isLoading: false,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  },

  loginWithWebAuthn: async (email) => {
    set({ isLoading: true, error: null });

    try {
      if (!browserSupportsWebAuthn()) {
        throw new Error('Este navegador no es compatible con acceso por passkey.');
      }

      const optionsResponse = await fetch('/api/auth/webauthn/authenticate/options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const optionsData = await readJsonResponse(optionsResponse);
      const credential = await getCredentialFromOptions(optionsData.options);
      const credentialJSON = credentialToJSON(credential);

      const verifyResponse = await fetch('/api/auth/webauthn/authenticate/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credential: credentialJSON }),
      });

      const verifyData = await readJsonResponse(verifyResponse);

      const exchangeResponse = await fetch('/api/auth/webauthn/exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ exchangeToken: verifyData.exchangeToken }),
      });

      const exchangeData = await readJsonResponse(exchangeResponse);
      get().applyAuthSession(exchangeData);

      return { success: true };
    } catch (error) {
      set({
        isLoading: false,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  },

  logout: async () => {
    set({ isLoading: true });
    
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          refreshToken: get().session?.refreshToken 
        }),
      });

      set({
        user: null,
        session: null,
        csrfToken: null,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error en logout:', error);
    }
  },

  checkSession: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        set({
          user: session.user,
          session: {
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt: session.expires_at,
          },
        });
      }
    } catch (error) {
      console.error('Error verificando sesión:', error);
    }
  },
}));

export default useAuthStore;
