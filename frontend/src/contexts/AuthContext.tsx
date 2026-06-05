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
}

interface LoginPayload {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  userId: number;
  username: string;
  realName: string;
  roles: string[];
  permissions?: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
  hasRole: (roleName: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
    return JSON.parse(storedUser) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken =
      typeof window === "undefined"
        ? null
        : window.sessionStorage.getItem(TOKEN_STORAGE_KEY) ||
          window.localStorage.getItem(TOKEN_STORAGE_KEY);
    const storedUser = readStoredUser();

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);

      // 异步修复：检测到 user 缺少 roles 时从后端获取完整信息
      if (!storedUser.roles || storedUser.roles.length === 0) {
        http.get<{ userId: number; username: string; realName: string; roles: string[]; permissions: string[] }>('/user-management/current')
          .then((data) => {
            const fixedUser: AuthUser = {
              userId: data.userId ?? storedUser.userId,
              username: data.username ?? storedUser.username,
              realName: data.realName ?? storedUser.realName,
              roles: data.roles ?? [],
              permissions: data.permissions ?? [],
            };
            setUser(fixedUser);
            // 同步更新 sessionStorage
            if (typeof window !== 'undefined') {
              window.sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fixedUser));
            }
          })
          .catch(() => {
            // 失败不阻断，保持原数据
          })
          .finally(() => {
            setLoading(false);
          });
        return; // 异步修复完成后才解除 loading
      }
    } else {
      clearAuthStorage();
    }

    setLoading(false);
  }, []);

  const login = async (payload: LoginPayload) => {
    const response = await http.post<LoginResponse>("/auth/login", payload);

    const nextUser: AuthUser = {
      userId: response.userId,
      username: response.username,
      realName: response.realName,
      roles: response.roles ?? [],
      permissions: response.permissions ?? [],
    };

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, response.token);
      window.sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    }

    setToken(response.token);
    setUser(nextUser);
  };

  const logout = () => {
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
