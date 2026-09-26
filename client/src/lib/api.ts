/**
 * The single place that talks to the API.
 *
 * Always relative: dev is proxied by Vite, production is served by the same
 * Vercel project through api/index.js. There is deliberately no VITE_API_URL.
 */
import type { User } from './types';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Session = { token: string | null; refreshToken: string | null };

let session: Session = { token: null, refreshToken: null };
let onSessionChange: ((next: { user: User; token: string; refreshToken: string }) => void) | null = null;
let onSessionExpired: (() => void) | null = null;

export function setSession(next: Session) {
  session = next;
}

export function bindSessionHandlers(handlers: {
  onRefreshed: (next: { user: User; token: string; refreshToken: string }) => void;
  onExpired: () => void;
}) {
  onSessionChange = handlers.onRefreshed;
  onSessionExpired = handlers.onExpired;
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!session.refreshToken) return false;
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
      if (!response.ok) return false;
      const payload = (await response.json()) as {
        data: { user: User; token: string; refreshToken: string };
      };
      session = { token: payload.data.token, refreshToken: payload.data.refreshToken };
      onSessionChange?.(payload.data);
      return true;
    } catch {
      return false;
    } finally {
      // allow the next 401 to refresh again once this attempt settles
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();
  return refreshInFlight;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
};

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = options;

  const send = async (): Promise<Response> =>
    fetch(path.startsWith('/api') ? path : `/api${path}`, {
      method,
      signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && session.token ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  let response = await send();

  if (response.status === 401 && auth && session.refreshToken) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await send();
    } else {
      onSessionExpired?.();
    }
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as { ok?: boolean; data?: T; error?: string; code?: string; details?: unknown }) : {};

  if (!response.ok || payload.ok === false) {
    throw new ApiError(
      payload.error ?? `Request failed with ${response.status}`,
      response.status,
      payload.code,
      payload.details,
    );
  }

  return (payload.data ?? (payload as unknown)) as T;
}

export const apiGet = <T,>(path: string, signal?: AbortSignal) => api<T>(path, { signal });
export const apiPost = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body });
export const apiPatch = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body });
export const apiDelete = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'DELETE', body });
