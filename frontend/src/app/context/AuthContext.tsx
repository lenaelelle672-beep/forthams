import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  USER_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
  api,
  clearAuthStorage,
} from "../utils/api";

export interface AuthUser {
  userId: number;
  username: string;
  realName: string;
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
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
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
    } else {
      clearAuthStorage();
    }

    setLoading(false);
  }, []);

  const login = async (payload: LoginPayload) => {
    const response = await api.post<LoginResponse>("/auth/login", payload);

    const nextUser: AuthUser = {
      userId: response.userId,
      username: response.username,
      realName: response.realName,
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

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      loading,
      login,
      logout,
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
