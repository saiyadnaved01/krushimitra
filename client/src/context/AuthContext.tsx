import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, tokenStore, UNAUTHORIZED_EVENT } from "@/api/client";
import type { Role, User } from "@/api/types";
import { currentLanguage, setLanguage } from "@/i18n";
import { isLanguage } from "@/i18n/languages";

interface AuthValue {
  user: User | null;
  /** True while the stored token is being verified on first load. */
  loading: boolean;
  login: (email: string, password: string, portal: Role) => Promise<User>;
  register: (input: { name: string; email: string; password: string; location?: string; language?: string }) => Promise<User>;
  demo: (role: Role) => Promise<User>;
  logout: () => void;
  /** Replace the cached user after a profile update. */
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

interface Session {
  token: string;
  user: User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const syncedFor = useRef<number | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(tokenStore.get()));

  // Restore the session from a stored token.
  useEffect(() => {
    if (!tokenStore.get()) return;
    let cancelled = false;
    api<{ user: User }>("/auth/me")
      .then((r) => !cancelled && setUser(r.user))
      .catch(() => tokenStore.clear())
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    syncedFor.current = null;
    setUser(null);
    qc.clear(); // never show one account's cached data to the next
  }, [qc]);

  // A 401 from any request means the token expired.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, clearSession);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, clearSession);
  }, [clearSession]);

  const start = useCallback(
    (s: Session) => {
      qc.clear();
      tokenStore.set(s.token);
      setUser(s.user);
      return s.user;
    },
    [qc],
  );

  // A signed-in user's saved language wins over this device's; if none is saved yet, save the current one.
  useEffect(() => {
    if (!user || syncedFor.current === user.id) return;
    syncedFor.current = user.id;
    if (isLanguage(user.language)) void setLanguage(user.language);
    else
      void api<{ user: User }>("/profile/language", { method: "PATCH", body: { language: currentLanguage() } })
        .then((r) => setUser(r.user))
        .catch(() => undefined);
  }, [user]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      login: async (email, password, portal) =>
        start(
          await api<Session>("/auth/login", {
            method: "POST",
            body: { email, password, portal },
            skipAuthRedirect: true,
          }),
        ),
      register: async (input) =>
        start(await api<Session>("/auth/register", { method: "POST", body: input, skipAuthRedirect: true })),
      demo: async (role) =>
        start(await api<Session>("/auth/demo", { method: "POST", body: { role }, skipAuthRedirect: true })),
      logout: clearSession,
      setUser,
    }),
    [user, loading, start, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
