// Client HTTP : ajoute le JWT, rafraîchit le token sur 401, normalise les erreurs.
const BASE = "/api";
const ACCESS = "access_token";
const REFRESH = "refresh_token";

// NB : localStorage est simple mais exposé au XSS (voir limites dans le README).
export const tokenStore = {
  get access() { return localStorage.getItem(ACCESS); },
  get refresh() { return localStorage.getItem(REFRESH); },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
    public data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

let onSessionExpired: () => void = () => {};
export const setSessionExpiredHandler = (fn: () => void) => { onSessionExpired = fn; };

let refreshing: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refresh = tokenStore.refresh;
  if (!refresh) return false;
  const res = await fetch(`${BASE}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  tokenStore.set(data.access, data.refresh); // le refresh est "tourné" à chaque usage
  return true;
}

interface Options { method?: string; body?: unknown }

export async function api<T>(path: string, { method = "GET", body }: Options = {}): Promise<T> {
  const send = () =>
    fetch(`${BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(tokenStore.access ? { Authorization: `Bearer ${tokenStore.access}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let res = await send();

  if (res.status === 401 && tokenStore.refresh) {
    // Un seul refresh à la fois, même si 5 requêtes échouent en même temps.
    refreshing ??= refreshAccessToken().finally(() => { refreshing = null; });
    if (await refreshing) {
      res = await send();
    } else {
      tokenStore.clear();
      onSessionExpired();
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.code, data.detail ?? `Erreur ${res.status}`, data);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
