const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const store = {
  get(): Tokens | null {
    const raw = localStorage.getItem('dsm.tokens');
    return raw ? JSON.parse(raw) : null;
  },
  set(t: Tokens) {
    localStorage.setItem('dsm.tokens', JSON.stringify(t));
  },
  clear() {
    localStorage.removeItem('dsm.tokens');
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: unknown) {
    super(message);
  }
}

let refreshing: Promise<void> | null = null;

async function doRefresh(): Promise<void> {
  const tokens = store.get();
  if (!tokens) throw new ApiError(401, 'Not authenticated');
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
  if (!res.ok) {
    store.clear();
    throw new ApiError(401, 'Session expired');
  }
  const data = await res.json();
  store.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
}

async function request<T>(path: string, opts: RequestInit = {}, retry = true): Promise<T> {
  const tokens = store.get();
  const headers: Record<string, string> = { ...(opts.headers as object) };
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;

  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });

  if (res.status === 401 && retry && store.get()) {
    if (!refreshing) refreshing = doRefresh().finally(() => (refreshing = null));
    try {
      await refreshing;
      return request<T>(path, opts, false);
    } catch {
      store.clear();
      window.location.href = '/login';
      throw new ApiError(401, 'Session expired');
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error?.message ?? res.statusText, body?.error?.code, body?.error?.details);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  url: API_URL,
  tokens: store,
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) => request<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(p: string, body?: unknown) => request<T>(p, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  put: <T>(p: string, body?: unknown) => request<T>(p, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  del: <T>(p: string) => request<T>(p, { method: 'DELETE' }),
  upload: <T>(p: string, form: FormData) => request<T>(p, { method: 'POST', body: form }),
};
