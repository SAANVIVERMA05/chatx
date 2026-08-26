"use client";

/**
 * AuthContext — provides authenticated user state to the component tree.
 *
 * SOLID:
 *   - SRP: This context only manages auth state (user, token, loading).
 *          It does not handle navigation, chat state, or socket connections.
 *
 * Changes from original:
 *   - Merged duplicate `loginWithOtp` and `registerWithProfile` into
 *     a single `saveAuthSession` function (they were byte-for-byte identical).
 *   - Kept both names as aliases for backward compatibility.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { lockVault } from "@/lib/keyInit";

export type AuthUser = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  status: "online" | "offline" | "busy";
  lastSeen?: string;
  isVerified?: boolean;
  title?: string;
  department?: string;
};

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  /**
   * Persist an authenticated session (user + JWT) to state and localStorage.
   * Call this after a successful OTP verification or profile registration.
   */
  saveAuthSession: (serverUser: ServerUser, token: string) => void;
  /** @deprecated Use saveAuthSession instead. Kept for backward compatibility. */
  loginWithOtp: (serverUser: ServerUser, token: string) => void;
  /** @deprecated Use saveAuthSession instead. Kept for backward compatibility. */
  registerWithProfile: (serverUser: ServerUser, token: string) => void;
  logout: () => void;
};

/** Shape of the user object returned by the server's auth endpoints. */
interface ServerUser {
  id: string;
  username: string;
  phone_number?: string;
  avatar_url?: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    setToken(storedToken);

    const cachedUser = storedUser ? tryParseUser(storedUser) : null;
    if (cachedUser) setUser(cachedUser);

    verifyTokenWithServer(storedToken, cachedUser);
  }, []);

  function tryParseUser(raw: string): AuthUser | null {
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  async function verifyTokenWithServer(
    authToken: string,
    cachedUser: AuthUser | null
  ): Promise<void> {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        const fresh = mapServerUser(data.user);
        setUser(fresh);
        localStorage.setItem("user", JSON.stringify(fresh));
      } else if (cachedUser) {
        // Token invalid but cached data exists — use cache (handles HMR in dev)
        setUser(cachedUser);
      } else {
        clearSession();
      }
    } catch {
      // Network error — fall back to cache
      if (cachedUser) {
        setUser(cachedUser);
      } else {
        clearSession();
      }
    } finally {
      setIsLoading(false);
    }
  }

  function mapServerUser(u: ServerUser): AuthUser {
    return {
      id: u.id,
      name: u.username,
      phone: u.phone_number,
      avatar: u.avatar_url ?? undefined,
      status: "online",
    };
  }

  /**
   * Persist a newly authenticated session to state + localStorage.
   * This is the single function that both login and registration use.
   */
  function saveAuthSession(serverUser: ServerUser, authToken: string): void {
    const userObj = mapServerUser(serverUser);
    localStorage.setItem("token", authToken);
    localStorage.setItem("user", JSON.stringify(userObj));
    setToken(authToken);
    setUser(userObj);
  }

  function clearSession(): void {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }

  function logout(): void {
    lockVault(); // Zero in-memory master key before clearing session
    clearSession();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        saveAuthSession,
        // Backward-compatible aliases
        loginWithOtp: saveAuthSession,
        registerWithProfile: saveAuthSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
