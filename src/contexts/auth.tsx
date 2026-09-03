import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { User, AstrologerProfile } from "@/types";
import { authApi, astrologerApi, setTokens, clearTokens, getAccessToken } from "@/lib/api";

interface AuthState {
  user: User | null;
  profile: AstrologerProfile | null;
  loading: boolean;
  signin: (identifier: string, password: string) => Promise<void>;
  signup: (data: {
    name: string;
    email: string;
    username: string;
    password: string;
  }) => Promise<void>;
  signout: () => Promise<void>;
  onboard: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function decodeJwtPayload(token: string): { sub?: string; role?: string } | null {
  try {
    const parts = token.split(".");
    const base64 = parts[1];
    if (!base64) return null;
    const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function storeUser(user: User | null) {
  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
  } else {
    localStorage.removeItem("user");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser);
  const [profile, setProfile] = useState<AstrologerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    const payload = decodeJwtPayload(token);
    if (!payload?.sub) {
      clearTokens();
      storeUser(null);
      setLoading(false);
      return;
    }

    if (payload.role === "Astrologer") {
      try {
        const data = await astrologerApi.getMe();
        setUser(data.user);
        storeUser(data.user);
        setProfile(data.profile);
      } catch {
        // Token might be valid but profile doesn't exist yet - don't destroy session
        // Just keep the stored user if available
        const stored = getStoredUser();
        if (!stored) {
          clearTokens();
          storeUser(null);
        }
      }
    } else {
      // Client/Admin - keep the stored user, no profile needed
      const stored = getStoredUser();
      if (!stored) {
        // We don't have full user data from JWT alone, try a lightweight approach
        // Just keep what we have; signin/signup will have set this
        setUser(null);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const signin = useCallback(async (identifier: string, password: string) => {
    const data = await authApi.signin({ identifier, password });
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    storeUser(data.user);
    if (data.user.role === "Astrologer") {
      try {
        const profileData = await astrologerApi.getMe();
        setProfile(profileData.profile);
      } catch {
        // Profile might not exist yet (edge case)
      }
    }
  }, []);

  const signup = useCallback(async (regData: {
    name: string;
    email: string;
    username: string;
    password: string;
  }) => {
    const data = await authApi.register(regData);
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    storeUser(data.user);
  }, []);

  const signout = useCallback(async () => {
    try {
      await authApi.signout();
    } finally {
      clearTokens();
      storeUser(null);
      setUser(null);
      setProfile(null);
    }
  }, []);

  const onboard = useCallback(async () => {
    const data = await astrologerApi.onboard();
    localStorage.setItem("accessToken", data.accessToken);
    setUser(data.user);
    storeUser(data.user);
    setProfile(data.profile);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const data = await astrologerApi.getMe();
      setUser(data.user);
      storeUser(data.user);
      setProfile(data.profile);
    } catch {
      // silently fail
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signin, signup, signout, onboard, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
