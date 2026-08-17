import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import http from "@/utils/http";
import {
  USER_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
  clearAuthStorage,
} from "@/utils/auth";

export interface AuthUser {
  userId: number;
  username: string;
  realName: string;
  roles: string[];
  permissions: string[];
  platformAdmin?: boolean;
  platform_admin?: boolean;
}

interface LoginPayload {
  username: string;
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (roleName: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
export const CURRENT_USER_PATH = "/user-management/current";

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is string => typeof item === "string");
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function isPlatformAdminFlag(source: {
  platformAdmin?: unknown;
  platform_admin?: unknown;
} | null | undefined): boolean {
  return source?.platformAdmin === true || source?.platform_admin === true;
}

export function toAuthUser(
  source: Record<string, unknown> | null | undefined,
  fallback?: AuthUser | null,
): AuthUser {
  const roles = readStringArray(source?.roles);
  const permissions = readStringArray(source?.permissions);
  const platformAdmin =
    readOptionalBoolean(source?.platformAdmin)
    ?? readOptionalBoolean(source?.platform_admin)
    ?? fallback?.platformAdmin
    ?? fallback?.platform_admin
    ?? false;

  return {
    userId: Number(source?.userId ?? fallback?.userId ?? 0),
    username: String(source?.username ?? fallback?.username ?? ""),
    realName: String(source?.realName ?? fallback?.realName ?? ""),
    roles: roles ?? fallback?.roles ?? [],
    permissions: permissions ?? fallback?.permissions ?? [],
    platformAdmin,
    platform_admin: platformAdmin,
  };
}

function persistSession(token: string, user: AuthUser) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  window.sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

function readStoredUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedUser =
    window.sessionStorage.getItem(USER_STORAGE_KEY) ||
    window.localStorage.getItem(USER_STORAGE_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    return toAuthUser(JSON.parse(storedUser) as Record<string, unknown>);
  } catch {
    return null;
  }
}

async function fetchCurrentAuthority(): Promise<Record<string, unknown> | null> {
  try {
    const response: unknown = await http.get(CURRENT_USER_PATH);
    if (response && typeof response === "object" && !Array.isArray(response)) {
      return response as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function authorityLooksIncomplete(user: AuthUser | null): boolean {
  if (!user) {
    return true;
  }
  return user.roles.length === 0 || user.permissions.length === 0 || user.platformAdmin == null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const storedToken =
        typeof window === "undefined"
          ? null
          : window.sessionStorage.getItem(TOKEN_STORAGE_KEY) ||
            window.localStorage.getItem(TOKEN_STORAGE_KEY);
      const storedUser = readStoredUser();

      if (!storedToken || !storedUser) {
        clearAuthStorage();
        if (!cancelled) {
          setToken(null);
          setUser(null);
          setLoading(false);
        }
        return;
      }

      persistSession(storedToken, storedUser);
      if (!cancelled) {
        setToken(storedToken);
        setUser(storedUser);
      }

      const current = await fetchCurrentAuthority();
      if (cancelled) {
        return;
      }
      if (current) {
        const nextUser = toAuthUser(current, storedUser);
        persistSession(storedToken, nextUser);
        setUser(nextUser);
      }
      setLoading(false);
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (payload: LoginPayload) => {
    const response = await http.post<Record<string, unknown>>("/auth/login", payload) as unknown;
    const record = (response && typeof response === "object" ? response : {}) as Record<string, unknown>;
    const nextToken = String(record.token ?? "");
    if (!nextToken) {
      throw new Error("登录响应缺少 token");
    }

    if (typeof window !== "undefined") {
      clearAuthStorage();
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    }

    let nextUser = toAuthUser(record);
    if (authorityLooksIncomplete(nextUser)) {
      const current = await fetchCurrentAuthority();
      if (current) {
        nextUser = toAuthUser(current, nextUser);
      }
    }

    persistSession(nextToken, nextUser);
    setToken(nextToken);
    setUser(nextUser);
  };

  const logout = async () => {
    try {
      await http.post("/auth/logout");
    } catch {
      // 后端撤销失败仍清本地会话，避免卡在已退出界面。
    }
    clearAuthStorage();
    setToken(null);
    setUser(null);
  };

  const hasRole = (roleName: string): boolean => {
    if (!user || !user.roles || user.roles.length === 0) return false;
    return user.roles.some(
      (r) => r.toUpperCase() === roleName.toUpperCase()
    );
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      loading,
      login,
      logout,
      hasRole,
    }),
    [loading, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
