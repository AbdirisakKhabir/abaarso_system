export type AuthUser = {
  id: number;
  email: string;
  name: string | null;
  roleId: number;
  roleName: string;
  permissions: string[];
};

export const AUTH_STORAGE_KEY = "university_auth";
export const TOKEN_KEY = "university_token";

/** User is locked after 1 hour without activity */
export const SESSION_TTL_MS = 60 * 60 * 1000;

export type StoredAuth = {
  user: AuthUser;
  token: string;
  loginAt?: number;
  lastActivityAt?: number;
};

export function getStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function setStoredAuth(
  data: StoredAuth,
  options?: { preserveTimestamps?: boolean }
): void {
  if (typeof window === "undefined") return;
  const existing = options?.preserveTimestamps ? getStoredAuth() : null;
  const now = Date.now();
  const payload: StoredAuth = {
    ...data,
    loginAt:
      options?.preserveTimestamps && existing?.loginAt
        ? existing.loginAt
        : (data.loginAt ?? now),
    lastActivityAt:
      options?.preserveTimestamps && existing?.lastActivityAt
        ? existing.lastActivityAt
        : (data.lastActivityAt ?? now),
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
  localStorage.setItem(TOKEN_KEY, data.token);
}

/** Returns true when the user has been inactive longer than SESSION_TTL_MS. */
export function isSessionInactive(): boolean {
  const stored = getStoredAuth();
  if (!stored) return false;
  const last = stored.lastActivityAt ?? stored.loginAt;
  if (!last) return false;
  return Date.now() - last > SESSION_TTL_MS;
}

/** @deprecated Use isSessionInactive */
export function isSessionExpired(): boolean {
  return isSessionInactive();
}

export function touchActivity(): void {
  const stored = getStoredAuth();
  if (!stored) return;
  setStoredAuth(
    { ...stored, lastActivityAt: Date.now() },
    { preserveTimestamps: true }
  );
}

export function clearStoredAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
