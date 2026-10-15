import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchMe, login as apiLogin, register as apiRegister } from "../api/auth";
import { setSessionExpiredHandler, tokenStore } from "../api/client";
import type { User } from "../types/domain";

interface AuthValue {
  user: User | null;
  loading: boolean; // vrai tant qu'on ne sait pas si une session existe
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.access));

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    qc.clear(); // ne garder aucune donnée de l'utilisateur précédent
  }, [qc]);

  useEffect(() => {
    setSessionExpiredHandler(logout);
    if (!tokenStore.access) return;
    fetchMe().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, [logout]);

  const login = async (u: string, p: string) => {
    await apiLogin(u, p);
    setUser(await fetchMe());
  };
  const register = async (u: string, e: string, p: string) => {
    await apiRegister(u, e, p);
    setUser(await fetchMe());
  };

  return <AuthContext value={{ user, loading, login, register, logout }}>{children}</AuthContext>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
