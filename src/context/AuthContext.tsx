"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import SessionLockOverlay from "@/components/auth/SessionLockOverlay";
import {
  AuthUser,
  clearStoredAuth,
  getStoredAuth,
  setStoredAuth,
  getStoredToken,
  isSessionInactive,
  touchActivity,
} from "@/types/auth";

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  sessionLocked: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  recordActivity: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isBuiltInAdminRole(roleName: string | null | undefined): boolean {
  return (roleName ?? "").trim().toLowerCase() === "admin";
}

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"] as const;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionLocked, setSessionLocked] = useState(false);

  const recordActivity = useCallback(() => {
    if (getStoredToken()) {
      touchActivity();
      setSessionLocked(false);
    }
  }, []);

  const lockSession = useCallback(() => {
    setSessionLocked(true);
  }, []);

  const forceLogoutAndRedirect = useCallback(() => {
    clearStoredAuth();
    setUser(null);
    setToken(null);
    setSessionLocked(false);
    setIsLoading(false);
    router.replace("/signin");
  }, [router]);

  const refreshUser = useCallback(async () => {
    const t = getStoredToken();
    if (!t) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }
    if (isSessionInactive()) {
      lockSession();
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        const data = await res.json();
        const auth = { user: data.user, token: t };
        setStoredAuth(auth, { preserveTimestamps: true });
        touchActivity();
        setUser(data.user);
        setToken(t);
        setSessionLocked(false);
      } else {
        clearStoredAuth();
        setUser(null);
        setToken(null);
      }
    } catch {
      /* Keep local session on network error — drafts remain usable */
    } finally {
      setIsLoading(false);
    }
  }, [lockSession]);

  useEffect(() => {
    const stored = getStoredAuth();
    if (stored?.user && stored?.token) {
      if (isSessionInactive()) {
        setUser(stored.user);
        setToken(stored.token);
        setSessionLocked(true);
        setIsLoading(false);
        return;
      }
      setUser(stored.user);
      setToken(stored.token);
      setIsLoading(false);
      void refreshUser();
    } else {
      setIsLoading(false);
    }
  }, [refreshUser]);

  useEffect(() => {
    const check = () => {
      if (getStoredToken() && isSessionInactive()) {
        lockSession();
      }
    };
    const interval = setInterval(check, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [lockSession]);

  useEffect(() => {
    if (sessionLocked) return;

    let throttle = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - throttle < 30_000) return;
      throttle = now;
      recordActivity();
    };

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }
    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
    };
  }, [sessionLocked, recordActivity]);

  const login = useCallback(
    async (email: string, password: string): Promise<{ error?: string }> => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { error: data.error || "Login failed" };
        }
        const now = Date.now();
        setStoredAuth({
          user: data.user,
          token: data.token,
          loginAt: now,
          lastActivityAt: now,
        });
        setUser(data.user);
        setToken(data.token);
        setSessionLocked(false);
        setIsLoading(false);
        return {};
      } catch {
        return { error: "Network error" };
      }
    },
    []
  );

  const logout = useCallback(() => {
    clearStoredAuth();
    setUser(null);
    setToken(null);
    setSessionLocked(false);
  }, []);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      if (isBuiltInAdminRole(user.roleName)) return true;
      if (!user.permissions) return false;
      if (user.permissions.includes("admin") || user.permissions.includes("*"))
        return true;
      return user.permissions.includes(permission);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        sessionLocked,
        login,
        logout,
        refreshUser,
        hasPermission,
        recordActivity,
      }}
    >
      {children}
      {sessionLocked && (
        <SessionLockOverlay onSignInAgain={forceLogoutAndRedirect} />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
