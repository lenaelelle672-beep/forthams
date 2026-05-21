import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";

export const TOKEN_STORAGE_KEY = "auth_token";
export const USER_STORAGE_KEY = "user_info";

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function clearAuthStorage() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
}

export function redirectToLogin() {
  if (typeof window === "undefined") {
    return;
  }

  if (window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}

export const apiClient = axios.create({
  baseURL: "/api",
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse<unknown>>) => {
    if (error.response?.status === 401) {
      clearAuthStorage();

      const requestUrl = error.config?.url ?? "";
      const isLoginRequest = requestUrl.includes("/auth/login");

      if (!isLoginRequest) {
        redirectToLogin();
      }
    }

    const message = error.response?.data?.message ?? error.message ?? "请求失败";

    return Promise.reject(new Error(message));
  },
);

async function request<T>(config: AxiosRequestConfig) {
  const response: AxiosResponse<ApiResponse<T>> = await apiClient.request(config);

  if (response.data.code !== 200) {
    throw new Error(response.data.message || "请求失败");
  }

  return response.data.data;
}

export const api = {
  get<T>(url: string, config?: AxiosRequestConfig) {
    return request<T>({
      ...config,
      method: "GET",
      url,
    });
  },

  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return request<T>({
      ...config,
      method: "POST",
      url,
      data,
    });
  },

  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return request<T>({
      ...config,
      method: "PUT",
      url,
      data,
    });
  },

  delete<T>(url: string, config?: AxiosRequestConfig) {
    return request<T>({
      ...config,
      method: "DELETE",
      url,
    });
  },
};

export default apiClient;
