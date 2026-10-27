import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, clearSession, getToken, loadUser, setSession } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);
  const [ready, setReady] = useState(!getToken());

  useEffect(() => {
    if (!getToken()) return undefined;
    let live = true;
    api("/api/auth/me")
      .then((next) => {
        if (!live) return;
        setUser(next);
        localStorage.setItem("at_user", JSON.stringify(next));
      })
      .catch(() => {
        if (!live) return;
        clearSession();
        setUser(null);
      })
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      async login(username, password) {
        const result = await api("/api/auth/login", { method: "POST", body: { username, password } });
        setSession(result.access_token, result.user);
        setUser(result.user);
        return result.user;
      },
      async logout() {
        try {
          await api("/api/auth/logout", { method: "POST" });
        } catch {
          /* La sesión local se cierra igual. */
        }
        clearSession();
        setUser(null);
      },
    }),
    [user, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
