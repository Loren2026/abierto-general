import { create } from 'zustand';
import { supabase } from '../services/supabase';

const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  csrfToken: null,
  isLoading: false,
  error: null,

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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en login');
      }

      set({
        user: data.user,
        session: data.session,
        csrfToken: data.csrfToken,
        isLoading: false,
        error: null,
      });

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
