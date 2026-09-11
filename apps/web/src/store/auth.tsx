import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client.js';
import type { Permission, RoleName } from '@dsm/shared';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: RoleName;
  permissions: Permission[];
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (p: Permission) => boolean;
  isAdmin: boolean;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!api.tokens.get()) {
      setLoading(false);
      return;
    }
    api
      .get<AuthUser>('/auth/me')
      .then(setUser)
      .catch(() => api.tokens.clear())
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ accessToken: string; refreshToken: string; user: AuthUser }>('/auth/login', {
      email,
      password,
    });
    api.tokens.set({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    setUser(res.user);
  }

  function logout() {
    const t = api.tokens.get();
    if (t) api.post('/auth/logout', { refreshToken: t.refreshToken }).catch(() => {});
    api.tokens.clear();
    setUser(null);
  }

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        login,
        logout,
        can: (p) => !!user?.permissions.includes(p),
        isAdmin: user?.role === 'ADMIN',
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
