"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { apiFetch, setAccessToken } from "@/lib/api";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "OPERATOR";
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function errorMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: string | string[] }).message;
    if (Array.isArray(message)) return message.join(" ");
    if (typeof message === "string") return message;
  }
  return fallback;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const restore = useCallback(async () => {
    try {
      const response = await apiFetch(`${API_URL}/auth/me`);
      if (!response.ok) {
        setAccessToken(null);
        setUser(null);
        return;
      }
      setUser((await response.json()) as AuthUser);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void restore(), 0);
    return () => window.clearTimeout(timer);
  }, [restore]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiFetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      user?: AuthUser;
      accessToken?: string;
      message?: string | string[];
    };
    if (!response.ok || !body.user) {
      throw new Error(errorMessage(body, "Could not sign in."));
    }
    setAccessToken(body.accessToken ?? null);
    setUser(body.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch(`${API_URL}/auth/logout`, { method: "POST" });
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [loading, login, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
