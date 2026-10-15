import { api, tokenStore } from "./client";
import type { User } from "../types/domain";

export async function login(username: string, password: string): Promise<void> {
  const t = await api<{ access: string; refresh: string }>("/auth/token/", {
    method: "POST",
    body: { username, password },
  });
  tokenStore.set(t.access, t.refresh);
}

export async function register(username: string, email: string, password: string): Promise<void> {
  const t = await api<{ access: string; refresh: string }>("/auth/register/", {
    method: "POST",
    body: { username, email, password },
  });
  tokenStore.set(t.access, t.refresh);
}

export const fetchMe = () => api<User>("/auth/me/");
