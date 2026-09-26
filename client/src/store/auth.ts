import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, apiPost, bindSessionHandlers, setSession } from '../lib/api';
import type { User } from '../lib/types';

type SessionPayload = {
  user: User;
  token: string;
  refreshToken: string;
};

type AuthState = {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  status: 'idle' | 'loading';
  error: string | null;
  signIn: (email: string, password: string) => Promise<User>;
  demoSignIn: (email: string) => Promise<User>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: string;
    referralCode?: string;
  }) => Promise<User>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
};

function syncSession(state: { token: string | null; refreshToken: string | null }) {
  setSession({ token: state.token, refreshToken: state.refreshToken });
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      status: 'idle',
      error: null,

      signIn: async (email, password) => {
        set({ status: 'loading', error: null });
        try {
          const data = await api<SessionPayload>('/auth/login', {
            method: 'POST',
            body: { email, password },
            auth: false,
          });
          set({ user: data.user, token: data.token, refreshToken: data.refreshToken, status: 'idle' });
          syncSession(data);
          return data.user;
        } catch (error) {
          set({ status: 'idle', error: (error as Error).message });
          throw error;
        }
      },

      demoSignIn: async (email) => {
        set({ status: 'loading', error: null });
        try {
          const data = await api<SessionPayload>('/auth/demo-login', { method: 'POST', body: { email }, auth: false });
          set({ user: data.user, token: data.token, refreshToken: data.refreshToken, status: 'idle' });
          syncSession(data);
          return data.user;
        } catch (error) {
          set({ status: 'idle', error: (error as Error).message });
          throw error;
        }
      },

      register: async (input) => {
        set({ status: 'loading', error: null });
        try {
          const data = await api<SessionPayload>('/auth/register', { method: 'POST', body: input, auth: false });
          set({ user: data.user, token: data.token, refreshToken: data.refreshToken, status: 'idle' });
          syncSession(data);
          return data.user;
        } catch (error) {
          set({ status: 'idle', error: (error as Error).message });
          throw error;
        }
      },

      signOut: async () => {
        const refreshToken = get().refreshToken;
        set({ user: null, token: null, refreshToken: null, error: null });
        syncSession({ token: null, refreshToken: null });
        if (refreshToken) {
          await apiPost('/auth/logout', { refreshToken }).catch(() => undefined);
        }
      },

      refreshMe: async () => {
        if (!get().token) return;
        try {
          const data = await api<{ user: User }>('/auth/me');
          set({ user: data.user });
        } catch {
          /* the api layer already handles an expired session */
        }
      },

      setUser: (user) => set({ user }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'qareeb.auth',
      partialize: (state) => ({ user: state.user, token: state.token, refreshToken: state.refreshToken }),
      onRehydrateStorage: () => (state) => {
        if (state) syncSession(state);
      },
    },
  ),
);

// keep the token cache and the store in step when the api layer rotates tokens
bindSessionHandlers({
  onRefreshed: (next) =>
    useAuth.setState({ user: next.user, token: next.token, refreshToken: next.refreshToken }),
  onExpired: () => {
    useAuth.setState({ user: null, token: null, refreshToken: null });
    syncSession({ token: null, refreshToken: null });
  },
});

export const hasRole = (user: User | null, ...roles: User['role'][]): boolean =>
  Boolean(user && roles.includes(user.role));

export const homeForRole = (role: User['role'] | undefined): string => {
  switch (role) {
    case 'MERCHANT':
      return '/merchant';
    case 'RIDER':
      return '/rider';
    case 'ADMIN':
      return '/admin';
    default:
      return '/home';
  }
};
