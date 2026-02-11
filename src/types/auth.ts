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

export type StoredAuth = {
  user: AuthUser;
  token: string;
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

export function setStoredAuth(data: StoredAuth): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
  localStorage.setItem(TOKEN_KEY, data.token);
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
